import json

from conftest import TODAY
from collector.audit import adjudicate
from collector.review import report, priority


def test_report_separates_discovery_from_verification_and_keeps_notes_private(job, profile, tmp_path):
    internal = tmp_path / 'data/internal'
    internal.mkdir(parents=True)
    pending = job.model_copy(deep=True)
    pending.id = 'pending'
    pending.company = 'TEST ONLY DISCOVERY'
    pending.category = 'internal_it'
    pending.location.address = 'TEST ONLY 宮口'
    pending.evidence = []
    adjudicate(pending, profile, TODAY)
    jobs = [job, pending]
    (internal / 'candidates.jsonl').write_text('\n'.join(j.model_dump_json() for j in jobs), encoding='utf-8')
    (internal / 'research-ledger.json').write_text(json.dumps([{'id':'pending', 'stage':'listing_review'}]), encoding='utf-8')
    result = report(tmp_path, TODAY, profile)
    assert (result['candidate_total'], result['published'], result['review']) == (2, 1, 1)
    assert result['research_stages'] == {'unrecorded':1, 'listing_review':1}
    assert priority(pending) < priority(job)
    assert (tmp_path / f'reports/private/triage-{TODAY}.md').exists()
    assert not (tmp_path / 'web').exists()
