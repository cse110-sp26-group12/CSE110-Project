---

## parent: Decisions
nav_order: 2
title: ADR 0002 - Deployment (GitHub Pages + Render)
status: accepted
date: 2026-06-01

# Host the Frontend on GitHub Pages and the Backend on Render

## Context and Problem Statement

The SitRep app is now split into a static frontend (`src/`) and a Node + SQLite
backend (raw `http` server, API handler, service layer, data repositories). For
the project to be demonstrable, a user needs to open the deployed site, submit a
standup, and have it persist and be visible to other teammates.

GitHub Pages is the natural place to host the frontend, but **Pages only serves
static files — it cannot run a Node server, execute our backend code, or store a
SQLite database.** We therefore need a place to run the backend that can execute
code and hold the database, and we need to decide how the two halves connect.

A relevant constraint: this is a course project with a relaxed scope. The grading
artifact is a **video presentation** of the app working, so the deployment only
has to be reliably working *at presentation time*. It does not need long-term
durability, high availability, or paid infrastructure to earn a passing grade.

## Decision Drivers

- GitHub Pages cannot run a server or persist shared data.
- We want shared, multi-user persistence (everyone sees each other's standups).
- The solution should be **free** (no paid tier, no credit card).
- It should keep the backend architecture the team already built (SQLite + layers).
- Minimal new infrastructure and minimal disruption to existing code.
- Only needs to demonstrably work during the video presentation / demo window.

## Considered Optionsds

- Frontend on GitHub Pages + Node/SQLite backend on Render (free web service)
- Frontend on GitHub Pages + Supabase (hosted Postgres) as the backend
- Host everything (frontend + backend) on Render, skip GitHub Pages
- Browser-only storage (localStorage / IndexedDB), no backend
- Render with a paid persistent disk for durable SQLite

## Decision Outcome

Chosen option: **"Frontend on GitHub Pages + Node/SQLite backend on Render (free
web service)"**, because it satisfies the GitHub Pages expectation for the
frontend, keeps the SQLite-based backend the team already implemented, costs
nothing, and is more than sufficient for a working demo in our presentation.

The backend is deployed via a `render.yaml` blueprint as a free Render web
service. On each boot, Render runs `npm install` (which compiles `better-sqlite3`)
and `npm start`, and the server runs database migrations before listening on the
port Render injects via `process.env.PORT`. The live backend is at
`https://sitrep-q52s.onrender.com`. The frontend (on Pages) calls this URL with an
absolute API base, and the server sends CORS headers (`CORS_ORIGIN`) so the
cross-origin requests are allowed.

### Consequences

- Good, because the frontend stays on GitHub Pages as expected.
- Good, because the entire existing backend (SQLite, migrations, repositories,
service layer) is reused unchanged except for a configurable port and CORS.
- Good, because it is completely free.
- Good, because all users hit the same Render instance and the same database, so
standups are shared and persist across page reloads while the service is awake.
- Bad, because the frontend and backend are on different origins, which requires
CORS handling and an absolute API URL in the frontend.
- Bad, because Render's free tier **spins the service down after ~15 minutes of
inactivity**; the next request triggers a cold start that takes ~30–50 seconds,
during which the service returns `Not Found` / `no-server` until it is awake.
- Bad, because the free tier has **no persistent disk**, so the SQLite file lives
on an ephemeral filesystem and **resets on every redeploy and every spin-down**.
- Neutral, because for our scope (a video presentation of the app working) the
cold start and data reset are acceptable: we warm the service before recording
and add standups live, so the demo works and meets the requirements for a
passing grade. Durable, always-on hosting is explicitly out of scope for now.

### Confirmation

This decision is confirmed by the deployed service and the repository config:

- `render.yaml` defines the free web service, build/start commands, and
`CORS_ORIGIN`.
- `server.js` listens on `process.env.PORT` and sets CORS headers + handles the
`OPTIONS` preflight.
- `curl https://sitrep-q52s.onrender.com/api/standups` returns JSON (`200`), and a
`POST` followed by a `GET` returns the submitted standup while the service is
awake.
- The frontend, once wired, reaches the backend cross-origin without CORS errors
(verifiable in the browser Network tab).

## Pros and Cons of the Options

### GitHub Pages frontend + Render free backend (chosen)

- Good, because it keeps the frontend on Pages and the SQLite backend intact.
- Good, because it is free and needs no credit card.
- Good, because data is shared across all users via one instance + one database.
- Good, because deployment is reproducible via a committed `render.yaml`.
- Neutral, because it requires CORS + an absolute API URL.
- Bad, because of free-tier cold starts (~30–50s after idle).
- Bad, because the ephemeral filesystem resets the database on sleep/redeploy.

### GitHub Pages frontend + Supabase (hosted Postgres)

- Good, because Supabase's free tier persists data even across restarts (data
lives off our server).
- Good, because it removes cold-start data loss.
- Bad, because it abandons the SQLite backend and layered architecture the team
already built; the data repositories would need to be rewritten for Postgres.
- Bad, because it introduces a new external service/account and SQL-dialect
differences (`datetime('now')` → `now()`, `AUTOINCREMENT` → `bigserial`).
- Neutral, because for a one-week demo the extra durability is not required.

### Host everything on Render, skip GitHub Pages

- Good, because it removes CORS and the absolute-URL requirement (same origin).
- Good, because it is the simplest single-deploy setup.
- Bad, because it does not use GitHub Pages, which the team wants for the frontend.
- Neutral, because persistence is still ephemeral on the free tier.

### Browser-only storage (localStorage / IndexedDB)

- Good, because it needs no backend or hosting at all.
- Bad, because data is per-browser and **not shared** — teammates would never see
each other's standups, which defeats the purpose of the app.
- Bad, because it does not exercise the backend the team built.

### Render with a paid persistent disk

- Good, because the SQLite file would survive redeploys and spin-downs (true
durable persistence).
- Bad, because persistent disks require a **paid** instance, which violates our
"must be free" driver.
- Neutral, because durability is unnecessary for the presentation; this is a good
future upgrade if the project needs to run continuously.

## More Information

This decision builds on the SQLite backend and ADR 0001 (Standup Service Layer).
The deployment is intentionally scoped for the project's current requirements: a
working demonstration in the video presentation. If the project later needs
always-on availability or durable data, the recommended next steps are a paid
Render instance with a persistent disk (to keep SQLite) or migrating storage to a
hosted database such as Supabase/Turso. This ADR should be revisited if those
requirements change.

Relevant files and resources:

- `render.yaml` — Render blueprint (free web service, build/start, `CORS_ORIGIN`)
- `server.js` — `process.env.PORT`, CORS headers, `OPTIONS` preflight, migrations on boot
- `database/connection.js`, `database/migrate.js` — SQLite connection + migrations
- Live backend: `https://sitrep-q52s.onrender.com`

