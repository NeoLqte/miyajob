"""Extraction produces review candidates, never applicant suitability claims."""
import csv
import hashlib
import io
import json
from datetime import date
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode

from bs4 import BeautifulSoup

from .models import Job, Source, Location, Recruitment


def normalize_url(url: str) -> str:
    p = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(p.query) if not k.startswith("utm_") and k not in ("fbclid", "gclid")]
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path or "/", urlencode(sorted(query)), ""))


def plain(value) -> str:
    return BeautifulSoup(str(value or ""), "html.parser").get_text(" ", strip=True)


def draft(company: str, title: str, address: str, url: str, today: date, kind="official", description="") -> Job:
    canonical = normalize_url(url)
    return Job(id=hashlib.sha256(f"{company}|{title}|{address}|unknown".encode()).hexdigest()[:20],
               company=company or "企業名未確認", employer=company or "雇用主未確認", title=title or "募集職種未確認",
               recruitment_track="unknown", description=plain(description)[:1200],
               location=Location(address=address), first_seen_at=today, last_checked_at=today,
               sources=[Source(url=canonical, original_url=url, kind=kind, checked_at=today)])


def walk_json(value):
    if isinstance(value, list):
        for item in value:
            yield from walk_json(item)
    elif isinstance(value, dict):
        types = value.get("@type", [])
        if types == "JobPosting" or isinstance(types, list) and "JobPosting" in types:
            yield value
        for key in ("@graph", "itemListElement", "item"):
            if key in value:
                yield from walk_json(value[key])


def extract_jsonld(html: str, url: str, today: date) -> list[Job]:
    soup = BeautifulSoup(html, "html.parser")
    output = []
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            content = json.loads(script.string or script.get_text())
        except (json.JSONDecodeError, TypeError) as exc:
            raise ValueError("invalid_jsonld") from exc
        for item in walk_json(content):
            org = item.get("hiringOrganization") or {}
            locs = item.get("jobLocation") or []
            if not isinstance(locs, list):
                locs = [locs]
            addresses = []
            for loc in locs:
                address = loc.get("address", {}) if isinstance(loc, dict) else {}
                addresses.append("".join(str(address.get(k, "")) for k in ("addressRegion", "addressLocality", "streetAddress")) if isinstance(address, dict) else str(address))
            job = draft(org.get("name", "") if isinstance(org, dict) else str(org), plain(item.get("title")), " / ".join(addresses), url, today, description=item.get("description", ""))
            # These values are extraction hints. No active/eligible/evidence is inferred.
            if item.get("validThrough"):
                job.recruitment = Recruitment(valid_through=date.fromisoformat(item["validThrough"][:10]))
            if item.get("datePosted"):
                job.recruitment.date_posted = date.fromisoformat(item["datePosted"][:10])
            output.append(job)
    return output


def extract_html(html: str, url: str, today: date, selectors: dict) -> list[Job]:
    soup = BeautifulSoup(html, "html.parser")
    if not all(k in selectors for k in ("item", "company", "title", "address")):
        raise ValueError("html_selectors_required")
    output = []
    for row in soup.select(selectors["item"]):
        def get(field):
            node = row.select_one(selectors[field]) if selectors.get(field) else None
            return node.get_text(" ", strip=True) if node else ""
        output.append(draft(get("company"), get("title"), get("address"), url, today, description=get("description")))
    return output


def import_records(content: str, mode: str, today: date) -> list[Job]:
    if mode == "csv":
        rows = list(csv.DictReader(io.StringIO(content)))
    else:
        value = json.loads(content)
        rows = value if isinstance(value, list) else value.get("jobs", [])
    output = []
    for row in rows:
        if mode == "json" and "eligibility" in row:
            output.append(Job.model_validate(row))
        else:
            output.append(draft(row.get("company", ""), row.get("title", ""), row.get("address", ""), row["url"], today, row.get("kind", "official"), row.get("description", "")))
    return output


def discover_links(html: str, url: str, selector: str | None = None) -> list[str]:
    # Company directories are discovery leads only; never create jobs from them.
    soup = BeautifulSoup(html, "html.parser")
    found = set()
    for link in soup.select(selector or "a[href]"):
        if not link.get("href"):
            continue
        href = urljoin(url, link["href"])
        if (selector or any(k in (link.get_text(" ", strip=True) + href).lower() for k in ("採用", "求人", "募集要項", "recruit", "career", "jobs"))) and urlsplit(href).scheme == "https":
            found.add(normalize_url(href))
    return sorted(found)
