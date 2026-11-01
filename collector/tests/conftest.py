from datetime import date

import pytest

from collector.models import Job, Evidence, Source, Location, Commute, Eligibility, Recruitment, Requirement, Profile, DIMENSIONS, MANDATORY_EVIDENCE

TODAY = date(2026, 11, 1)
URL = "https://www.python.org/jobs/"


@pytest.fixture
def profile():
    return Profile(attributes={"graduated": True, "graduation_date": "2026-09", "education": "university", "drivers_license": True})


@pytest.fixture
def job():
    # Completely fictional TEST ONLY record. It never enters public/jobs.json.
    evidence = [Evidence(id=f"e-{field}", field=field, url=URL, quote_or_locator=f"TEST ONLY: {field} explicitly verified", checked_at=TODAY, conclusion="pass", method="official_page") for field in (*MANDATORY_EVIDENCE, *DIMENSIONS)]
    requirements = [Requirement(field=field, operator="any", description=f"TEST ONLY: no restriction on {field}", evidence_ids=[f"e-{field}"]) for field in DIMENSIONS]
    return Job(id="test-only", company="TEST ONLY COMPANY", employer="TEST ONLY COMPANY", title="TEST ONLY ROLE", category='software', recruitment_track="general", employment_type="full_time_regular",
               location=Location(address="TEST ONLY ADDRESS", is_fixed=True, region="TEST ONLY REGION"),
               commute=Commute(minutes=20, status="verified", provider="TEST ONLY manual route", checked_at=TODAY, route_assumptions="TEST ONLY morning car route"),
               eligibility=Eligibility(status="eligible", graduate_eligibility="pass", professional_experience="pass", requirements=requirements),
               recruitment=Recruitment(status="active"), sources=[Source(url=URL, original_url=URL, kind="official", checked_at=TODAY)],
               evidence=evidence, first_seen_at=TODAY, last_checked_at=TODAY)
