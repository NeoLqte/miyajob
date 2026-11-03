"""Publication scope preference, independent of legal/applicant eligibility."""
import json
import re
from pathlib import Path
POLICY = json.loads((Path(__file__).resolve().parents[3] / 'config/recruitment-policy.json').read_text(encoding='utf-8'))


def career_excluded(job):
    if not POLICY['exclude_career']:
        return False
    if job.id in POLICY['excluded_ids']:
        return True
    track = job.recruitment_track
    if re.search(r'中途|キャリア|^career$|^mid[-_]career$', track, re.I) and not re.search(r'新卒', track):
        return True
    if re.search(r'（中途|中途採用|キャリア採用|キャリア・', job.title):
        return True
    # A separate graduate role is not suppressed by its employer's career links.
    if re.search(r'新卒', job.title):
        return False
    return any(s.url.startswith(prefix) for s in job.sources for prefix in POLICY['career_source_prefixes'])

