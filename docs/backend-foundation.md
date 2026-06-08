# Backend Structure

**User input**
<--->
**Frontend Handler**
_[CLIENT]_
<--------->
_[SERVER]_
**API Handler**
<--->
**Service Layer**
<--->
**Data Repo**
<--->
**Database**

---

## [API HANDLER](../api-handler/)

Direct interaction with the frontend. HTTP parsing and response.

### Expected from Frontend

- HTTP method and path

_e.g._ `POST {something o algo}/teams/66/standups`

- Request body

_e.g._

```js

{
    "posted_by" : 66,
    "for_team" : 66,
    "worked_on" : "Roblox content creation",
    "will_work_on" : "Nothing",
    "blockers" : "My mom",
    "status_flag" : "In progress" //status flag is stored internally separate from blocker status
}
```

### Expected to Service Layer

Function calls with parsed HTTP parameters as arguments

#### _Notes_

- Path parameters are parsed and type-checked
- Body is validated against schema and passed as dict
- Only send down fields that pass validation

### Expected from Service Layer

Return values of frontend-ready dictionaries and/or exceptions (e.g. "Team not found")

### Expected to Frontend

HTTP response

- Status code
- Response body

### Constraints

- WILL NOT read or write storage directly
- WILL NOT run conditional logic beyond input parsing and error generation

---

## [Service Layer](../service-layer/)

Business logic, permission and membership authorization, data compilation and packaging for frontend.

### Expected from API Handler

Function calls with validated arguments

#### _Notes_

- Assume arguments are thoroughly type-checked
- Assume associated ID (user, team, team member, etc.) is real
- Assume all required fields are present
  <br>
- Do not assume user has permission
- Do not assume that the associated entity (e.g. standup) exists

### Expected to Data Repo

Single-table CRUD function calls

#### _Notes_

- User team/task membership and permissions should be verified before calling upon data repo
- Compute derived fields like `kill_after`
- Decide WHICH database accesses are made
- Function calls should access one table at a time for simplicity

### Expected from Data Repo

Return values in the form of dictionary-formatted data

#### _Notes_

- **RETURNED DATA IS INDEPENDENT OF STORAGE**; switching database models should not affect what is returned here
- Only one table's data should be returned per function return for simplicity

### Expected to API Handler

Return values in the form of frontend-ready dictionaries and/or exceptions

- If data is derived from multiple tables, it is composed here in the service layer before being sent to API buddy

---

## [Data Repo](../data-repo/)

A load of CRUD.

### Expected from Service Layer

Function calls for single-table CRUD operations

_e.g._

```js
user.findById((user_id = 66));
user.findByUsername((user_name = 'jhops48'));
team_membership.findById((user_id = 66), (team_id = 66));
```

### Expected to Database

Direct database accesses

- Exact implementation depends on selected database framework

### Expected from Database

Direct data returns

- Exact return format depends on selected database framework

### Expected to Service Layer

- Dictionary-formatted data or nothing for void operations

#### _Notes_

- Optional fields should always be present, null or otherwise
- Timestamps should always be UTC for translation

### Constraints

- Repo methods access one table at a time
- Repo does not handle any kind of business logic, only CRUD operations
- Exact implementation here (and only here) is dependent on chosen database framework

## Database

Refer to [database-schema.md](./database-schema.md)
