--First schema model includes everything we should have at minimum to have a functioning service
    --(standups expect to be associated with a team member and team; a team member expects a user; a user expects a user session)

CREATE TABLE users (
    id              INTEGER PRIMARY KEY,
    user_name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    user_email      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash       TEXT    NOT NULL,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    deleted_at      TEXT    NULL,
    kill_after      TEXT    NULL
);

CREATE INDEX idx_users_kill_after ON users(kill_after) WHERE kill_after IS NOT NULL;

CREATE TABLE teams (
    id              INTEGER PRIMARY KEY,
    team_name       TEXT    NOT NULL,
    invite_code     TEXT    NOT NULL UNIQUE,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    owned_by        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, --team owners must resolve their teams (delete or transfer ownership) before account deletion
    deleted_at      TEXT    NULL,                                               --RESTRICT is a last guard but should never actually trigger; enforce the policy for soft-deletion at service level
    kill_after      TEXT    NULL,
    standup_retention_days  INTEGER NULL
);

CREATE INDEX idx_tm_owners ON teams(owned_by);

CREATE TABLE team_members (
    id              INTEGER PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    display_name    TEXT    NOT NULL,
    member_role     TEXT    NOT NULL DEFAULT 'member'
                            CHECK (member_role IN ('admin', 'member', 'left')),
    joined_at       TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    left_at         TEXT    NULL,
    UNIQUE (user_id, team_id)
);

CREATE INDEX idx_tm_memberships_team ON team_members(team_id);

CREATE TABLE standups (
    id              INTEGER PRIMARY KEY,
    posted_by       INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    for_team        INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    worked_on       TEXT    NULL,
    will_work_on    TEXT    NULL,
    blocked_by      TEXT    NULL,
    blocker_resolved INTEGER NOT NULL DEFAULT 0 CHECK (blocker_resolved IN (0, 1)), -- so blocker content can still be displayed (i.e. crossed out) after resolution
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    kill_after      TEXT    NULL,
    -- can only resolve if there's a blocker to resolve
    CHECK(
        blocker_resolved = 0
        OR (blocked_by IS NOT NULL AND blocked_by != '')
    )
);

CREATE INDEX idx_standups_poster ON standups(posted_by, created_at DESC);
CREATE INDEX idx_standups_poster_blockers ON standups(posted_by, created_at DESC)
    WHERE blocked_by IS NOT NULL AND blocked_by != '';

CREATE INDEX idx_standups_team ON standups(for_team, created_at DESC);
CREATE INDEX idx_standups_team_blockers ON standups(for_team, created_at DESC)
    WHERE blocked_by IS NOT NULL AND blocked_by != '';

CREATE INDEX idx_standups_kill_after ON standups(kill_after) WHERE kill_after IS NOT NULL;

CREATE TABLE user_sessions (
    id              INTEGER PRIMARY KEY,
    token           TEXT    NOT NULL UNIQUE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TEXT    NOT NULL,
    expires_at      TEXT    NOT NULL,
    user_agent      TEXT    NULL,
    ip_address      TEXT    NULL,
    revoked_at      TEXT    NULL
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at) WHERE revoked_at IS NULL;

PRAGMA user_version = 1;