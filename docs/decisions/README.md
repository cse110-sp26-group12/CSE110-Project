# SitRep — Architectural Design Records

SitRep is a functional web app that runs on a server. It allows for
communication between members and serves as a dashboard/hub for the team.
We host the app on Render during development. Security considerations
will be addressed in a later phase. The app is built with Markdown, HTML,
CSS, and JavaScript.

This folder contains the major architectural and technical decisions for
the SitRep project. Each decision follows the MADR (Markdown Architectural
Decision Records) format and lives in its own file. ADRs are kept short
and prototype-appropriate; they will be expanded or superseded as the
project matures.

## Index

| ID       | Title                                                       | Status   | Date       |
| -------- | ----------------------------------------------------------- | -------- | ---------- |
| ADR-0000 | [Use MADR for architectural decisions](./0000-use-madr.md)  | Accepted | 2026-05-10 |
| ADR-0001 | [Vanilla HTML, CSS, and JavaScript](./0001-vanilla-html-css-js.md) | Accepted | 2026-05-12 |
| ADR-0002 | [Flat JSON file as data store](./0002-flat-json-data-store.md) | Waiting  | 2026-05-12 |

## Adding a new ADR

1. Copy the most recent ADR file and rename it with the next number.
2. Update the front matter (status, date, decision-makers).
3. Write the decision following the MADR template.
4. Add a row to the index table above, in order.
5. Open a pull request and tag a reviewer.