# ADR-0002 — Flat JSON File as Data Store

**Status:** Waiting
**Date:** 2026-05-12

## Context and Problem Statement

The prototype needs to persist check-ins, team members, and availability
across requests. A full database is overkill for a small team and would
introduce setup overhead.

## Considered Options

- **Flat JSON file** read/written by the backend on each request.
- **SQLite** embedded database.
- **Postgres** hosted on Render.

## Decision Outcome

Chosen: **Flat JSON file**, because the data volume is tiny (one check-in
per person per day) and the team is small enough that concurrent writes
will not be a real problem. Keeps the prototype dependency-free.

See [`database-schema.md`](../database-schema.md) for the data model.

### Consequences

- Good: No database setup, no migrations, easy to inspect data by reading the file.
- Good: Data is version-controllable if we want to commit example data.
- Bad: Concurrent writes could clobber each other in a busier system. Acceptable risk for a prototype.
- Bad: Will need to be replaced if the project moves to production. The schema is designed to map cleanly onto SQLite or Postgres if that happens.