import json
from pathlib import Path
import pytest
from conftest import TODAY
from collector.models import PublicData, ReviewData, ReviewCandidate
from collector.export import stable_id
from collector.modes import collect, investigation_queue
from collector.pipeline import write_jsonl, update
from test_pipeline import setup_root


def prepare(root, job=None):
    (root/'web/public').mkdir(parents=True,exist_ok=True)
    (root/'web/public/jobs.json').write_text(PublicData(jobs=[job] if job else []).model_dump_json(),encoding='utf-8')
    (root/'web/public/review-jobs.json').write_text(ReviewData(updated_at=TODAY).model_dump_json(),encoding='utf-8')


def inputs(root,job):
    job.id=stable_id(job)
    path=root/'input.json';path.write_text(json.dumps([job.model_dump(mode='json')]),encoding='utf-8')
    return path


def summary(root,job):
    row=ReviewCandidate(id=job.id,company=job.company,title=job.title,category=job.category,address=job.location.address,url=job.sources[0].url,checked_at=TODAY,status='discovery',stage='discovery',discovery_verified=True,regions=['浜松市浜名区'],reasons=['TEST ONLY qualification and route unknown'],summary='TEST ONLY real-opening minimum check')
    p=root/'summaries.json';p.write_text(json.dumps([row.model_dump(mode='json')]),encoding='utf-8')
    return p


def test_collection_needs_no_profile_and_does_not_adjudicate(tmp_path,job,monkeypatch):
    prepare(tmp_path)
    path=inputs(tmp_path,job)
    def forbidden(*args,**kwargs):raise AssertionError('acquisition called applicant adjudication')
    monkeypatch.setattr('collector.pipeline.adjudicate',forbidden)
    before=(tmp_path/'web/public/jobs.json').read_bytes()
    result=collect(tmp_path,import_path=path,discoveries_path=summary(tmp_path,job),today=TODAY)
    assert result['new_candidates']==result['new_visible']==1
    assert result['detailed_reviews']==0
    assert (tmp_path/'web/public/jobs.json').read_bytes()==before
    raw=json.loads((tmp_path/'data/internal/candidates.jsonl').read_text(encoding='utf-8'))
    assert raw['eligibility']['status']=='review' and not raw['evidence']
    review=json.loads((tmp_path/'web/public/review-jobs.json').read_text(encoding='utf-8'))['candidates'][0]
    assert review['status']=='discovery' and not review['facts']


def test_collection_stages_without_minimum_and_preserves_duplicate_review(tmp_path,job):
    prepare(tmp_path,job)
    path=inputs(tmp_path,job)
    before=(tmp_path/'web/public/jobs.json').read_bytes()
    result=collect(tmp_path,import_path=path,today=TODAY)
    assert result['duplicates']==1 and result['new_candidates']==0
    assert (tmp_path/'web/public/jobs.json').read_bytes()==before
    # A different role at the same company URL is not thrown away.
    job.title+=' SECOND ROLE'
    result=collect(tmp_path,import_path=inputs(tmp_path,job),today=TODAY)
    assert result['new_candidates']==1 and result['new_visible']==0


def test_public_only_checkout_keeps_existing_review_when_new_opening_arrives(tmp_path,job):
    prepare(tmp_path)
    path=inputs(tmp_path,job)
    collect(tmp_path,import_path=path,discoveries_path=summary(tmp_path,job),today=TODAY)
    # Simulate ignored private files missing on a clean GitHub checkout.
    (tmp_path/'data/internal/candidates.jsonl').unlink()
    (tmp_path/'data/internal/public-review.json').unlink()
    job.title+=' NEW'
    result=collect(tmp_path,import_path=inputs(tmp_path,job),discoveries_path=summary(tmp_path,job),today=TODAY)
    assert result['new_visible']==1
    assert len(json.loads((tmp_path/'web/public/review-jobs.json').read_text(encoding='utf-8'))['candidates'])==2


