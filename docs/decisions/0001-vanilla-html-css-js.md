# ADR-0001 — Vanilla HTML, CSS, and JavaScript

**Status:** Accepted
**Date:** 2026-05-12

## Context and Problem Statement

The course spec defaults to vanilla web technologies and requires TA
approval for any framework. We need to decide whether to stay vanilla or
request approval for React, Vue, etc.

## Considered Options

- **Vanilla HTML/CSS/JS** — no framework, no build step.
- **React** — popular, would require TA approval and a build pipeline.
- **Svelte / Vue** — same approval and tooling overhead as React.

## Decision Outcome

Chosen: **Vanilla HTML/CSS/JS**, because it matches the course default,
has zero dependency overhead, and the scope of SitRep does not require a
component framework. We can reconsider if state management becomes painful.

### Consequences

- Good: No build step, no framework version churn, easier for TAs to review.
- Good: Faster initial load.
- Bad: More manual DOM work; we will need a clear convention for organizing JavaScript modules.