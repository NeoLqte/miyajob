import json
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

import yaml

from .adapters import extract_jsonld, extract_html, import_records, discover_links
from .audit import adjudicate
from .export import atomic_json, deduplicate, public_payload, stable_id
from .fetch import SafeFetcher, SourcePolicy
from .models import Job, Profile, PublicData


def jsonl(path: Path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    temp.replace(path)


def update(root: Path, profile_path: Path, sources_path: Path | None = None, import_path: Path | None = None, network=False, today=None):
    today = today or date.today()
    profile = Profile.model_validate(yaml.safe_load(profile_path.read_text(encoding="utf-8-sig")))
    internal = root / "data/internal"
    internal.mkdir(parents=True, exist_ok=True)
    public = root / "web/public/jobs.json"
    previous = PublicData.model_validate_json(public.read_text(encoding="utf-8"))
    candidates = [Job.model_validate(row) for row in jsonl(internal / "candidates.jsonl")]
    errors, leads, confirmed_companies = [], [], set()
    discovered = 0
    if import_path:
        imported = import_records(import_path.read_text(encoding="utf-8-sig"), import_path.suffix.lstrip("."), today)
        # Explicit reviewed import replaces the previous version of the same stable key.
        incoming = {stable_id(j): j for j in imported}
        candidates = [j for j in candidates if stable_id(j) not in incoming] + list(incoming.values())
        discovered += len(imported)
        confirmed_companies.update(j.company for j in imported if any(e.field == "existence" and e.method == "official_page" and e.conclusion == "pass" for e in j.evidence))
    history_path = internal / "fetch-history.json"
    history = json.loads(history_path.read_text(encoding="utf-8")) if history_path.exists() else {}
    if network:
        if not sources_path:
            raise ValueError("network mode requires --sources with reviewed permissions")
        config = yaml.safe_load(sources_path.read_text(encoding="utf-8-sig"))
        policies = [SourcePolicy.model_validate(s) for s in config.get("sources", [])]
        if not policies:
            raise ValueError("no_approved_sources")
        fetcher = SafeFetcher(history)
        try:
            for policy in policies:
                if policy.mode == "manual":
                    continue
                try:
                    content = fetcher.fetch(policy)
                    if policy.mode == "discovery":
                        leads.extend({"url": u, "discovered_from": policy.url, "status": "company_or_recruitment_lead", "checked_at": str(today)} for u in discover_links(content, policy.url, policy.selectors.get("links")))
                    else:
                        if policy.mode == "jsonld":
                            found = extract_jsonld(content, policy.url, today)
                        elif policy.mode == "html":
                            found = extract_html(content, policy.url, today, policy.selectors)
                        elif policy.mode in ("json", "csv"):
                            found = import_records(content, policy.mode, today)
                        else:
                            raise ValueError("unsupported_adapter")
                        if not found:
                            raise ValueError("no_postings_extracted; not_treated_as_closed")
                        # Network extraction cannot inject audited records or overwrite reviewed facts.
                        for job in found:
                            job.eligibility.status = "review"
                            job.eligibility.requirements = []
                            job.evidence = []
                            for source in job.sources:
                                source.kind = policy.kind
                        discovered += len(found)
                        candidates.extend(found)
                        if any(s.kind == "official" for j in found for s in j.sources):
                            confirmed_companies.update(j.company for j in found)
                except Exception as exc:
                    errors.append({"url": policy.url, "reason": type(exc).__name__ + ": " + str(exc)[:160]})
        finally:
            fetcher.close()
            atomic_json(history_path, history)
    if not network and not import_path and not candidates:
        raise ValueError("no_input: collection not performed; public data unchanged")
    merged, duplicates = deduplicate(candidates)
    decisions = [(j, adjudicate(j, profile, today)) for j in merged]
    write_jsonl(internal / "candidates.jsonl", [j.model_dump(mode="json") for j, _ in decisions])
    write_jsonl(internal / "review.jsonl", [{"job":j.model_dump(mode="json"),"reasons":d.reasons} for j,d in decisions if d.status == "review"])
    write_jsonl(internal / "rejected.jsonl", [{"job":j.model_dump(mode="json"),"reasons":d.reasons} for j,d in decisions if d.status == "rejected"])
    if leads:
        existing = {r["url"]:r for r in jsonl(internal / "leads.jsonl")}
        existing.update({r["url"]:r for r in leads})
        write_jsonl(internal / "leads.jsonl", list(existing.values()))
    # Any fetch error preserves the entire previous export byte for byte.
    proposal = public_payload(merged, today, profile)
    accepted = previous.jobs if errors else proposal.jobs
    old = {j.id:j.model_dump(mode="json") for j in previous.jobs}
    new = {j.id:j.model_dump(mode="json") for j in accepted}
    counts = Counter(d.status for _,d in decisions)
    reasons = Counter(reason for _,d in decisions for reason in d.reasons)
    lines = [f"# 更新レポート {today}", "", f"実行モード: {'許可済み外部取得' if network else 'ローカル登録・再審査（外部収集なし）'}", f"候補入力数: {discovered}", f"企業・採用ページの発見リンク数: {len(leads)}", f"公式採用HPから求人候補を抽出した企業数: {len(confirmed_companies)}", f"公開件数: {len(accepted)}", f"公開候補の職種内訳: {dict(Counter(j.category for j in accepted))}", f"保留: {counts['review']} / 除外: {counts['rejected']} / 重複統合: {duplicates}", f"30日以上未確認: {sum(today-j.last_checked_at>=timedelta(days=30) for j in accepted)}", f"新規: {len(new.keys()-old.keys())} / 変更: {sum(new[k]!=old[k] for k in new.keys()&old.keys())} / 掲載取り下げ（終了断定ではない）: {len(old.keys()-new.keys())}", f"取得失敗: {len(errors)}", f"前回の公開ファイルを保持: {'はい' if errors else 'いいえ'}", "", "## 判定理由", *[f"- {k}: {v}" for k,v in sorted(reasons.items())], "", "## 取得失敗", *[f"- {e['url']}: {e['reason']}" for e in errors], "", "## 候補URL", *[f"- {s.url}" for j in merged for s in j.sources]]
    report = root / f"reports/private/{today}.md"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    # Final commit point: every extraction, audit, private write and report succeeded.
    if not errors:
        atomic_json(public, proposal.model_dump(mode="json"))
    return {"published":len(accepted),"review":counts["review"],"rejected":counts["rejected"],"errors":len(errors),"public_preserved":bool(errors),"mode":"network" if network else "local_only"}