def test_only_explicit_exclusions_and_unknowns_retained(tmp_path,job):
    prepare(tmp_path)
    job.employment_type='contract'
    result=collect(tmp_path,import_path=inputs(tmp_path,job),today=TODAY)
    assert result['excluded']==1 and result['new_candidates']==0
    job.employment_type='unknown';job.title+=' UNKNOWN EMPLOYMENT'
    result=collect(tmp_path,import_path=inputs(tmp_path,job),today=TODAY)
    assert result['excluded']==0 and result['new_candidates']==1


def test_investigation_is_bounded_and_measured_commute_precedes_unknown(tmp_path,job,profile,monkeypatch):
    profile_path=setup_root(tmp_path,profile)
    prepare(tmp_path)
    near=job.model_copy(deep=True);near.title='NEAR';near.id=stable_id(near);near.eligibility.status='review';near.commute.minutes=15;near.commute.status='verified'
    unknown=near.model_copy(deep=True);unknown.title='REFERENCE';unknown.id=stable_id(unknown);unknown.commute.minutes=1;unknown.commute.status='unverified'
    write_jsonl(tmp_path/'data/internal/candidates.jsonl',[j.model_dump(mode='json') for j in [unknown,near]])
    ids=investigation_queue(tmp_path,limit=1)
    assert ids==[near.id]
    import collector.pipeline as pipeline
    real=pipeline.adjudicate;called=[]
    def record(j,*args):
        called.append(j.id)
        return real(j,*args)
    monkeypatch.setattr(pipeline,'adjudicate',record)
    update(tmp_path,profile_path,today=TODAY,review_ids=ids)
    assert called==[near.id]
    with pytest.raises(ValueError,match='ID missing'):
        investigation_queue(tmp_path,ids=['missing'])


def test_cli_defaults_to_collection_without_profile(tmp_path,job,monkeypatch,capsys):
    from collector.__main__ import main
    prepare(tmp_path)
    path=inputs(tmp_path,job)
    monkeypatch.setattr('sys.argv',['collector','update','--root',str(tmp_path),'--import',str(path)])
    main()
    assert json.loads(capsys.readouterr().out)['mode']=='collect'


def test_collection_source_failure_never_claims_published_growth(tmp_path,job,monkeypatch):
    import yaml
    prepare(tmp_path)
    path=inputs(tmp_path,job)
    before=(tmp_path/'web/public/review-jobs.json').read_bytes()
    source=tmp_path/'sources.yaml'
    source.write_text(yaml.safe_dump({'sources':[dict(name='TEST ONLY',url='https://www.python.org/jobs/',allowed_prefixes=['https://www.python.org/jobs/'],mode='jsonld',terms_url='https://www.python.org/')]}),encoding='utf-8')
    def blocked(*args):raise ValueError('TEST ONLY access unavailable')
    monkeypatch.setattr('collector.modes.SafeFetcher.fetch',blocked)
    result=collect(tmp_path,sources_path=source,import_path=path,network=True,discoveries_path=summary(tmp_path,job),today=TODAY)
    assert result['new_visible']==0 and result['proposed_new_visible']==1 and result['public_preserved']
    assert (tmp_path/'web/public/review-jobs.json').read_bytes()==before


def test_detail_import_cannot_overwrite_unselected_records(tmp_path,job,profile):
    profile_path=setup_root(tmp_path,profile)
    path=inputs(tmp_path,job)
    write_jsonl(tmp_path/'data/internal/candidates.jsonl',[job.model_dump(mode='json')])
    before=(tmp_path/'data/internal/candidates.jsonl').read_bytes()
    with pytest.raises(ValueError,match='unselected IDs'):
        update(tmp_path,profile_path,import_path=path,today=TODAY,review_ids=['different'])
    assert (tmp_path/'data/internal/candidates.jsonl').read_bytes()==before

