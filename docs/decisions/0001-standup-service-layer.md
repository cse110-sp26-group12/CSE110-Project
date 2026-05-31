---
parent: Decisions
nav_order: 1
title: ADR 0001 - Standup Service Layer
status: accepted
date: 2026-05-29
---

# Use a Service Layer for Standup Submissions

## Context and Problem Statement

The standup submission form needs backend support so users can submit their updates and see submitted standups from the app. Our backend plan already separates the work into API handlers, service layer code, and data repositories.

The question is how to connect the standup API to the new standup data repository without putting too much logic in the API handler. Since the app does not have real login or team membership wired in yet, the service layer also needs to handle temporary dummy team/member values for now.

## Decision Drivers

- Keep the API handler focused on requests and responses.
- Put standup-specific logic somewhere other than the API handler.
- Use the shared `data-repo/dataRepository.js` namespace instead of a one-off standup repository adapter.
- Keep database/storage access inside the data repo layer.
- Use dummy user/team/member values until the app has real authentication and team membership data.
- Support `GET /api/standups` and `POST /api/standups`.

## Considered Options

- Keep standup logic inside the API handler
- Use an API handler, service layer, and data repository
- Connect the service layer directly to the old in-memory store

## Decision Outcome

Chosen option: "Use an API handler, service layer, and data repository", because it follows the backend structure we already planned and keeps the code easier to understand.

### Consequences

- Good, because `api-handler/standupHandler.js` no longer needs the old mock service.
- Good, because `service-layer/standupService.js` handles simple standup rules like trimming text and setting empty blockers to `"none"`.
- Good, because `standupService.js` imports the shared data repository namespace and calls the official `standupRepo`.
- Good, because the temporary dummy user/team/member setup stays in the service layer instead of being mixed into the API handler.
- Bad, because the dummy setup is temporary and should be replaced once real user and team data exists.

### Confirmation

We can check this through code review and tests:

- `standupHandler.js` imports and calls `standupService` instead of using `mockService`.
- `standupService.js` cleans up standup input before calling the data repo.
- `standupService.js` uses `standupRepo` from `data-repo/dataRepository.js`.
- `POST /api/standups` creates a standup and `GET /api/standups` returns submitted standups.

## Pros and Cons of the Options

### Keep standup logic inside the API handler

- Good, because it is the quickest implementation.
- Bad, because the API handler would start doing too many jobs.
- Bad, because it does not match the backend structure described in our docs.

### Use an API handler, service layer, and data repository

- Good, because it matches our planned project structure.
- Good, because each layer has a clearer job.
- Good, because it uses the official repository namespace created by the data repo work.
- Good, because dummy team/member values can be replaced later without changing the API handler.
- Neutral, because the service layer has some temporary demo setup while auth/team membership is not wired in.

### Connect the service layer directly to the old in-memory store

- Good, because it would be simple for the first demo.
- Bad, because it would ignore the new shared data repositories.
- Bad, because it would not use the same path as the rest of the backend.

## More Information

This decision supports the standup submission backend service-layer issue. Right now the implementation uses:

- `api-handler/standupHandler.js`
- `service-layer/standupService.js`
- `data-repo/dataRepository.js`
- `data-repo/repos/standupsRepository.js`
