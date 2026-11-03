from collector.audit import audit
from collector.recruitment_policy import career_excluded
from conftest import TODAY


def test_career_scope_overrides_otherwise_eligible_unexperienced_role(job,profile):
    job.recruitment_track='中途・未経験者'
    result=audit(job,profile,TODAY)
    assert result.status=='rejected'
    assert 'career_recruitment_out_of_scope' in result.reasons


def test_unknown_or_year_round_is_not_career_and_graduate_role_is_separate(job):
    job.recruitment_track='unknown'
    job.title='通年新卒・既卒枠'
    assert not career_excluded(job)
    job.title='一般IT募集'
    job.recruitment_track='通年採用'
    assert not career_excluded(job)
    job.recruitment_track='career'
    assert career_excluded(job)

