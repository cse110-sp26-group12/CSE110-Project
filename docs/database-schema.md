# Standup Data Schema

Shape of a standup entry as produced by `createStandup` in `src/standup.js` and stored by `createStandupStore` in `src/standupStore.js`. Phase 1 keeps everything in memory. Phase 2 will move this into a Supabase Postgres table with the same column names (see ADR-0002).

## Fields

| Field         | Type   | Description                                                |
| ------------- | ------ | ---------------------------------------------------------- |
| `name`        | string | Team member who submitted the standup                      |
| `done`        | string | Summary of what they finished since the last standup       |
| `todo`        | string | What they plan to work on next                             |
| `blockers`    | string | Anything blocking them, or `"none"`                        |
| `submittedAt` | string | ISO 8601 UTC timestamp, set automatically at creation time |

All fields are required strings. No validation is enforced at this layer since the form (Issue #10) is expected to handle that on input.

## Example

```json
{
  "name": "Cedric",
  "done": "Finished frontend layout",
  "todo": "Working on JSON parser",
  "blockers": "None",
  "submittedAt": "2026-05-17T18:00:00.000Z"
}
```

## Store API

The in-memory store at `src/standupStore.js` exposes:

- `add(name, done, todo, blockers)`: creates a standup and pushes it to the store, returns the new standup
- `getAll()`: returns all stored standups
- `serialize()`: returns all standups serialized to pretty-printed JSON

Use `createStandupStore()` for a fresh instance (useful in tests) or import the default singleton `standupStore` for app-wide use.

```js
import { standupStore } from './standupStore.js';

standupStore.add('Kyle', 'closed Issue #11', 'pick up Issue #20', 'none');
console.log(standupStore.serialize());
```

## Phase 2 Migration Notes

When Supabase comes online, the table can be created as:

```sql
create table standups (
  id bigserial primary key,
  name text not null,
  done text not null,
  todo text not null,
  blockers text not null,
  submitted_at timestamptz not null default now()
);
```

`submittedAt` is already in ISO 8601 so it should work fine with Postgres `timestamptz` without needing extra conversion. The `id` column is added at the database layer since Phase 1 has no identifier need (in-memory order is enough).
