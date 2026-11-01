import json
from datetime import timedelta
import pytest
from pydantic import ValidationError
from conftest import TODAY
from collector.audit import adjudicate
from collector.models import ReviewCandidate, ReviewFact, ReviewData
from collector.public_review import review_payload, validate_review


def prepare(tmp_path, job):
    path=tmp_path/'data/internal/public-review.json'
    path.parent.mkdir(parents=True)
    candidate=ReviewCandidate(id=job.id,company=job.company,title=job.title,category=job.category,address=job.location.address,url=job.sources[0].url,checked_at=TODAY,stage='detail_review',reasons=['TEST ONLY needs location check'],summary='TEST ONLY public-safe review summary',facts=[f.model_copy() for f in job.listing_facts])
    path.write_text(json.dumps([candidate.model_dump(mode='json')]),encoding='utf-8')
    return path,candidate


def test_only_curated_review_fields_are_exported(tmp_path, job, profile):
    job.evidence[0].notes='PRIVATE APPLICANT DETAIL'
    job.location.is_fixed=False
    adjudicate(job,profile,TODAY)
    prepare(tmp_path,job)
    result=review_payload(tmp_path,[job],TODAY)
    assert len(result.candidates)==1
    assert 'PRIVATE APPLICANT DETAIL' not in result.model_dump_json()
    assert 'eligibility' not in result.model_dump_json()
    job.recruitment.status='closed'
    assert not review_payload(tmp_path,[job],TODAY).candidates


def test_review_cannot_duplicate_verified_or_spoof_original(tmp_path,job):
    path,candidate=prepare(tmp_path,job)
    assert not review_payload(tmp_path,[job],TODAY).candidates
    job.eligibility.status='review'
    candidate.company='TEST ONLY WRONG EMPLOYER'
    path.write_text(json.dumps([candidate.model_dump(mode='json')]),encoding='utf-8')
    with pytest.raises(ValueError,match='source_mismatch'):review_payload(tmp_path,[job],TODAY)


def test_unreviewed_private_records_are_not_automatically_published(tmp_path,job):
    job.eligibility.status='review'
    assert not review_payload(tmp_path,[job],TODAY).candidates
    _,candidate=prepare(tmp_path,job)
    with pytest.raises(ValidationError):
        ReviewCandidate.model_validate({**candidate.model_dump(), 'profile':{'age':23}})


def test_review_facts_require_registered_source_and_keep_qualification_pending(tmp_path,job):
    job.eligibility.status='review'
    path,candidate=prepare(tmp_path,job)
    candidate.facts[0].text='TEST ONLY monthly 200000 including allowances'
    path.write_text(json.dumps([candidate.model_dump(mode='json')]),encoding='utf-8')
    result=review_payload(tmp_path,[job],TODAY)
    assert result.candidates[0].facts[0].field=='salary'
    assert job.eligibility.status=='review'
    candidate.facts[0].url='https://www.python.org/unrelated'
    path.write_text(json.dumps([candidate.model_dump(mode='json')]),encoding='utf-8')
    with pytest.raises(ValueError,match='fact_source_mismatch'):review_payload(tmp_path,[job],TODAY)


def test_review_fact_date_and_duplicate_field_are_rejected(tmp_path,job):
    _,candidate=prepare(tmp_path,job)
    fact=ReviewFact(field='salary',text='TEST ONLY salary',url=job.sources[0].url,checked_at=TODAY+timedelta(days=1))
    candidate.facts=[fact]
    with pytest.raises(ValueError,match='invalid_review_facts'):validate_review(ReviewData(updated_at=TODAY,candidates=[candidate]),TODAY)
    fact.checked_at=TODAY
    candidate.facts=[fact,fact.model_copy()]
    with pytest.raises(ValueError,match='invalid_review_facts'):validate_review(ReviewData(updated_at=TODAY,candidates=[candidate]),TODAY)


@pytest.mark.parametrize("field", ["salary", "location", "employment", "holidays", "hours"])
def test_incomplete_conditions_stay_private(tmp_path,job,field):
    job.eligibility.status="review"
    path,candidate=prepare(tmp_path,job)
    candidate.facts= [f for f in candidate.facts if f.field != field]
    path.write_text(json.dumps([candidate.model_dump(mode="json")]),encoding="utf-8")
    assert not review_payload(tmp_path,[job],TODAY).candidates
    with pytest.raises(ValueError,match="incomplete_listing"):
        validate_review(ReviewData(updated_at=TODAY,candidates=[candidate]),TODAY)


def test_unknown_conditions_are_not_confirmed_by_presence(tmp_path,job):
    job.eligibility.status="review"
    path,candidate=prepare(tmp_path,job)
    candidate.facts[0].confirmed=False
    path.write_text(json.dumps([candidate.model_dump(mode="json")]),encoding="utf-8")
    assert not review_payload(tmp_path,[job],TODAY).candidates


@pytest.mark.parametrize("field", ["salary", "location", "employment", "holidays", "hours"])
def test_verified_export_requires_five_conditions(job,profile,field):
    from collector.export import public_payload
    assert len(public_payload([job],TODAY,profile).jobs)==1
    job.listing_facts=[f for f in job.listing_facts if f.field!=field]
    assert not public_payload([job],TODAY,profile).jobs
