from datetime import date
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator

Tri = Literal["yes", "no", "unknown"]
Category = Literal["software", "infrastructure", "internal_it", "it_support", "technical", "office", "other"]
IT_CATEGORIES = ('software', 'infrastructure', 'internal_it', 'it_support')
DIMENSIONS = ("graduated", "graduation_date", "education", "it_years", "employment_history", "age", "drivers_license", "license_restriction", "other_qualifications", "relocation", "travel", "start_date")
SUPPORTED_REQUIREMENTS = (*DIMENSIONS, "pc_basic", "science_education", "programming_basics")
MANDATORY_EVIDENCE = ("existence", "employment", "requirements_complete", "location", "commute", "recruitment", "reuse")


def public_url(value: str) -> str:
    p = urlsplit(value)
    if p.scheme != "https" or not p.hostname or p.username or p.password or p.hostname.endswith((".invalid", ".test", ".localhost")) or p.hostname in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("出典には認証情報を含まない実在のHTTPS URLが必要です")
    return value


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Evidence(Model):
    id: str = Field(min_length=1)
    field: str = Field(min_length=1)
    url: str
    quote_or_locator: str = Field(min_length=1, max_length=240)
    checked_at: date
    valid_through: date | None = None
    conclusion: Literal["pass", "fail", "unknown"]
    method: Literal["official_page", "job_board", "direct_confirmation", "other"]
    notes: str = Field(default="", max_length=500)
    _url = field_validator("url")(public_url)


class Source(Model):
    url: str
    original_url: str
    kind: Literal["official", "job_board", "other"]
    checked_at: date
    _urls = field_validator("url", "original_url")(public_url)


class Requirement(Model):
    field: str
    operator: Literal["any", "eq", "gt", "gte", "lte", "in", "between"]
    value: str | float | bool | list[str] | None = None
    description: str = Field(min_length=1, max_length=300)
    evidence_ids: list[str] = Field(min_length=1)


class Eligibility(Model):
    status: Literal["eligible", "review", "rejected"] = "review"
    graduate_eligibility: Literal["pass", "fail", "unknown"] = "unknown"
    professional_experience: Literal["pass", "fail", "unknown"] = "unknown"
    requirements: list[Requirement] = Field(default_factory=list)


class Location(Model):
    address: str = ""
    region: str = "unknown"
    region_band: int | None = Field(default=None, ge=1, le=5)
    is_fixed: bool = False
    remote_policy: Literal["full", "hybrid", "none", "unknown"] = "unknown"
    residence_verified: bool = False


class Commute(Model):
    minutes: float | None = Field(default=None, ge=0)
    status: Literal["verified", "local_verified", "unverified", "remote_verified"] = "unverified"
    provider: str | None = None
    checked_at: date | None = None
    route_assumptions: str | None = None


class Pay(Model):
    monthly_base_min_jpy: int | None = Field(default=None, ge=0)
    monthly_total_min_jpy: int | None = Field(default=None, ge=0)
    annual_min_jpy: int | None = Field(default=None, ge=0)
    annual_basis: Literal["guaranteed", "estimated", "unknown"] = "unknown"
    bonus: str = "unknown"
    fixed_overtime: str = "unknown"
    allowances: str = "unknown"


class Workstyle(Model):
    annual_holidays: int | None = Field(default=None, ge=0, le=366)
    overtime_hours_month: float | None = Field(default=None, ge=0)
    flex: Tri = "unknown"
    transfer: Tri = "unknown"
    car_commute: Tri = "unknown"
    parking: Tri = "unknown"
    client_site: Tri = "unknown"


class Recruitment(Model):
    status: Literal["active", "closed", "unverified"] = "unverified"
    valid_through: date | None = None
    date_posted: date | None = None


class Job(Model):
    id: str = Field(min_length=1)
    company: str = Field(min_length=1)
    employer: str = Field(min_length=1)
    title: str = Field(min_length=1)
    category: Category = "other"
    recruitment_track: str = Field(min_length=1)
    employment_type: Literal["full_time_regular", "contract", "part_time", "dispatch", "unknown"] = "unknown"
    description: str = Field(default="", max_length=1200)
    location: Location = Field(default_factory=Location)
    commute: Commute = Field(default_factory=Commute)
    pay: Pay = Field(default_factory=Pay)
    workstyle: Workstyle = Field(default_factory=Workstyle)
    eligibility: Eligibility = Field(default_factory=Eligibility)
    recruitment: Recruitment = Field(default_factory=Recruitment)
    sources: list[Source] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    first_seen_at: date
    last_checked_at: date


class Profile(Model):
    # Only supplied, verified attributes belong here. Unknown is represented by null.
    attributes: dict[str, str | float | bool | list[str] | None]
    maximum_minutes: float = Field(default=45, gt=0)


class PublicData(Model):
    schema_version: Literal[1] = 1
    updated_at: date | None = None
    collection_status: Literal["not_collected", "research_in_progress", "verified_export"] = "not_collected"
    jobs: list[Job] = Field(default_factory=list)


class ReviewFact(Model):
    field: Literal['salary', 'location', 'employment', 'hours', 'holidays', 'commute']
    text: str = Field(min_length=1, max_length=300)
    url: str
    checked_at: date
    _url = field_validator('url')(public_url)


class ReviewCandidate(Model):
    """Explicitly authored public summary. Never copy internal reviewer notes."""
    id: str = Field(min_length=1)
    company: str = Field(min_length=1)
    title: str = Field(min_length=1)
    category: Literal['software', 'infrastructure', 'internal_it', 'it_support']
    address: str = Field(min_length=1)
    url: str
    checked_at: date
    stage: Literal['detail_review', 'discovery']
    reasons: list[str] = Field(min_length=1)
    summary: str = Field(min_length=1, max_length=600)
    status: Literal['review'] = 'review'
    valid_through: date | None = None
    facts: list[ReviewFact] = Field(default_factory=list)
    _url = field_validator('url')(public_url)


class ReviewData(Model):
    schema_version: Literal[1] = 1
    updated_at: date
    candidates: list[ReviewCandidate] = Field(default_factory=list)
