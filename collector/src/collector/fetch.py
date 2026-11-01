import ipaddress
import socket
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx
from pydantic import Field

from .models import Model, public_url
from typing import Literal

USER_AGENT = "MiyaJobResearch/0.1 (+manual review; no authentication)"


class SourcePolicy(Model):
    name: str
    url: str
    allowed_prefixes: list[str]
    mode: str = "manual"
    kind: Literal["official", "job_board", "other"] = "other"
    terms_url: str
    permission_notes: str = ""
    terms_checked_at: str | None = None
    automated_access_allowed: bool = False
    minimum_interval_seconds: int = Field(default=604800, ge=10)
    selectors: dict[str, str] = Field(default_factory=dict)


def authorized(url: str, policy: SourcePolicy):
    public_url(url)
    p = urlsplit(url)
    if not any(p.scheme == (a := urlsplit(prefix)).scheme and p.netloc == a.netloc
               and (p.path == a.path.rstrip("/") or p.path.startswith(a.path.rstrip("/") + "/"))
               for prefix in policy.allowed_prefixes):
        raise ValueError("outside_approved_scope")


def public_host(url: str):
    host = urlsplit(url).hostname
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError("non_public_network_target")


class SafeFetcher:
    def __init__(self, history: dict, client=None, sleep=time.sleep):
        self.history = history
        self.client = client or httpx.Client(timeout=20, follow_redirects=False, trust_env=False, headers={"User-Agent": USER_AGENT})
        self.sleep = sleep
        self.last_host: dict[str, float] = {}

    def close(self):
        self.client.close()

    def fetch(self, policy: SourcePolicy) -> str:
        authorized(policy.url, policy)
        if not policy.automated_access_allowed or not policy.permission_notes or not policy.terms_checked_at:
            raise ValueError("automation_permission_not_verified")
        checked = datetime.fromisoformat(policy.terms_checked_at).date()
        if not 0 <= (datetime.now(timezone.utc).date() - checked).days <= 365:
            raise ValueError("terms_review_required")
        public_url(policy.terms_url)
        public_host(policy.url)
        host = urlsplit(policy.url).netloc
        now = datetime.now(timezone.utc)
        previous = self.history.get(policy.url)
        if previous and (now - datetime.fromisoformat(previous)).total_seconds() < policy.minimum_interval_seconds:
            raise ValueError("source_not_due; previous_public_data_preserved")
        wait = 10 - (time.monotonic() - self.last_host.get(host, 0))
        if wait > 0:
            self.sleep(wait)
        robots_url = f"https://{host}/robots.txt"
        # Fail closed on redirects, missing robots, server errors or unparsable response.
        robots = self.client.get(robots_url)
        robots.raise_for_status()
        if robots.status_code != 200 or len(robots.content) > 200_000:
            raise ValueError("robots_unverified")
        parser = RobotFileParser(robots_url)
        parser.parse(robots.text.splitlines())
        if not parser.can_fetch(USER_AGENT, policy.url):
            raise ValueError("robots_disallowed")
        delay = max(10, parser.crawl_delay(USER_AGENT) or 0)
        self.sleep(delay)
        # Record attempts too: 403/429 do not trigger immediate retries.
        self.history[policy.url] = now.isoformat()
        self.last_host[host] = time.monotonic()
        with self.client.stream("GET", policy.url) as response:
            response.raise_for_status()
            if response.status_code != 200:
                raise ValueError("redirect_or_unexpected_response")
            data = bytearray()
            for chunk in response.iter_bytes():
                data.extend(chunk)
                if len(data) > 2_000_000:
                    raise ValueError("response_too_large")
            return bytes(data).decode(response.encoding or "utf-8", errors="replace")
