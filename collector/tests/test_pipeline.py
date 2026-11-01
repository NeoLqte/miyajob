import json
from pathlib import Path

import httpx
import pytest
import yaml

from collector.adapters import extract_jsonld, extract_html, discover_links, import_records
from collector.fetch import SourcePolicy, SafeFetcher, authorized
from collector.models import PublicData
from collector.pipeline import update
from conftest import TODAY


def test_jsonld_never_marks_active_or_eligible():
    html='<script type="application/ld+json">'+json.dumps({"@graph":[{"@type":"JobPosting","title":"TEST ONLY","hiringOrganization":{"name":"TEST ONLY"},"description":"<b>未経験歓迎</b>","jobLocation":{"address":{"addressLocality":"TEST ONLY"}}}]})+'</script>'
    job=extract_jsonld(html,"https://www.python.org/jobs/",TODAY)[0]
    assert job.eligibility.status=="review" and job.recruitment.status=="unverified"
    assert not job.evidence and '<b>' not in job.description


def test_html_csv_and_company_discovery_are_only_candidates():
    rows=extract_html('<article><b>TEST</b><h2>TEST ROLE</h2><address>TEST ADDRESS</address></article>',"https://www.python.org/jobs/",TODAY,{"item":"article","company":"b","title":"h2","address":"address"})
    assert rows[0].eligibility.status=="review"
    rows=import_records('company,title,address,url\nTEST,ROLE,ADDRESS,https://www.python.org/jobs/\n','csv',TODAY)
    assert rows[0].eligibility.status=="review"
    assert discover_links('<a href="/careers">採用情報</a><a href="/about">企業概要</a>','https://www.python.org/')==['https://www.python.org/careers']
    assert discover_links('<ul class="companies"><li><a href="https://www.python.org/">TEST COMPANY</a></li></ul>', 'https://www.python.org/jobs/', '.companies a') == ['https://www.python.org/']


def setup_root(tmp_path,profile):
    (tmp_path/'web/public').mkdir(parents=True)
    (tmp_path/'web/public/jobs.json').write_text(PublicData().model_dump_json(),encoding='utf-8')
    path=tmp_path/'profile.yaml'
    path.write_text(yaml.safe_dump(profile.model_dump()),encoding='utf-8')
    return path


def test_local_update_and_private_report(tmp_path,job,profile):
    profile_path=setup_root(tmp_path,profile)
    imported=tmp_path/'input.json'
    imported.write_text(json.dumps([job.model_dump(mode='json')]),encoding='utf-8')
    result=update(tmp_path,profile_path,import_path=imported,today=TODAY)
    assert result['published']==1 and result['mode']=='local_only'
    assert (tmp_path/'data/internal/candidates.jsonl').exists()
    assert '外部収集なし' in (tmp_path/f'reports/private/{TODAY}.md').read_text(encoding='utf-8')


def test_no_input_does_not_pretend_collection(tmp_path,profile):
    profile_path=setup_root(tmp_path,profile)
    before=(tmp_path/'web/public/jobs.json').read_bytes()
    with pytest.raises(ValueError,match='no_input'):
        update(tmp_path,profile_path,today=TODAY)
    assert (tmp_path/'web/public/jobs.json').read_bytes()==before


def test_network_failure_preserves_public_bytes(tmp_path,profile,monkeypatch):
    profile_path=setup_root(tmp_path,profile)
    sources=tmp_path/'sources.yaml'
    sources.write_text(yaml.safe_dump({'sources':[{'name':'TEST','url':'https://www.python.org/jobs/','allowed_prefixes':['https://www.python.org/jobs/'],'mode':'jsonld','terms_url':'https://www.python.org/'}]}))
    def fail(*_):raise httpx.ConnectError('offline')
    monkeypatch.setattr(SafeFetcher,'fetch',fail)
    before=(tmp_path/'web/public/jobs.json').read_bytes()
    result=update(tmp_path,profile_path,sources_path=sources,network=True,today=TODAY)
    assert result['errors']==1 and result['public_preserved']
    assert (tmp_path/'web/public/jobs.json').read_bytes()==before


def test_report_failure_preserves_public_bytes(tmp_path,profile,job,monkeypatch):
    profile_path=setup_root(tmp_path,profile)
    imported=tmp_path/'input.json'
    imported.write_text(json.dumps([job.model_dump(mode='json')]),encoding='utf-8')
    before=(tmp_path/'web/public/jobs.json').read_bytes()
    original=Path.write_text
    def fail_report(path,*args,**kwargs):
        if path.suffix=='.md':raise OSError('TEST ONLY write failure')
        return original(path,*args,**kwargs)
    monkeypatch.setattr(Path,'write_text',fail_report)
    with pytest.raises(OSError):
        update(tmp_path,profile_path,import_path=imported,today=TODAY)
    assert (tmp_path/'web/public/jobs.json').read_bytes()==before


def test_permission_scope():
    policy=SourcePolicy(name='TEST',url='https://www.python.org/jobs/',allowed_prefixes=['https://www.python.org/jobs/'],terms_url='https://www.python.org/')
    with pytest.raises(ValueError,match='outside_approved_scope'):
        authorized('https://www.python.org/jobs-secret',policy)
    with pytest.raises(ValueError,match='automation_permission_not_verified'):
        SafeFetcher({}).fetch(policy)


@pytest.mark.parametrize('robots,status,reason',[('User-agent: *\nDisallow: /',200,'robots_disallowed'),('',403,'403'),('',302,'302')])
def test_robots_fail_closed(robots,status,reason,monkeypatch):
    monkeypatch.setattr('collector.fetch.public_host',lambda _:None)
    calls=[]
    def handle(request):
        calls.append(str(request.url))
        return httpx.Response(status,text=robots)
    policy=SourcePolicy(name='TEST',url='https://www.python.org/jobs/',allowed_prefixes=['https://www.python.org/jobs/'],terms_url='https://www.python.org/',automated_access_allowed=True,permission_notes='TEST ONLY permission',terms_checked_at=str(TODAY))
    client=httpx.Client(transport=httpx.MockTransport(handle))
    with pytest.raises(Exception,match=reason):
        SafeFetcher({},client=client,sleep=lambda _:None).fetch(policy)
    assert calls==['https://www.python.org/robots.txt']
