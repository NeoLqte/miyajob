import hashlib
import json
import os
import re
from datetime import date
from pathlib import Path

from .audit import audit
from .models import Job, Profile, PublicData
from .listing import complete_job


def stable_id(job: Job) -> str:
    parts = [job.company, job.title, job.location.address, job.recruitment_track]
    key = "|".join(re.sub(r"\s+", "", p).casefold() for p in parts)
    return hashlib.sha256(key.encode()).hexdigest()[:20]


def deduplicate(jobs: list[Job]):
    groups: dict[str, list[Job]] = {}
    for job in jobs:
        job.id = stable_id(job)
        groups.setdefault(job.id, []).append(job)
    merged = []
    for key, group in sorted(groups.items()):
        group.sort(key=lambda j: (not any(s.kind == "official" for s in j.sources), -j.last_checked_at.toordinal()))
        head = group[0].model_copy(deep=True)
        conflict = False
        for other in group[1:]:
            # No majority vote: substantive disagreements require human resolution.
            for field in ("employment_type", "location", "recruitment", "pay", "workstyle", "eligibility"):
                if getattr(head, field) != getattr(other, field):
                    conflict = True
            for s in other.sources:
                if s not in head.sources:
                    head.sources.append(s)
            for e in other.evidence:
                if e not in head.evidence:
                    head.evidence.append(e)
            head.first_seen_at = min(head.first_seen_at, other.first_seen_at)
        if conflict:
            head.eligibility.status = "review"
            # conflict marker is auditable and blocks even a subsequent adjudication
            if head.evidence:
                marker = head.evidence[0].model_copy(update={"id": "duplicate-conflict", "field": "requirements_complete", "conclusion": "unknown", "notes": "出典間の条件差を人手で解消してください"})
                head.evidence.append(marker)
        merged.append(head)
    return merged, len(jobs) - len(merged)


def atomic_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)


def public_payload(jobs: list[Job], today: date, profile: Profile):
    # Never serialize the applicant profile, review records, or pipeline metadata.
    accepted = [j for j in jobs if complete_job(j) and j.eligibility.status == "eligible" and audit(j, profile, today).status == "eligible" and audit(j, None, today).status == "eligible"]
    public_jobs = [j.model_copy(deep=True) for j in accepted]
    for job in public_jobs:
        # Free-form internal reviewer notes may mention unknown applicant attributes.
        # Public provenance is the employer's locator, conclusion, method and date.
        for evidence in job.evidence:
            evidence.notes = ""
    payload = PublicData(updated_at=today, collection_status="verified_export" if accepted else "research_in_progress", jobs=public_jobs)
    return payload


def export_public(jobs: list[Job], target: Path, today: date, profile: Profile):
    payload = public_payload(jobs, today, profile)
    atomic_json(target, payload.model_dump(mode="json"))
    return payload.jobs


def validate_public(path: Path, today: date):
    payload = PublicData.model_validate_json(path.read_text(encoding="utf-8"))
    if payload.updated_at and payload.updated_at > today:
        raise ValueError("future_export_date")
    if payload.jobs and (payload.updated_at is None or payload.collection_status != "verified_export"):
        raise ValueError("missing_export_metadata")
    ids = [j.id for j in payload.jobs]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate_public_id")
    for job in payload.jobs:
        if not complete_job(job):
            raise ValueError(f'{job.id}: incomplete_listing_conditions')
        decision = audit(job, today=today)
        if decision.status != "eligible":
            raise ValueError(f"{job.id}: {decision.reasons}")
    return payload
