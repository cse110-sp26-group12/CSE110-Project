# Database

## OVERVIEW

This database is designed to store all server-side information including login credentials, authentication sessions, team information, user team profiles, and user-generated content.

## ARCHITECTURE

### Backend Usage and Data Flow

#### Frontend

Let the frontend serve purely as a messenger of inputs given to and a displayer of pretty pre-formatted shapes received from API calls. This is not the kind of program that requires heavy client-side work.

#### API

Parse frontend requests and validate input. Return HTTP responses. Call into the service layer.

#### Service

Handle authorization, enforce permissions, works data between repos. A lot of logic and the main security layer.

#### Data Respositories

Database access occurs here only. Pure CRUD operations. Migrating between frameworks should only require work at this layer.

#### Storage

SQLite/Postgres database

---

### Technologies/Tools

Implemented with SQLite, using better-sqlite3

### Dependencies

better-sqlite3

### Authentication/Session Storage Considerations

User sessions will be stored in the **User Sessions** table with reference to a user id, ip address, and user agent. Sessions are created on successful login and can be set to expire after some amount of time, which will require that user to log in again.

### Scaling/Extension Considerations

Schema and backend must be designed to facilitate migration between database setups (i.e. SQLite -> Postgre).

---

## SCHEMA

### Schema Model

[![Schema Diagram](./db/schema_diagram.png)](./db/schema_diagram.png)

**[NOT AN IMPLEMENTATION]** [schema_model.txt](./db/schema_model.txt)

### Tables

#### Users

Persistent user info for login authentication and account management. Modeled to support a soft-to-hard deletion scheme; user can delete their account after which it will be soft-deleted and remain in a read-only state for some amount of time, after which it will be hard-deleted from the database and, to preserve privacy, all activity associated with that account will also be deleted. Accounts may be recovered any time before hard deletion.

#### User Sessions

User authentication sessions, attached to user id, ip address, and user agent. Set to expire after some length of time, requiring new login.

#### Teams

Surface-level team info and team management. Teams may be soft-to-hard deleted in the same manner as users and recovered while soft-deleted.

#### Team Members

Team-level user profiles, similar to Slack/Discord server profiles. User activity may persist on a team after they left and while soft deleted, but will be deleted if the user account is hard deleted.

---

#### Standups

Standups posted per team that include stand ups and blockers. Assuming user will post both at once, if we want to display stand-ups, blockers separately, they can be derived from this table.

Shape of a standup entry as produced by `createStandup` in `src/standup.js` and stored by `createStandupStore` in `src/standupStore.js`. The following fields be delivered to the backend for processing.

##### Fields

| Field         | Type    | Description                                                                                                                                                                                         |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `posted_by`   | integer | ID of the _team member_ who submitted the standup **[given by client]**                                                                                                                             |
| `for_team`    | integer | ID of the team where the standup was submitted **[given by client]**                                                                                                                                |
| `done`        | string  | Summary of what they finished since the last standup or `"none"` **[given by user]**                                                                                                                |
| `todo`        | string  | What they plan to work on next or `"none"` **[given by user]**                                                                                                                                      |
| `blockers`    | string  | Anything blocking them, or `"none"` **[given by user]**                                                                                                                                             |
| `status_flag` | string  | The current status of the standup (i.e. 'In Progress'). 'Blocked' will _not_ be accepted here; it is determined by the server and overrides this flag when a blocker is active. **[given by user]** |

All fields are required. Parsing and type validation will be handled at the API layer.

##### Example

```json
{
  "posted_by": 66,
  "for_team": 66,
  "done": "Finished frontend layout",
  "todo": "Working on JSON parser",
  "blockers": "None",
  "status_flag": "In progress"
}
```

##### Standup API

Standups are read and written from client using the following methods:

