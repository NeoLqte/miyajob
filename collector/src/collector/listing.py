"""Publication minimum: five explicitly reviewed, source-backed conditions."""
REQUIRED_CONDITIONS = ('salary', 'location', 'employment', 'holidays', 'hours')


def complete_conditions(facts):
    return all(any(f.field == field and f.confirmed for f in facts) for field in REQUIRED_CONDITIONS)


def complete_job(job):
    facts = job.listing_facts
    return (complete_conditions(facts)
            and len({f.field for f in facts}) == len(facts)
            and all(f.url in {s.url for s in job.sources} and f.checked_at <= job.last_checked_at
                    and any(s.url == f.url and f.checked_at <= s.checked_at for s in job.sources)
                    for f in facts))
