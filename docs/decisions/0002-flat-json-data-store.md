---

## parent: Decisions  
nav_order: 2  
title: ADR-0002 — Data Store  
status: proposed  
date: 2026-05-19  
decision-makers: Porygon-12  
consulted: [Jared (TA)]

## ADR-0002 — Flat JSON Now, Hosted Postgres Later

## Context and Problem Statement

SitRep needs to persist users, standups, tasks, and blockers. The data is relational. We also need to deploy to GitHub Pages or Cloudflare, which rules out self-hosted databases. We need a store for the prototype and a target for production.

## Decision Drivers

- Must deploy to GitHub Pages / Cloudflare (no self-hosted servers)
- Multi-user concurrent writes in Phase 2
- Relational data shape (foreign keys, joins)
- Fast prototype iteration, minimal setup
- Process clarity for CSE 110 grading

## Considered Options

- Flat JSON file
- localStorage / IndexedDB
- SQLite
- Local PostgreSQL
- Hosted Postgres (Supabase)
- Firebase Firestore

## Decision Outcome

**Two phases:**

- **Phase 1 (now):** Flat JSON file. Single-user prototype, zero setup.
- **Phase 2 (Sprint 4+, pending TA approval):** Hosted Postgres via Supabase. Real schema, multi-user, works with static front-end.

Confirmed with Jared at Friday TA meeting before Phase 2 work begins.

### Consequences

- Good: Phase 1 has zero setup; everyone can run the prototype.
- Good: Phase 2 uses industry-standard SQL.
- Good: Supabase deploys cleanly with GitHub Pages.
- Bad: Phase 1 has no schema enforcement or concurrent-write safety.
- Bad: Phase 2 adds Supabase vendor dependency.
- Bad: Migration requires real work — scheduled, not deferred.

### Confirmation

- Phase 1: `data/store.json` exists, schema documented in `docs/database-schema.md`.
- Phase 2 readiness: ER diagram, `db/schema.sql`, Jared's Slack approval screenshot in repo.
- Migration tooling choice tracked in ADR-0004.

## Pros and Cons of the Options

### Flat JSON

- Good: zero setup, human-readable, version-controllable.
- Bad: no schema, no concurrent writes, no joins.

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