```js
//Posts a standup for a team member
POST {ORIGIN}/api/standups
/**
 * ===[Request]===
 * headers: 'Content-Type' : 'application/json'
 * 
 * body (JSON): {
 *  name: "Thomas Powell"
 *  done: "Software engineering or something"
 *  todo: "Talk at 200 people about some SNCA"
 *  blockers: ""
 *  statusFlag: "In progress"
 * }
 * 
 * ===[Response]===
 *
 * headers: {
 *  201 OK (if successful) or 400/500
 *  'Content-Type' : 'application/json'
 * }
 * 
 * body (JSON): {
 *  name: 'Thomas Powell'
 *  done: 'Software engineering or something'
 *  todo: 'Talk at 200 people about some SNCA'
 *  blockers: ''
 *  statusFlag: 'In progress'
 * }
 * 
```

```js
//Gets a list of existing standups for a given team
GET {ORIGIN}/api/standups
/**
 * ===[Response]===
 * headers: {
 *  200 OK (if successful) or 500
 *  'Content-Type' : 'application/json'
 * }
 * 
 * body (JSON array): [
 *  {
 *   id: 1
 *   name: 'Thomas Powell'
 *   done: 'Software engineering or something'
 *   todo: 'Talk at 200 people about some SNCA'
 *   blockers: 'none'
 *   submittedAt: '2024-02-26T14:30:00+08:00'
 *   statusFlag: 'In progress'
 *  },
 *  {...}, 
 *  {...}, 
 *  ...
 * ]
 * 
```

##### Derived Fields

The table will be created in the database as:

```sql
CREATE TABLE standups (
    id              INTEGER PRIMARY KEY,
    posted_by       INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    for_team        INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    worked_on       TEXT    NULL,
    will_work_on    TEXT    NULL,
    blocked_by      TEXT    NULL,
    status_flag     TEXT    NOT NULL CHECK(status_flag IN ('In progress', 'On track'))
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    kill_after      TEXT    NULL
);
```

Rows not passed by the frontend (`id`, `created_at`, `updated_at`, `kill_after`) are to be derived in the backend.

---

**Tasks** - associated with teams. May have a deadline and/or status attached and may be deactivated/reactivated or hard-deleted.

**Task Members** - a subset of team members; team members associated with a task who may assign or unassign themselves to said task while presving activity (activity will be removed on hard account deletion).

**Cover Requests** - associated with a team member and a team. Can be given a modifiable start and end date, but will be hard-deleted after the end date has been passed. Can also be hard-deleted anytime prior by poster of cover request or a team administrator.

### Relationships

Sessions <- Users

Teams <- Users
<br>
<br>
Tasks <- Teams

Users -> Team Members <- Teams
<br>
<br>
Team Members -> Task Members <- Tasks

Team Members -> Standups <- Teams
<br>
Team Members -> Cover Requests <- Teams

### Constraints

- User details are for authentication; in practice users should only see each other's team-specific **Team Member** details
- Teams own tasks; do not skip the hierarchy
- Hard-deletion is true deletion; any hard-deleted info is unrecoverable
- Store all timestamps in UTC for uniformity; only convert to local time when reading to client
- Soft-deleted/archived rows are strictly read-only unless reactivated
- On hard deletion, all dependents of the deleted row (such as team members from a user) are also deleted and will no longer be referenced; hard account/team deletion is a privacy measure, so the removal of information associated with an individual or organization takes priority

### Completion

First draft: v1

### To do

Based on our "musts":

- [x] Users
- [x] Team memberships
- [x] Teams
- [x] Standups
- [x] Blockers
- [x] Cover requests

---

- [x] Relationships between users and teams
- [x] Relationships between team members and tasks
- [x] Relationships between teams and standups/cover reqs
- [x] Relationships between team members and standups/cover reqs

### Visualization/Modification

Paste the contents of [schema_model.txt](./db/schema_model.txt) into the code editor at dbdiagram.io. Changes will be saved locally to your dbdiagram account. Once you are ready to commit any changes you made, simply overwrite the current contents of wip-schema.txt. Sharing the project directly is a "pro" feature so this is the workaround we have to use. If you would like to propose a better methodology please do so.
