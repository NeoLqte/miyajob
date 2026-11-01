"""Routes are measurements with provenance, never inferred from city names."""
from datetime import date
from typing import Protocol

from pydantic import Field

from .models import Model, Commute


class RouteRecord(Model):
    destination: str
    minutes: float = Field(ge=0)
    provider: str = Field(min_length=1)
    checked_at: date
    assumptions: str = Field(min_length=1)
    evidence_url: str
    locator: str = Field(min_length=1, max_length=240)


class RouteProvider(Protocol):
    def measure(self, destination: str) -> RouteRecord | None: ...


class ManualRouteProvider:
    def __init__(self, records: list[RouteRecord]):
        self.records = {r.destination: r for r in records}

    def measure(self, destination: str) -> RouteRecord | None:
        return self.records.get(destination)


def measured_commute(provider: RouteProvider, destination: str) -> Commute:
    record = provider.measure(destination)
    if record is None:
        return Commute()
    return Commute(minutes=record.minutes, status="verified", provider=record.provider,
                   checked_at=record.checked_at, route_assumptions=record.assumptions)
