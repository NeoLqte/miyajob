"""Export approved public review summaries, separate from verified opportunities."""
from datetime import date
from pathlib import Path
import json

from .models import ReviewCandidate, ReviewData, IT_CATEGORIES
from .listing import complete_conditions


def validate_review(data: ReviewData, today: date):
    if data.updated_at > today or len({j.id for j in data.candidates}) != len(data.candidates):
        raise ValueError('invalid_review_metadata')
    if any(j.checked_at > today or j.checked_at > data.updated_at or (j.valid_through and j.valid_through < today) for j in data.candidates):
        raise ValueError('invalid_or_expired_review_candidate')
    if any(len({f.field for f in j.facts}) != len(j.facts) or any(f.checked_at > j.checked_at for f in j.facts) for j in data.candidates):
        raise ValueError('invalid_review_facts')
    if any(not complete_conditions(j.facts) for j in data.candidates):
        raise ValueError('incomplete_listing_conditions')
    return data


def review_payload(root: Path, jobs, today: date):
    source = root / 'data/internal/public-review.json'
    previous = root / 'web/public/review-jobs.json'
    raw = json.loads(source.read_text(encoding='utf-8')) if source.exists() else (json.loads(previous.read_text(encoding='utf-8'))['candidates'] if previous.exists() else [])
    candidates = [ReviewCandidate.model_validate(row) for row in raw]
    records = {j.id:j for j in jobs}
    accepted = []
    for candidate in candidates:
        job = records.get(candidate.id)
        if not job or job.eligibility.status != 'review' or job.category not in IT_CATEGORIES or job.recruitment.status == 'closed':
            continue
        deadline = job.recruitment.valid_through
        if deadline and deadline < today:
            continue
        if (candidate.company, candidate.title, candidate.category) != (job.company, job.title, job.category) or candidate.url not in {s.url for s in job.sources}:
            raise ValueError('review_summary_source_mismatch')
        if any(f.url not in {s.url for s in job.sources} for f in candidate.facts):
            raise ValueError('review_fact_source_mismatch')
        # Keep the earliest explicit expiry; never let a curated summary extend it.
        if deadline:
            candidate.valid_through = min(deadline, candidate.valid_through) if candidate.valid_through else deadline
        if candidate.valid_through and candidate.valid_through < today:
            continue
        if complete_conditions(candidate.facts):
            accepted.append(candidate)
    return validate_review(ReviewData(updated_at=today, candidates=accepted), today)
