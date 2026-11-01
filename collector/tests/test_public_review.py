import json
import pytest
from pydantic import ValidationError
from conftest import TODAY
from collector.audit import adjudicate
from collector.models import ReviewCandidate
from collector.public_review import review_payload


def prepare(tmp_path, job):
    path=tmp_path/'data/internal/public-review.json'
    path.parent.mkdir(parents=True)
    candidate=ReviewCandidate(id=job.id,company=job.company,title=job.title,category=job.category,address=job.location.address,url=job.sources[0].url,checked_at=TODAY,stage='detail_review',reasons=['TEST ONLY needs location check'],summary='TEST ONLY public-safe review summary')
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
