--First schema model includes everything we should have at minimum to have a functioning service
    --(standups expect to be attached to a team member and project, which then expect a team and a user, which further expects a session)

CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO meta (key, value) VALUES ('version', '1');

CREATE TABLE users (
    id              INTEGER PRIMARY KEY,
    user_name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    user_email      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash       TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    deleted_at      TEXT    NULL,
    kill_after      TEXT    NULL
)

CREATE INDEX idx_users_email ON users(user_email);
CREATE INDEX idx_users_kill_after ON users(kill_after) WHERE kill_after IS NOT NULL;

CREATE TABLE teams (
    id              INTEGER PRIMARY KEY,
    team_name       TEXT    NOT NULL,
    invite_code     TEXT    NOT NULL UNIQUE,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by      INTEGER NOT NULL REFERENCES users(id),
    deleted_at      TEXT    NULL,
    kill_after      TEXT    NULL
)

CREATE TABLE team_members (
    id              INTEGER PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    display_name    TEXT    NOT NULL,
    member_role     TEXT    NOT NULL DEFAULT 'member'
                            CHECK (member_role IN ('admin', 'member')),
    joined_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    left_at         TEXT    NULL,
    UNIQUE (user_id, team_id)
);

CREATE INDEX idx_tm_memberships_user ON team_members(user_id);
CREATE INDEX idx_tm_memberships_team ON team_members(team_id);

CREATE TABLE projects (
    id              INTEGER PRIMARY KEY,
    title           TEXT    NOT NULL,
    for_team        INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    lead_by         INTEGER NULL REFERENCES team_members(id),
    deadline        TEXT    NULL,
    project_status  TEXT    NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed', 'abandoned')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    retired_at      TEXT    NULL,
    standup_retention_days  INTEGER NULL
);

CREATE TABLE standups (
    id              INTEGER PRIMARY KEY,
    posted_by       INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    for_project     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    worked_on       TEXT    NOT NULL,
    will_work_on    TEXT    NOT NULL,
    blocked_by      TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    kill_after      TEXT    NULL
)

CREATE TABLE user_sessions (
    id              INTEGER PRIMARY KEY,
    token           TEXT    NOT NULL UNIQUE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    expires_at      TEXT    NOT NULL,
    user_agent      TEXT    NULL,
    ip_address      TEXT    NULL,
    revoked_at      TEXT    NULL
)

CREATE INDEX idx_sessions_token ON user_sessions(token) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at) WHERE revoked_at IS NULL;