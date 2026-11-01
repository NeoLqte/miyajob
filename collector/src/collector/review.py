"""Private, reproducible triage. Discovery is never equivalent to verification."""
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
import json
import re

from .audit import audit
from .models import Job, Profile


def reason_groups(reasons):
    groups = set()
    for reason in reasons:
        if any(s in reason for s in ('requirement', 'applicant', 'eligibility', 'requirements_complete', 'evidence_expired')):
            groups.add('応募資格・必須条件')
        if any(s in reason for s in ('recruitment', 'future_posting')):
            groups.add('募集状況・期限')
        if 'location' in reason or 'residence' in reason:
            groups.add('勤務地・配属')
        if any(s in reason for s in ('route', 'commute', 'local_estimate')):
            groups.add('通勤')
        if 'employment' in reason or 'regular' in reason:
            groups.add('雇用形態・就業歴')
    if reasons and not groups:
        groups.add('証拠・整合性')
    return sorted(groups)


def priority(job):
    """Order human work, never relax publication to achieve a count."""
    address = job.location.address
    area = 1 if re.search('宮口|新原|尾野|小林|浜北', address) else 2 if re.search('都田|染地台|細江|三方原|東三方', address) else 3
    it = job.category in ('software', 'infrastructure', 'internal_it', 'it_support')
    return (not it, area, job.company, job.title)


def report(root: Path, today: date, profile: Profile | None = None):
    path = root / 'data/internal/candidates.jsonl'
    jobs = [Job.model_validate_json(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]
    counts = Counter(j.eligibility.status for j in jobs)
    groups = Counter(g for j in jobs if j.eligibility.status == 'review' for g in reason_groups(audit(j, profile, today).reasons))
    stale = [j.id for j in jobs if any(today-d > timedelta(days=30) for d in [j.last_checked_at, *(s.checked_at for s in j.sources), *(e.checked_at for e in j.evidence), *([j.commute.checked_at] if j.commute.checked_at else [])])]
    ledger_path = root / 'data/internal/research-ledger.json'
    ledger = json.loads(ledger_path.read_text(encoding='utf-8')) if ledger_path.exists() else []
    stages = {row['id']:row['stage'] for row in ledger}
    stage_counts = Counter(stages.get(j.id, 'unrecorded') for j in jobs)
    official = sum(bool(j.sources) and j.sources[0].kind == 'official' for j in jobs)
    result = {'candidate_total':len(jobs), 'published':counts['eligible'], 'review':counts['review'], 'rejected':counts['rejected'], 'official_discovered':official, 'research_stages':dict(stage_counts), 'review_groups_nonexclusive':dict(groups), 'needs_recheck':stale}
    lines = [f'# 求人審査台帳 {today}', '', '候補は募集枠単位。企業リンク・検索結果件数とは別集計。eligible以外は公開しない。', '', f'候補 {len(jobs)} / 掲載可能 {counts["eligible"]} / 保留 {counts["review"]} / 除外 {counts["rejected"]}', '', '分類は重複あり：'+str(dict(groups)), '', '## 個別判定・次の確認', '']
    for j in sorted(jobs, key=priority):
        d = audit(j, profile, today)
        notes = list(dict.fromkeys(e.notes for e in j.evidence if e.notes))
        lines += [f'### {j.company}：{j.title}', f'- 判定：{j.eligibility.status}', '- 調査段階：'+stages.get(j.id,'unrecorded'), '- 分類：'+('、'.join(reason_groups(d.reasons)) or '確認済み'), '- 次の確認・経緯：'+(' / '.join(notes) or ('全必須根拠を監査済み。更新時は募集継続と期限を再確認。' if not d.reasons else '募集要項全文、採用区分、勤務地、通勤の根拠を追加確認。')), '- 機械判定：'+(', '.join(d.reasons) or 'pass'), *[f'- 原典：{s.url}（確認 {s.checked_at}）' for s in j.sources], '']
    target = root / f'reports/private/triage-{today}.md'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text('\n'.join(lines), encoding='utf-8')
    (target.with_suffix('.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return result
