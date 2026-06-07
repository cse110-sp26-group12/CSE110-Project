# Changelog

## 1.0.0 - 2026-06-06

First complete release of **SitRep** — daily standup dashboard with persistent backend.

### Added

- Layered Node.js backend: API handler, service layer, and data repositories
- SQLite database with migrations (`users`, `teams`, `team_members`, `standups`, `user_sessions`)
- Standup HTTP API:
  - `GET /api/standups` — list standups
  - `POST /api/standups` — create standup (`name`, `done`, `todo`, `blockers`, `statusFlag`)
- Raw `http` server (`server.js`) with static file serving from `src/`
- Frontend dashboard UI with tabs: Standup, Team Board, Tasks, Blockers
- Frontend wired to backend via `fetch` (dynamic API base for GitHub Pages vs local dev)
- Standup status flags persisted at data layer (`In progress`, `On track`, blocker-derived `Blocked`)
- Session data repository (foundation for future login)
- Render deployment (`render.yaml`, configurable `PORT`, CORS for GitHub Pages origin)
- ADR 0001: standup service layer
- ADR 0002: GitHub Pages + Render deployment
- Frontend design ADRs, wireframes, and tab documentation
- Unit, integration, persistence, and E2E tests for standups and data layer
- JSDoc documentation across frontend and standup store modules

### Changed

- Merged wired frontend from `implement/frontend-foundation` into backend branch
- Simplified schema: removed projects and project membership tables
- Moved timestamp creation from database triggers to data repository layer

### Fixed

- Linting and formatting compliance across backend modules
- Frontend/backend alignment for standup status delivery
- Database file gitignore and removal of committed `.db` artifacts

## 0.2.0 - 2026-05-24

Research, design, and documentation foundation on `main`.

### Added

- Research artifacts: personas, user stories, team prototypes, wireframes
- Database schema documentation (`docs/db/schema_model.txt`, schema diagram)
- MADR architecture decision records (`docs/decisions/0000-use-madr.md`)
- Standup store module and initial schema documentation (`standupStore.js`)
- JSON output / form submission prototype on `implement/json-output`
- Status Update 1 video link in README
- Peer review and meeting notes documentation

### Changed

- Reorganized research into `docs/research/`
- Prettified main documentation while preserving research prototypes
- CI/CD pipeline runs on all branches

## 0.1.0 - 2026-05-09

Initial project setup and quality pipeline.

### Added

- Repository scaffolding and team README
- GitHub Actions CI: lint, format check, test, build placeholder
- ESLint flat config, Prettier, Jest
- Sprint planning and early frontend placeholder (`src/standup.js`)
