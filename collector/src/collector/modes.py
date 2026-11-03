"""Acquisition only: preserve audited records and stage new, unverified openings."""
import json
from datetime import date
from pathlib import Path
import yaml

from .adapters import discover_links, extract_html, extract_jsonld, import_records, normalize_url, draft
from .export import atomic_json, stable_id
from .fetch import SafeFetcher, SourcePolicy
from .models import Job, ReviewCandidate, IT_CATEGORIES, PublicData, ReviewData, Source
from .public_review import review_payload
from .recruitment_policy import career_excluded


def collect(root: Path, sources_path=None, import_path=None, network=False, discoveries_path=None, today=None):
    # No profile is loaded, no applicant adjudication or route measurement is run.
    from .pipeline import jsonl, write_jsonl
    today = today or date.today()
    internal = root / 'data/internal'
    existing = [Job.model_validate(r) for r in jsonl(internal / 'candidates.jsonl')]
    # Public-only CI checkouts must not erase candidates whose private originals
    # intentionally are not in Git. Reconstruct conservative discovery drafts,
    # never their private eligibility or applicant information.
    public_jobs = PublicData.model_validate_json((root / 'web/public/jobs.json').read_text(encoding='utf-8')).jobs
    seen_ids = {j.id for j in existing}
    existing.extend(j for j in public_jobs if j.id not in seen_ids)
    seen_ids.update(j.id for j in public_jobs)
    previous_path = root / 'web/public/review-jobs.json'
    public_reviews = ReviewData.model_validate_json(previous_path.read_text(encoding='utf-8')).candidates if previous_path.exists() else []
    for r in public_reviews:
        if r.id in seen_ids:
            continue
        j = draft(r.company,r.title,r.address,r.url,r.checked_at)
        j.id=r.id; j.category=r.category; j.recruitment.valid_through=r.valid_through
        dates={r.url:r.checked_at}
        for f in [*r.facts,*r.screening]:
            dates[f.url]=max(dates.get(f.url,f.checked_at),f.checked_at)
        j.sources=[Source(url=u,original_url=u,kind='other',checked_at=d) for u,d in dates.items()]
        existing.append(j);seen_ids.add(j.id)
    incoming, leads, errors = [], [], []
    if import_path:
        incoming.extend(import_records(import_path.read_text(encoding='utf-8-sig'), import_path.suffix.lstrip('.'), today))
    if network:
        if not sources_path:
            raise ValueError('network mode requires --sources with reviewed permissions')
        policies = [SourcePolicy.model_validate(s) for s in (yaml.safe_load(sources_path.read_text(encoding='utf-8-sig')) or {}).get('sources', [])]
        if not policies:
            raise ValueError('no_approved_sources')
        history_path = internal / 'fetch-history.json'
        history = json.loads(history_path.read_text(encoding='utf-8')) if history_path.exists() else {}
        fetcher = SafeFetcher(history)
        try:
            for policy in policies:
                if policy.mode == 'manual':
                    leads.append(dict(url=policy.url, status='manual_confirmation_required', checked_at=str(today)))
                    continue
                try:
                    content = fetcher.fetch(policy)
                    if policy.mode == 'discovery':
                        leads.extend(dict(url=u, discovered_from=policy.url, status='company_or_recruitment_lead', checked_at=str(today)) for u in discover_links(content, policy.url, policy.selectors.get('links')))
                        continue
                    found = (extract_jsonld(content, policy.url, today) if policy.mode == 'jsonld'
                             else extract_html(content, policy.url, today, policy.selectors) if policy.mode == 'html'
                             else import_records(content, policy.mode, today))
                    if not found:
                        raise ValueError('no_postings_extracted; not_treated_as_closed')
                    for j in found:
                        for s in j.sources:
                            s.kind = policy.kind
                    incoming.extend(found)
                except Exception as exc:
                    errors.append(dict(url=policy.url, reason=type(exc).__name__, status='manual_confirmation_required'))
        finally:
            fetcher.close()
            atomic_json(history_path, history)
    summaries = []
    if discoveries_path:
        summaries = [ReviewCandidate.model_validate(r) for r in json.loads(discoveries_path.read_text(encoding='utf-8-sig'))]
        if any(r.status != 'discovery' or r.stage != 'discovery' or not r.discovery_verified or not r.regions for r in summaries):
            raise ValueError('collection requires explicit discovery minimum checks')
    # Matching source URLs catches rediscovery after title/address edits. An explicit
    # different title on the same employer page remains a separate role.
    kept = {stable_id(j): j for j in existing}
    url_keys = {(j.company, j.title, normalize_url(s.url)) for j in existing for s in j.sources}
    staged = {r['id']: r for r in jsonl(internal / 'collection-staging.jsonl')}
    duplicates = excluded = added = 0
    observations = jsonl(internal / 'duplicate-observations.jsonl')
    new_ids = set()
    for j in incoming:
        key = stable_id(j)
        if key in kept or any((j.company, j.title, normalize_url(s.url)) in url_keys for s in j.sources):
            duplicates += 1
            observations.append(dict(id=key, checked_at=str(today), status='duplicate_requires_no_new_listing', job=j.model_dump(mode='json')))
            continue  # Never overwrite, demote or update a reviewed record's dates.
        # Only explicit facts may exclude; unknown employment/skills stay staged.
        reason = ('career_recruitment_out_of_scope' if career_excluded(j) else 'closed_or_expired' if j.recruitment.status == 'closed' or j.recruitment.valid_through and j.recruitment.valid_through < today
                  else 'non_regular_employment' if j.employment_type in ('contract', 'part_time')
                  else 'non_it' if j.category not in (*IT_CATEGORIES, 'other') else None)
        j.id = key
        # An import in acquisition mode cannot assert applicant eligibility.
        j.eligibility.status = 'review'
        j.eligibility.requirements = []
        j.evidence = []
        if reason:
            staged[key] = dict(id=key, job=j.model_dump(mode='json'), status='excluded', reason=reason)
            excluded += 1
            continue
        kept[key] = j
        new_ids.add(key)
        url_keys.update((j.company, j.title, normalize_url(s.url)) for s in j.sources)
        staged[key] = dict(id=key, job=j.model_dump(mode='json'), status='minimum_check_required')
        added += 1
    if not incoming and not summaries and not network:
        raise ValueError('no_input: collection not performed; public data unchanged')
    curated_path = internal / 'public-review.json'
    previous_curated = json.loads(curated_path.read_text(encoding='utf-8')) if curated_path.exists() else [r.model_dump(mode='json') for r in public_reviews]
    curated = {r['id']: r for r in previous_curated}
    known = {j.id: j for j in kept.values()}
    for r in summaries:
        if r.id in curated or r.id not in known:
            continue  # Existing statuses belong to investigation mode.
        j = known[r.id]
        if j.category == 'other':
            j.category = r.category  # explicit, authored IT minimum check
        if (r.company, r.title, r.category) != (j.company, j.title, j.category):
            raise ValueError('discovery_summary_source_mismatch')
        curated[r.id] = r.model_dump(mode='json')
    # Save collection work before publication; acquisition never writes jobs.json.
    write_jsonl(internal / 'candidates.jsonl', [j.model_dump(mode='json') for j in kept.values()])
    write_jsonl(internal / 'collection-staging.jsonl', list(staged.values()))
    if observations:
        write_jsonl(internal / 'duplicate-observations.jsonl', observations)
    if leads or errors:
        old_leads = {r['url']: r for r in jsonl(internal / 'leads.jsonl')}
        old_leads.update({r['url']: r for r in [*leads, *errors]})
        write_jsonl(internal / 'leads.jsonl', list(old_leads.values()))
    before = curated_path.read_bytes() if curated_path.exists() else None
    try:
        atomic_json(curated_path, list(curated.values()))
        proposal = review_payload(root, list(kept.values()), today)
        visible = {r.id for r in proposal.candidates}
        # A supplied minimum check must pass every existing provenance guard.
        if any(r.id in curated and r.id not in visible and r.id in new_ids for r in summaries):
            raise ValueError('discovery_minimum_not_satisfied')
        report = dict(mode='collect', input=len(incoming), new_candidates=added, duplicates=duplicates,
                      excluded=excluded, new_visible=0 if errors else len(visible - {r.id for r in public_reviews}),
                      proposed_new_visible=len(visible - {r.id for r in public_reviews}),
                      source_errors=len(errors), leads=len(leads), detailed_reviews=0,
                      verified_unchanged=True, public_preserved=bool(errors))
        atomic_json(root / f'reports/private/collection-{today}.json', report)
        if not errors:
            atomic_json(root / 'web/public/review-jobs.json', proposal.model_dump(mode='json'))
    except Exception:
        if before is not None:
            curated_path.write_bytes(before)
        else:
            curated_path.unlink(missing_ok=True)
        raise
    return report


def investigation_queue(root: Path, limit=10, ids=None):
    """Select known measured commutes first; never estimate distance from city names."""
    from .pipeline import jsonl
    from .review import priority
    jobs = [Job.model_validate(r) for r in jsonl(root / 'data/internal/candidates.jsonl')]
    selected = [j for j in jobs if j.eligibility.status == 'review' and (not ids or j.id in ids)]
    if ids and set(ids) - {j.id for j in selected}:
        raise ValueError('investigation ID missing or not pending')
    selected.sort(key=lambda j: (j.commute.minutes if j.commute.status == 'verified' and j.commute.minutes is not None else float('inf'), priority(j), j.first_seen_at, j.id))
    return [j.id for j in selected[:limit]]

