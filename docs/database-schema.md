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

WIP

---

## SCHEMA

### Schema Source

**[NOT AN IMPLEMENTATION]** [wip-schema.txt](./db/wip-schema.txt)

### Tables (WIP)

**Users** - persistent user info for login authentication and account management

**Teams** - surface-level team info and team management

**Team Memberships** - team-level user profiles, similar to Slack/Discord server profiles

### Relationships (WIP)

Users <- Team Memberships -> Teams

### Constraints

WIP

### Completion

Just started

### To do

Based on our "musts":

- [ ] Users [IP]
- [ ] Team memberships [IP]
- [ ] Teams [IP]
- [ ] Check-ins (standups + mood)
- [ ] Blockers
- [ ] Cover requests
- [ ] Meeting scheduler (not sure how this is gonna be done)
- [ ] Something something AI (if we get to it)

- [ ] All necessary relationships between the above (add them here)

### Visualization/Modification

Paste the contents of wip-schema.txt into the code editor at dbdiagram.io. Changes will be saved locally to your dbdiagram account. Once you are ready to commit any changes you made, simply overwrite the current contents of wip-schema.txt. Sharing the project directly is a "pro" feature so this is the workaround we have to use. If you would like to propose a better methodology please do so.
