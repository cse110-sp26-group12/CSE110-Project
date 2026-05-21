---
parent: Decisions
nav_order: 2
title: ADR-0002 — Data Store
status: proposed
date: 2026-05-19
decision-makers: [SitRep Team]
consulted: [Jared (TA)]
informed: [Prof. Powell]
---

# ADR-0002 — In-Memory Now, Hosted Postgres Later

## Context and Problem Statement

SitRep needs to persist users, standups, tasks, and blockers. The data is relational. We also need to deploy to GitHub Pages or Cloudflare, which rules out self-hosted databases. We need a store for the prototype and a target for production.

## Decision Drivers

- Must deploy to GitHub Pages / Cloudflare (no self-hosted servers)
- Multi-user concurrent writes in Phase 2
- Relational data shape (foreign keys, joins)
- Fast prototype iteration, minimal setup
- Process clarity for CSE 110 grading

## Considered Options

- In-memory JS objects (current)
- Flat JSON file on disk
- localStorage / IndexedDB
- SQLite
- Local PostgreSQL
- Hosted Postgres (Supabase)
- Firebase Firestore

## Decision Outcome

**Two phases:**
- **Phase 1 (now):** In-memory JS objects produced by a `createStandup` factory in `src/standup.js`. No persistence yet — submissions live until page refresh. Sufficient for validating the UI and CI/CD pipeline.
- **Phase 2 (Sprint 4+, pending TA approval):** Hosted Postgres via Supabase. Real schema, multi-user, works with static front-end.

Confirmed with Jared at Friday TA meeting before Phase 2 work begins.

### Consequences

- Good: Phase 1 has zero setup; everyone can run the prototype.
- Good: Phase 2 uses industry-standard SQL.
- Good: Supabase deploys cleanly with GitHub Pages.
- Bad: Phase 1 has no persistence — data is lost on refresh.
- Bad: Phase 1 has no schema enforcement or concurrent-write safety.
- Bad: Phase 2 adds Supabase vendor dependency.
- Bad: Migration requires real work — scheduled, not deferred.

### Confirmation

Phase 1 (Sprint 3 deliverables, in progress):
- `src/standup.js` exists with the `createStandup` factory.
- Schema-shape doc to be added at `docs/database-schema.md`.
- Optional seed data to be committed at `data/store.json` once a persistence layer (JSON file or browser storage) is added before Phase 2.

Phase 2 readiness:
- ER diagram at `docs/decisions/diagrams/erd.png`.
- `db/schema.sql` checked into the repo.
- Jared's Slack approval screenshot in `docs/decisions/0002-approval/`.

Migration tooling choice tracked in ADR-0004.

## Pros and Cons of the Options

### In-memory JS objects (current)
- Good: zero setup, no I/O, lets us validate UI flow.
- Bad: data evaporates on refresh. Not a real store.

### Flat JSON file
- Good: simple, human-readable, version-controllable.
- Bad: no schema, no concurrent-write safety, no joins.

### localStorage / IndexedDB
- Good: no backend needed.
- Bad: per-browser. Teammates can't share data. Kills multi-user.

### SQLite
- Good: full SQL in a single file.
- Bad: unreachable from GitHub Pages without a separately-hosted backend.

### Local PostgreSQL
- Good: full SQL.
- Bad: breaks deployment constraint. Every teammate must install Postgres. Week 9 review team can't run our app.

### Hosted Postgres (Supabase)
- Good: real Postgres, callable from browser SDK, free tier, built-in auth.
- Bad: vendor dependency. Schema and migrations needed up front.

### Firebase Firestore
- Good: free tier, real-time sync.
- Bad: NoSQL document store fights our relational shape. Heavy vendor lock-in.

## Open Questions for Friday TA Meeting

1. Does Jared approve Supabase for Phase 2?
2. Preferred migration tool (raw SQL / Prisma / Knex)?
3. Migration as one focused sprint or interleaved with features?
4. Auth / row-level-security requirements from day one?