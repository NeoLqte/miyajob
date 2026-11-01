"""Fail closed: flags supplied by an extractor never authorize publication."""
from datetime import date
from dataclasses import dataclass

from .models import DIMENSIONS, SUPPORTED_REQUIREMENTS, MANDATORY_EVIDENCE, Job, Profile


@dataclass
class Decision:
    status: str
    reasons: list[str]


def compare(actual, operator, expected):
    if operator == "any":
        return True
    if actual is None or actual == "unknown":
        return None
    try:
        if operator == "eq":
            return type(actual) is type(expected) and actual == expected
        if operator == "gte":
            return isinstance(actual, (float, int)) and not isinstance(actual, bool) and isinstance(expected, (float, int)) and not isinstance(expected, bool) and actual >= expected
        if operator == "lte":
            return isinstance(actual, (float, int)) and not isinstance(actual, bool) and isinstance(expected, (float, int)) and not isinstance(expected, bool) and actual <= expected
        if operator == "in":
            return actual in expected if isinstance(expected, list) else None
        if operator == "between":
            return expected[0] <= actual <= expected[1] if isinstance(expected, list) and len(expected) == 2 and isinstance(actual, str) else None
    except (TypeError, IndexError):
        return None
    return None


def audit(job: Job, profile: Profile | None = None, today: date | None = None) -> Decision:
    today = today or date.today()
    reasons, failures = [], []
    sources = {s.url: s for s in job.sources}
    ids = {e.id: e for e in job.evidence}
    if len(ids) != len(job.evidence):
        reasons.append("duplicate_evidence_id")
    if not sources:
        reasons.append("missing_source")
    if job.last_checked_at > today or job.first_seen_at > today or job.first_seen_at > job.last_checked_at:
        reasons.append("invalid_job_dates")
    for s in job.sources:
        if s.checked_at > today or s.checked_at > job.last_checked_at:
            reasons.append("invalid_source_date")

    def evidence_ok(e, field):
        return (e.field == field and e.conclusion == "pass" and e.url in sources
                and e.checked_at <= today
                and (e.valid_through is None or today <= e.valid_through)
                and e.checked_at <= job.last_checked_at and e.checked_at <= sources[e.url].checked_at)

    fields = set(MANDATORY_EVIDENCE) | {r.field for r in job.eligibility.requirements}
    if any(e.valid_through and e.valid_through < today for e in job.evidence if e.field in fields):
        reasons.append("evidence_expired")
    for field in fields:
        relevant = [e for e in job.evidence if e.field == field]
        # Conflicting evidence is never silently overridden by a newer source.
        if any(e.conclusion != "pass" for e in relevant):
            reasons.append(f"conflicting_or_unknown_evidence:{field}")
        if not any(evidence_ok(e, field) for e in relevant):
            reasons.append(f"missing_evidence:{field}")

    requirements = job.eligibility.requirements
    covered = {r.field for r in requirements}
    for field in DIMENSIONS:
        if field not in covered:
            reasons.append(f"unchecked_requirement:{field}")
    for r in requirements:
        if r.field not in SUPPORTED_REQUIREMENTS:
            reasons.append(f"unsupported_requirement:{r.field}")
        if not r.evidence_ids or not all(i in ids and evidence_ok(ids[i], r.field) for i in r.evidence_ids):
            reasons.append(f"requirement_evidence:{r.field}")
        if profile is not None:
            result = compare(profile.attributes.get(r.field), r.operator, r.value)
            if result is None:
                reasons.append(f"unknown_applicant:{r.field}")
            elif result is False:
                failures.append(f"requirement_mismatch:{r.field}")
    if job.employment_type == "unknown":
        reasons.append("employment_unverified")
    elif job.employment_type != "full_time_regular":
        failures.append("not_regular_employment")
    if job.recruitment.status == "closed" or (job.recruitment.valid_through and job.recruitment.valid_through < today):
        failures.append("recruitment_closed")
    elif job.recruitment.status != "active":
        reasons.append("recruitment_unverified")
    if job.recruitment.date_posted and job.recruitment.date_posted > today:
        reasons.append("future_posting")
    if not job.location.address or not job.location.is_fixed:
        reasons.append("location_unverified")
    c = job.commute
    maximum = min(45, profile.maximum_minutes) if profile else 45
    if not c.provider or not c.checked_at or not c.route_assumptions or not c.checked_at <= min(today, job.last_checked_at):
        reasons.append("route_evidence_missing")
    if c.status == "verified":
        if c.minutes is None:
            reasons.append("route_minutes_missing")
        elif c.minutes > maximum:
            failures.append("commute_too_long")
    elif c.status == "local_verified":
        if c.minutes is not None:
            reasons.append("local_estimate_must_not_invent_minutes")
    elif c.status == "remote_verified":
        if job.location.remote_policy != "full" or not job.location.residence_verified:
            reasons.append("remote_residence_unverified")
    else:
        reasons.append("commute_unverified")
    if profile is None:
        if job.eligibility.status != "eligible" or job.eligibility.graduate_eligibility != "pass" or job.eligibility.professional_experience != "pass":
            reasons.append("eligibility_not_verified")
    if failures:
        return Decision("rejected", sorted(set(failures + reasons)))
    return Decision("review" if reasons else "eligible", sorted(set(reasons)))


def adjudicate(job: Job, profile: Profile, today: date | None = None) -> Decision:
    decision = audit(job, profile, today)
    job.eligibility.status = decision.status
    job.eligibility.graduate_eligibility = "pass" if decision.status == "eligible" else "unknown"
    job.eligibility.professional_experience = "pass" if decision.status == "eligible" else "unknown"
    return decision
