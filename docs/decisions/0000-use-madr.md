---
parent: Decisions
nav_order: 100
title: ADR 0000 - Use MADR
status: accepted
date: 2026-05-10
---

# Use MADR for Architectural Decisions

## Context and Problem Statement

Our team needs a consistent, version-controlled way to document technical and design choices. Without a structured format, it is difficult for team members to understand why specific decisions were made later in the project.

## Decision Drivers

- Need for standardized documentation.
- Requirement for Markdown-based files that live in the repository.

## Considered Options

- MADR (Markdown Architectural Decision Records)

## Decision Outcome

Chosen option: **MADR**, because it provides a rigorous template that ensures we document the "why" and the "consequences" of our choices, not just the "what."

### Consequences

- **Good:** All decisions are now searchable and follow the same format.
- **Good:** History of decisions is kept in Git.
- **Bad:** There is a slight overhead to filling out the full template for every small choice.

## Confirmation

Compliance will be confirmed via Peer Reviews on GitHub. Every Pull Request that introduces a major architectural change should be accompanied by an ADR in `docs/decisions/`.
