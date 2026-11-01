from datetime import date, timedelta
import pytest
from pydantic import ValidationError

from collector.audit import audit, adjudicate
from collector.export import export_public, deduplicate, stable_id, validate_public
from collector.models import Requirement
from conftest import TODAY


def restrict(job, field, operator, value):
    requirement = next(r for r in job.eligibility.requirements if r.field == field)
    requirement.operator, requirement.value = operator, value


def test_fully_verified(job, profile, tmp_path):
    assert adjudicate(job, profile, TODAY).status == "eligible"
    target = tmp_path / "jobs.json"
    assert len(export_public([job], target, TODAY, profile)) == 1
    assert len(validate_public(target, TODAY).jobs) == 1
    assert "attributes" not in target.read_text()


def test_wrong_graduation_year(job, profile):
    restrict(job, "graduation_date", "between", ["2027-03", "2027-03"])
    assert audit(job, profile, TODAY).status == "rejected"


def test_inexperience_does_not_imply_graduate_allowed(job, profile):
    job.eligibility.requirements = [r for r in job.eligibility.requirements if r.field != "graduation_date"]
    assert audit(job, profile, TODAY).status == "review"


def test_unknown_employment_is_review(job,profile):
    job.employment_type="unknown"
    assert audit(job,profile,TODAY).status == "review"


def test_private_reviewer_notes_never_exported(job,profile,tmp_path):
    job.evidence[0].notes="private applicant attributes should stay local"
    path=tmp_path/'jobs.json'
    export_public([job],path,TODAY,profile)
    assert "private applicant" not in path.read_text(encoding='utf-8')
    assert job.evidence[0].notes.startswith("private")


@pytest.mark.parametrize("field,operator,value", [("it_years","gte",3),("age","lte",29),("license_restriction","eq","MT"),("employment_history","eq","none"),("other_qualifications","in",["required_license"])])
def test_unknown_applicant_never_passes(job, profile, field, operator, value):
    restrict(job,field,operator,value)
    assert audit(job, profile, TODAY).status == "review"


def test_known_failure(job, profile):
    profile.attributes["it_years"] = 0
    restrict(job,"it_years","gte",3)
    assert audit(job,profile,TODAY).status == "rejected"


@pytest.mark.parametrize("change,expected", [
    (lambda j:setattr(j.location,"is_fixed",False),"review"),
    (lambda j:setattr(j.commute,"status","unverified"),"review"),
    (lambda j:setattr(j.commute,"minutes",46),"rejected"),
    (lambda j:setattr(j.recruitment,"status","closed"),"rejected"),
    (lambda j:setattr(j.recruitment,"status","unverified"),"review"),
    (lambda j:setattr(j.recruitment,"valid_through",TODAY-timedelta(days=1)),"rejected"),
    (lambda j:setattr(j,"sources",[]),"review"),
    (lambda j:setattr(j,"evidence",[]),"review"),
    (lambda j:setattr(j,"last_checked_at",TODAY-timedelta(days=31)),"review"),  # source newer than job: invalid chronology
    (lambda j:setattr(j.evidence[0],"checked_at",TODAY+timedelta(days=1)),"review"),
    (lambda j:setattr(j.evidence[0],"url","https://www.github.com/unrelated"),"review"),
    (lambda j:setattr(j.commute,"route_assumptions",None),"review"),
])
def test_publication_gates(job, profile, tmp_path, change, expected):
    change(job)
    assert audit(job,profile,TODAY).status == expected
    assert export_public([job],tmp_path/'jobs.json',TODAY,profile) == []


def test_conflicting_sources(job,profile):
    job.evidence.append(job.evidence[0].model_copy(update={"id":"conflict","conclusion":"fail"}))
    assert audit(job,profile,TODAY).status == "review"


def test_old_verified_facts_remain_but_expiring_evidence_does_not(job, profile):
    old = TODAY - timedelta(days=90)
    job.last_checked_at = job.first_seen_at = old
    job.commute.checked_at = old
    for source in job.sources:
        source.checked_at = old
    for evidence in job.evidence:
        evidence.checked_at = old
    assert audit(job, profile, TODAY).status == "eligible"
    job.evidence[0].valid_through = TODAY - timedelta(days=1)
    decision = audit(job, profile, TODAY)
    assert decision.status == "review" and "evidence_expired" in decision.reasons


def test_preferences_are_not_publication_requirements(job, profile):
    job.category = "other"
    job.pay.monthly_base_min_jpy = 150000
    job.workstyle.annual_holidays = 90
    job.workstyle.overtime_hours_month = 40
    job.workstyle.transfer = "yes"
    job.location.remote_policy = "none"
    assert audit(job, profile, TODAY).status == "eligible"


def test_additional_basic_skill_requires_evidence_and_confirmed_attribute(job, profile):
    from collector.models import Requirement
    evidence = job.evidence[0].model_copy(update={'id':'pc', 'field':'pc_basic'})
    job.evidence.append(evidence)
    job.eligibility.requirements.append(Requirement(field='pc_basic', operator='eq', value=True, description='TEST ONLY PC input required', evidence_ids=['pc']))
    assert audit(job, profile, TODAY).status == 'review'
    profile.attributes['pc_basic'] = False
    assert audit(job, profile, TODAY).status == 'rejected'
    profile.attributes['pc_basic'] = True
    assert audit(job, profile, TODAY).status == 'eligible'
    job.evidence.remove(evidence)
    assert audit(job, profile, TODAY).status == 'review'


def test_missing_requirement_evidence(job,profile):
    job.eligibility.requirements[0].evidence_ids = ["not-an-evidence-id"]
    assert audit(job,profile,TODAY).status == "review"


def test_local_route_must_not_invent_minutes(job,profile):
    job.commute.status="local_verified"
    assert audit(job,profile,TODAY).status == "review"
    job.commute.minutes=None
    assert audit(job,profile,TODAY).status == "eligible"


def test_remote_requires_residence_check(job,profile):
    job.commute.status="remote_verified"
    job.location.remote_policy="full"
    assert audit(job,profile,TODAY).status == "review"
    job.location.residence_verified=True
    assert audit(job,profile,TODAY).status == "eligible"


def test_dedupe_preserves_roles_and_catches_conflict(job,profile):
    same = job.model_copy(deep=True)
    same.sources[0].original_url += '?utm_source=test'
    other = job.model_copy(deep=True)
    other.title = "different role"
    merged, count = deduplicate([job,same,other])
    assert len(merged)==2 and count==1
    assert stable_id(job)==stable_id(same)
    same.pay.monthly_base_min_jpy=200000
    merged,_=deduplicate([job,same])
    assert adjudicate(merged[0],profile,TODAY).status == "review"


def test_unsafe_source_and_extra_profile_rejected(job):
    payload=job.model_dump(mode="json")
    payload["applicant_profile"]={"age":22}
    with pytest.raises(ValidationError):
        type(job).model_validate(payload)
    payload.pop("applicant_profile")
    payload["sources"][0]["url"]="javascript:alert(1)"
    with pytest.raises(ValidationError):
        type(job).model_validate(payload)
