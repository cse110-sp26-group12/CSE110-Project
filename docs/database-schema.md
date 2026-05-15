# Database

## OVERVIEW

This database is designed to store all server-side information including login credentials, team information, user team profiles, and user-generated content.

---

## ARCHITECTURE

### Backend Usage

WIP

### Backend-Frontend Data Flow

WIP

### Technologies/Tools

Uncertain; most likely reading/writing flat JSON files from backend

### Dependencies

Uncertain; most likely none if we go with flat JSON files

### Authentication/Session Storage Considerations

WIP

### Scaling/Extension Considerations

Schema and backend must be designed to facilitate migration between databse setups (i.e. JSON reading -> Postgre).

---

## SCHEMA

### Schema Source

**[NOT AN IMPLEMENTATION]** [wip-schema.txt](./db/wip-schema.txt)

### Tables (WIP)

**Users** - persistent user info for login authentication and account management. Modeled to support a soft-to-hard deletion scheme; user can delete their account after which it will be soft-deleted and remain in a read-only state for some amount of time, after which it will be hard-deleted from the database and, to preserve privacy, all activity associated with that account will also be deleted. Accounts may be recovered any time before hard deletion.

**Teams** - surface-level team info and team management. Teams may be soft-to-hard deleted in the same manner as users and recovered while soft-deleted.

**Team Members** - team-level user profiles, similar to Slack/Discord server profiles. User activity may persist on a team after they left and while soft deleted, but will be deleted if the user account is hard deleted.

**Check ins** - check-ins posted per project that include stand up, blockers, and current mood. Assuming user will post all three at once, if we want to display stand-ups, blockers, and mood separately, they can be derived from this table.

**Projects** - projects associated with a certain team, encompasses several tasks and project members. Can have an optional status and deadline, and may be archived and unarchived or hard-deleted from database. May have a leader assigned to it.

**Project Members** - a subset of team members; team members associated with a project who may leave or rejoin a project while preserving their activity in said project (activity will be removed on account hard deletion).

**Tasks** - associated with projects. May have a deadline and/or status attached and may be deactivated/reactivated or hard-deleted.

**Task Members** - a subset of project members; project members associated with a task who may assign or unassign themselves to said task while presving activity (activity will be removed on hard account deletion).

**Cover Requests** - associated with a team member and a project. Can be given a modifiable start and end date, but will be hard-deleted after the end date has been passed. Can also be hard-deleted anytime prior by poster of cover request or a project administrator. 

### Relationships (WIP)

Teams <- Users
<br>
Teams -> Projects <- Team Members
<br>
Tasks <- Projects

Users -> Team Members <- Teams
<br>
Team Members -> Project Members <- Projects
<br>
Project Members -> Task Members <- Tasks

Team Members -> Check-Ins <- Projects
<br>
Team Members -> Cover Requests <- Projects

### Constraints

WIP

### Completion

Initial framing

### To do

Based on our "musts":

- [ ] Users [IP]
- [ ] Team memberships [IP]
- [ ] Teams [IP]
- [ ] Check-ins (standups + mood) [IP]
- [ ] Blockers [IP]
- [ ] Cover requests [IP]
- [ ] Meeting scheduler (not sure how this is gonna be done)
- [ ] Something something AI (if we get to it)

- [ ] All necessary relationships between the above (add them here)

### Visualization/Modification

Paste the contents of wip-schema.txt into the code editor at dbdiagram.io. Changes will be saved locally to your dbdiagram account. Once you are ready to commit any changes you made, simply overwrite the current contents of wip-schema.txt. Sharing the project directly is a "pro" feature so this is the workaround we have to use. If you would like to propose a better methodology please do so.
