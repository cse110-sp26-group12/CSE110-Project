import { createDatabaseConnection, setDb, resetDb } from '../../database/connection.js';
import { runDatabaseMigrations } from '../../database/migrate.js';
import { tempDbPath, cleanupDb } from '../../__test-helpers__/tempDb.js';
import { teamRepo } from '../../data-repo/dataRepository.js';

describe('teamRepo', () => {
    let db;
    let dbPath;

    beforeEach(() => {
        dbPath = tempDbPath();
        db = createDatabaseConnection(dbPath);
        runDatabaseMigrations({ db });
        setDb(db);
    });

    afterEach(() => {
        resetDb();
        cleanupDb(dbPath);
    });

    // ---- seed helpers (bypass the repo) ---------------------------------

    // Teams require an owner (FK -> users.id), so most team setup needs a user first.
    function seedUser({ user_name = 'owner', user_email = 'owner@example.com',
                        pass_hash = 'hash', created_at = '2026-01-01T00:00:00.000Z',
                        updated_at = '2026-01-01T00:00:00.000Z' } = {}) {
        const result = db.prepare(`
            INSERT INTO users (user_name, user_email, pass_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(user_name, user_email, pass_hash, created_at, updated_at);
        return Number(result.lastInsertRowid);
    }

    function seedTeam({ team_name = 'Alpha', invite_code = 'invite1', owned_by,
                        standup_retention_days = null,
                        created_at = '2026-01-01T00:00:00.000Z',
                        updated_at = '2026-01-01T00:00:00.000Z' }) {
        const result = db.prepare(`
            INSERT INTO teams (team_name, invite_code, owned_by, standup_retention_days, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(team_name, invite_code, owned_by, standup_retention_days, created_at, updated_at);
        return Number(result.lastInsertRowid);
    }

    function seedMembership({ user_id, team_id, display_name = 'Member',
                              member_role = 'member',
                              joined_at = '2026-01-01T00:00:00.000Z',
                              updated_at = '2026-01-01T00:00:00.000Z' }) {
        const result = db.prepare(`
            INSERT INTO team_members (user_id, team_id, display_name, member_role, joined_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(user_id, team_id, display_name, member_role, joined_at, updated_at);
        return Number(result.lastInsertRowid);
    }

    function seedStandup({ posted_by, for_team,
                           created_at = '2026-01-01T00:00:00.000Z',
                           updated_at = '2026-01-01T00:00:00.000Z' }) {
        const result = db.prepare(`
            INSERT INTO standups (posted_by, for_team, worked_on, will_work_on, blocked_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(posted_by, for_team, 'did stuff', 'will do stuff', null, created_at, updated_at);
        return Number(result.lastInsertRowid);
    }

    const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    // ---- create ---------------------------------------------------------

    describe('create', () => {
        it('inserts a team and returns the persisted row', () => {
            const ownerId = seedUser();
            const team = teamRepo.create({
                team_name: 'Bravo',
                invite_code: 'code-bravo',
                owned_by: ownerId,
            });

            expect(team).toBeDefined();
            expect(team.id).toBeGreaterThan(0);
            expect(team.team_name).toBe('Bravo');
            expect(team.invite_code).toBe('code-bravo');
            expect(team.owned_by).toBe(ownerId);
        });

        it('persists the row to the database', () => {
            const ownerId = seedUser();
            const team = teamRepo.create({
                team_name: 'Charlie',
                invite_code: 'code-charlie',
                owned_by: ownerId,
            });

            const row = db.prepare('SELECT * FROM teams WHERE id = ?').get(team.id);
            expect(row.team_name).toBe('Charlie');
            expect(row.invite_code).toBe('code-charlie');
        });

        it('sets created_at and updated_at as equal ISO timestamps', () => {
            const ownerId = seedUser();
            const team = teamRepo.create({
                team_name: 'Delta',
                invite_code: 'code-delta',
                owned_by: ownerId,
            });

            expect(team.created_at).toMatch(ISO_RE);
            expect(team.updated_at).toMatch(ISO_RE);
            expect(team.created_at).toBe(team.updated_at);
        });

        it('defaults standup_retention_days to null when omitted', () => {
            const ownerId = seedUser();
            const team = teamRepo.create({
                team_name: 'Echo',
                invite_code: 'code-echo',
                owned_by: ownerId,
            });

            expect(team.standup_retention_days).toBeNull();
        });

        it('stores standup_retention_days when provided', () => {
            const ownerId = seedUser();
            const team = teamRepo.create({
                team_name: 'Foxtrot',
                invite_code: 'code-foxtrot',
                owned_by: ownerId,
                standup_retention_days: 30,
            });

            expect(team.standup_retention_days).toBe(30);
        });

        it('leaves deleted_at and kill_after null on creation', () => {
            const ownerId = seedUser();
            const team = teamRepo.create({
                team_name: 'Golf',
                invite_code: 'code-golf',
                owned_by: ownerId,
            });

            expect(team.deleted_at).toBeNull();
            expect(team.kill_after).toBeNull();
        });

        it('throws on duplicate invite_code', () => {
            const ownerId = seedUser();
            teamRepo.create({ team_name: 'One', invite_code: 'dup', owned_by: ownerId });

            expect(() => {
                teamRepo.create({ team_name: 'Two', invite_code: 'dup', owned_by: ownerId });
            }).toThrow(/UNIQUE/);
        });

        it('throws when owned_by references a nonexistent user', () => {
            expect(() => {
                teamRepo.create({ team_name: 'Ghost', invite_code: 'ghost', owned_by: 99999 });
            }).toThrow(/FOREIGN KEY/i);
        });

        it('allows two teams with the same name but different invite codes', () => {
            const ownerId = seedUser();
            const a = teamRepo.create({ team_name: 'Same', invite_code: 'a', owned_by: ownerId });
            const b = teamRepo.create({ team_name: 'Same', invite_code: 'b', owned_by: ownerId });
            expect(a.id).not.toBe(b.id);
        });
    });

    // ---- findById -------------------------------------------------------

    describe('findById', () => {
        it('returns the matching team', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, team_name: 'Alpha' });
            const team = teamRepo.findById(id);
            expect(team.id).toBe(id);
            expect(team.team_name).toBe('Alpha');
        });

        it('returns undefined for a nonexistent id', () => {
            expect(teamRepo.findById(99999)).toBeUndefined();
        });

        it('excludes soft-deleted teams by default', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);

            expect(teamRepo.findById(id)).toBeUndefined();
        });

        it('includes soft-deleted teams when includeDeleted is true', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);

            const team = teamRepo.findById(id, { includeDeleted: true });
            expect(team).toBeDefined();
            expect(team.id).toBe(id);
        });
    });

    // ---- findByInviteCode -----------------------------------------------

    describe('findByInviteCode', () => {
        it('returns the matching team', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, invite_code: 'find-me' });
            const team = teamRepo.findByInviteCode('find-me');
            expect(team).toBeDefined();
            expect(team.invite_code).toBe('find-me');
        });

        it('returns undefined when no match', () => {
            expect(teamRepo.findByInviteCode('does-not-exist')).toBeUndefined();
        });

        it('is case-sensitive (invite codes are exact)', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, invite_code: 'CaseSensitive' });
            // No COLLATE NOCASE on invite_code, so a different case must not match
            expect(teamRepo.findByInviteCode('casesensitive')).toBeUndefined();
        });

        it('excludes soft-deleted by default', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, invite_code: 'gone' });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);
            expect(teamRepo.findByInviteCode('gone')).toBeUndefined();
        });

        it('includes soft-deleted when requested', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, invite_code: 'gone' });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);
            expect(teamRepo.findByInviteCode('gone', { includeDeleted: true })).toBeDefined();
        });
    });

    // ---- listByOwner ----------------------------------------------------

    describe('listByOwner', () => {
        it('returns only teams owned by the given user', () => {
            const ownerA = seedUser({ user_name: 'a', user_email: 'a@x.com' });
            const ownerB = seedUser({ user_name: 'b', user_email: 'b@x.com' });
            seedTeam({ owned_by: ownerA, team_name: 'A1', invite_code: 'a1' });
            seedTeam({ owned_by: ownerA, team_name: 'A2', invite_code: 'a2' });
            seedTeam({ owned_by: ownerB, team_name: 'B1', invite_code: 'b1' });

            const teams = teamRepo.listByOwner(ownerA);
            expect(teams).toHaveLength(2);
            expect(teams.map(t => t.team_name).sort()).toEqual(['A1', 'A2']);
        });

        it('orders newest-first by created_at', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, team_name: 'old', invite_code: 'o', created_at: '2026-01-01T00:00:00.000Z' });
            seedTeam({ owned_by: ownerId, team_name: 'mid', invite_code: 'm', created_at: '2026-02-01T00:00:00.000Z' });
            seedTeam({ owned_by: ownerId, team_name: 'new', invite_code: 'n', created_at: '2026-03-01T00:00:00.000Z' });

            const teams = teamRepo.listByOwner(ownerId);
            expect(teams.map(t => t.team_name)).toEqual(['new', 'mid', 'old']);
        });

        it('excludes soft-deleted teams by default', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, team_name: 'active', invite_code: 'act' });
            const goneId = seedTeam({ owned_by: ownerId, team_name: 'gone', invite_code: 'gn' });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', goneId);

            const teams = teamRepo.listByOwner(ownerId);
            expect(teams).toHaveLength(1);
            expect(teams[0].team_name).toBe('active');
        });

        it('includes soft-deleted when requested', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, team_name: 'active', invite_code: 'act' });
            const goneId = seedTeam({ owned_by: ownerId, team_name: 'gone', invite_code: 'gn' });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', goneId);

            const teams = teamRepo.listByOwner(ownerId, { includeDeleted: true });
            expect(teams).toHaveLength(2);
        });

        it('returns an empty array when the user owns no teams', () => {
            const ownerId = seedUser();
            expect(teamRepo.listByOwner(ownerId)).toEqual([]);
        });
    });

    // ---- list -----------------------------------------------------------

    describe('list', () => {
        it('returns teams newest-first by created_at', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, team_name: 'old', invite_code: 'o', created_at: '2026-01-01T00:00:00.000Z' });
            seedTeam({ owned_by: ownerId, team_name: 'mid', invite_code: 'm', created_at: '2026-02-01T00:00:00.000Z' });
            seedTeam({ owned_by: ownerId, team_name: 'new', invite_code: 'n', created_at: '2026-03-01T00:00:00.000Z' });

            const teams = teamRepo.list();
            expect(teams.map(t => t.team_name)).toEqual(['new', 'mid', 'old']);
        });

        it('excludes soft-deleted teams by default', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, team_name: 'active', invite_code: 'act' });
            const goneId = seedTeam({ owned_by: ownerId, team_name: 'gone', invite_code: 'gn' });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', goneId);

            const teams = teamRepo.list();
            expect(teams).toHaveLength(1);
            expect(teams[0].team_name).toBe('active');
        });

        it('includes soft-deleted when requested', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, team_name: 'active', invite_code: 'act' });
            const goneId = seedTeam({ owned_by: ownerId, team_name: 'gone', invite_code: 'gn' });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', goneId);

            const teams = teamRepo.list({ includeDeleted: true });
            expect(teams).toHaveLength(2);
        });

        it('respects limit', () => {
            const ownerId = seedUser();
            for (let i = 0; i < 5; i++) {
                seedTeam({ owned_by: ownerId, team_name: `t${i}`, invite_code: `code${i}` });
            }
            const teams = teamRepo.list({ limit: 2 });
            expect(teams).toHaveLength(2);
        });

        it('respects offset', () => {
            const ownerId = seedUser();
            for (let i = 0; i < 5; i++) {
                seedTeam({
                    owned_by: ownerId, team_name: `t${i}`, invite_code: `code${i}`,
                    created_at: `2026-0${i + 1}-01T00:00:00.000Z`,
                });
            }
            // newest-first: t4, t3, t2, t1, t0 — offset 2 skips t4, t3
            const teams = teamRepo.list({ limit: 2, offset: 2 });
            expect(teams.map(t => t.team_name)).toEqual(['t2', 't1']);
        });

        it('returns an empty array when no teams exist', () => {
            expect(teamRepo.list()).toEqual([]);
        });
    });

    // ---- existsByInviteCode ---------------------------------------------

    describe('existsByInviteCode', () => {
        it('returns true when the invite code exists', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, invite_code: 'taken' });
            expect(teamRepo.existsByInviteCode('taken')).toBe(true);
        });

        it('returns false when the invite code does not exist', () => {
            expect(teamRepo.existsByInviteCode('free')).toBe(false);
        });

        it('returns true even for soft-deleted teams', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, invite_code: 'taken' });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);
            // existence check has no deleted_at filter — code is still reserved
            expect(teamRepo.existsByInviteCode('taken')).toBe(true);
        });
    });

    // ---- countActiveByOwner ---------------------------------------------

    describe('countActiveByOwner', () => {
        it('counts active teams owned by the user', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, team_name: 'A', invite_code: 'a' });
            seedTeam({ owned_by: ownerId, team_name: 'B', invite_code: 'b' });
            expect(teamRepo.countActiveByOwner(ownerId)).toBe(2);
        });

        it('returns 0 when the user owns no teams', () => {
            const ownerId = seedUser();
            expect(teamRepo.countActiveByOwner(ownerId)).toBe(0);
        });

        it('excludes soft-deleted teams from the count', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, team_name: 'active', invite_code: 'act' });
            const goneId = seedTeam({ owned_by: ownerId, team_name: 'gone', invite_code: 'gn' });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', goneId);

            expect(teamRepo.countActiveByOwner(ownerId)).toBe(1);
        });

        it('does not count teams owned by other users', () => {
            const ownerA = seedUser({ user_name: 'a', user_email: 'a@x.com' });
            const ownerB = seedUser({ user_name: 'b', user_email: 'b@x.com' });
            seedTeam({ owned_by: ownerA, team_name: 'A', invite_code: 'a' });
            seedTeam({ owned_by: ownerB, team_name: 'B', invite_code: 'b' });

            expect(teamRepo.countActiveByOwner(ownerA)).toBe(1);
        });
    });

    // ---- update ---------------------------------------------------------

    describe('update', () => {
        it('updates whitelisted fields and returns the new row', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, team_name: 'old_name' });
            const updated = teamRepo.update(id, { team_name: 'new_name' });

            expect(updated.team_name).toBe('new_name');
        });

        it('persists the change to the database', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, team_name: 'old_name' });
            teamRepo.update(id, { team_name: 'new_name' });

            const row = db.prepare('SELECT team_name FROM teams WHERE id = ?').get(id);
            expect(row.team_name).toBe('new_name');
        });

        it('updates standup_retention_days', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            const updated = teamRepo.update(id, { standup_retention_days: 14 });
            expect(updated.standup_retention_days).toBe(14);
        });

        it('transfers ownership via owned_by', () => {
            const ownerA = seedUser({ user_name: 'a', user_email: 'a@x.com' });
            const ownerB = seedUser({ user_name: 'b', user_email: 'b@x.com' });
            const id = seedTeam({ owned_by: ownerA });

            const updated = teamRepo.update(id, { owned_by: ownerB });
            expect(updated.owned_by).toBe(ownerB);
        });

        it('refreshes updated_at to a new ISO timestamp', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, updated_at: '2020-01-01T00:00:00.000Z' });
            const updated = teamRepo.update(id, { team_name: 'changed' });

            expect(updated.updated_at).toMatch(ISO_RE);
            expect(updated.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });

        it('does not modify created_at', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, created_at: '2020-01-01T00:00:00.000Z' });
            const updated = teamRepo.update(id, { team_name: 'changed' });
            expect(updated.created_at).toBe('2020-01-01T00:00:00.000Z');
        });

        it('ignores non-whitelisted keys (including invite_code)', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, invite_code: 'original' });
            const updated = teamRepo.update(id, {
                team_name: 'legit',
                id: 9999,                  // must be ignored
                invite_code: 'hacked',     // must be ignored — rotation has its own method
                created_at: 'hacked',      // must be ignored
                deleted_at: 'hacked',      // must be ignored
            });

            expect(updated.id).toBe(id);
            expect(updated.team_name).toBe('legit');
            expect(updated.invite_code).toBe('original'); // unchanged
            expect(updated.created_at).not.toBe('hacked');
            expect(updated.deleted_at).toBeNull();
        });

        it('returns the unmodified row when no valid fields are given', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, team_name: 'unchanged', updated_at: '2020-01-01T00:00:00.000Z' });
            const result = teamRepo.update(id, { not_a_field: 'x' });

            expect(result.team_name).toBe('unchanged');
            expect(result.updated_at).toBe('2020-01-01T00:00:00.000Z'); // not bumped
        });

        it('can update a soft-deleted team', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            db.prepare('UPDATE teams SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);

            const updated = teamRepo.update(id, { team_name: 'still_editable' });
            expect(updated).toBeDefined();
            expect(updated.team_name).toBe('still_editable');
        });
    });

    // ---- rotateInviteCode -----------------------------------------------

    describe('rotateInviteCode', () => {
        it('replaces the invite code and returns the row', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, invite_code: 'old-code' });
            const updated = teamRepo.rotateInviteCode(id, 'new-code');

            expect(updated.invite_code).toBe('new-code');
        });

        it('persists the new code to the database', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, invite_code: 'old-code' });
            teamRepo.rotateInviteCode(id, 'new-code');

            const row = db.prepare('SELECT invite_code FROM teams WHERE id = ?').get(id);
            expect(row.invite_code).toBe('new-code');
        });

        it('makes the old code no longer resolve', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, invite_code: 'old-code' });
            teamRepo.rotateInviteCode(id, 'new-code');

            expect(teamRepo.findByInviteCode('old-code')).toBeUndefined();
            expect(teamRepo.findByInviteCode('new-code')).toBeDefined();
        });

        it('refreshes updated_at', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, invite_code: 'old', updated_at: '2020-01-01T00:00:00.000Z' });
            const updated = teamRepo.rotateInviteCode(id, 'new');

            expect(updated.updated_at).toMatch(ISO_RE);
            expect(updated.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });

        it('throws when rotating to a code already in use by another team', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId, team_name: 'A', invite_code: 'taken' });
            const idB = seedTeam({ owned_by: ownerId, team_name: 'B', invite_code: 'free' });

            expect(() => teamRepo.rotateInviteCode(idB, 'taken')).toThrow(/UNIQUE/);
        });
    });

    // ---- softDelete -----------------------------------------------------

    describe('softDelete', () => {
        it('sets deleted_at and kill_after, returns the row', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            const killAfter = '2026-12-31T00:00:00.000Z';
            const result = teamRepo.softDelete(id, killAfter);

            expect(result.deleted_at).toMatch(ISO_RE);
            expect(result.kill_after).toBe(killAfter);
        });

        it('persists the soft-delete to the database', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            teamRepo.softDelete(id, '2026-12-31T00:00:00.000Z');

            const row = db.prepare('SELECT deleted_at, kill_after FROM teams WHERE id = ?').get(id);
            expect(row.deleted_at).not.toBeNull();
            expect(row.kill_after).toBe('2026-12-31T00:00:00.000Z');
        });

        it('makes the team invisible to default findById', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            teamRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            expect(teamRepo.findById(id)).toBeUndefined();
            expect(teamRepo.findById(id, { includeDeleted: true })).toBeDefined();
        });

        it('does not re-soft-delete an already-deleted team', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            const first = teamRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            const firstDeletedAt = first.deleted_at;

            const second = teamRepo.softDelete(id, '2099-01-01T00:00:00.000Z');
            expect(second.deleted_at).toBe(firstDeletedAt);
            expect(second.kill_after).toBe('2026-12-31T00:00:00.000Z'); // unchanged
        });

        it('refreshes updated_at', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, updated_at: '2020-01-01T00:00:00.000Z' });
            const result = teamRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            expect(result.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });
    });

    // ---- restore --------------------------------------------------------

    describe('restore', () => {
        it('clears deleted_at and kill_after', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            teamRepo.softDelete(id, '2026-12-31T00:00:00.000Z');

            const restored = teamRepo.restore(id);
            expect(restored.deleted_at).toBeNull();
            expect(restored.kill_after).toBeNull();
        });

        it('makes the team visible to default findById again', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            teamRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            teamRepo.restore(id);
            expect(teamRepo.findById(id)).toBeDefined();
        });

        it('persists the restore to the database', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            teamRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            teamRepo.restore(id);

            const row = db.prepare('SELECT deleted_at, kill_after FROM teams WHERE id = ?').get(id);
            expect(row.deleted_at).toBeNull();
            expect(row.kill_after).toBeNull();
        });

        it('refreshes updated_at', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId, updated_at: '2020-01-01T00:00:00.000Z' });
            teamRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            const restored = teamRepo.restore(id);
            expect(restored.updated_at).toMatch(ISO_RE);
        });
    });

    // ---- hardDelete -----------------------------------------------------

    describe('hardDelete', () => {
        it('removes the row and returns true', () => {
            const ownerId = seedUser();
            const id = seedTeam({ owned_by: ownerId });
            const ok = teamRepo.hardDelete(id);

            expect(ok).toBe(true);
            const row = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
            expect(row).toBeUndefined();
        });

        it('returns false when the team does not exist', () => {
            expect(teamRepo.hardDelete(99999)).toBe(false);
        });

        it('cascades to dependent rows (team_members)', () => {
            const ownerId = seedUser({ user_name: 'owner', user_email: 'owner@x.com' });
            const memberId = seedUser({ user_name: 'member', user_email: 'member@x.com' });
            const teamId = seedTeam({ owned_by: ownerId });
            seedMembership({ user_id: memberId, team_id: teamId });

            teamRepo.hardDelete(teamId);

            const memberships = db.prepare(
                'SELECT * FROM team_members WHERE team_id = ?'
            ).all(teamId);
            expect(memberships).toEqual([]);
        });

        it('cascades to dependent rows (standups)', () => {
            const ownerId = seedUser({ user_name: 'owner', user_email: 'owner@x.com' });
            const memberId = seedUser({ user_name: 'member', user_email: 'member@x.com' });
            const teamId = seedTeam({ owned_by: ownerId });
            const membershipId = seedMembership({ user_id: memberId, team_id: teamId });
            seedStandup({ posted_by: membershipId, for_team: teamId });

            teamRepo.hardDelete(teamId);

            const standups = db.prepare(
                'SELECT * FROM standups WHERE for_team = ?'
            ).all(teamId);
            expect(standups).toEqual([]);
        });
    });

    // ---- listExpiredTeams ----------------------------------------------

    describe('listExpiredTeams', () => {
        it('returns teams whose kill_after is in the past', () => {
            const ownerId = seedUser();
            const expiredId = seedTeam({ owned_by: ownerId, team_name: 'expired', invite_code: 'exp' });
            db.prepare('UPDATE teams SET deleted_at = ?, kill_after = ? WHERE id = ?')
              .run('2020-01-01T00:00:00.000Z', '2020-02-01T00:00:00.000Z', expiredId);

            const expired = teamRepo.listExpiredTeams();
            expect(expired.map(t => t.id)).toContain(expiredId);
        });

        it('excludes teams whose kill_after is in the future', () => {
            const ownerId = seedUser();
            const futureId = seedTeam({ owned_by: ownerId, team_name: 'future', invite_code: 'fut' });
            db.prepare('UPDATE teams SET deleted_at = ?, kill_after = ? WHERE id = ?')
              .run('2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z', futureId);

            const expired = teamRepo.listExpiredTeams();
            expect(expired.map(t => t.id)).not.toContain(futureId);
        });

        it('excludes teams with null kill_after (active teams)', () => {
            const ownerId = seedUser();
            const activeId = seedTeam({ owned_by: ownerId, team_name: 'active', invite_code: 'act' });

            const expired = teamRepo.listExpiredTeams();
            expect(expired.map(t => t.id)).not.toContain(activeId);
        });

        it('returns an empty array when nothing is due', () => {
            const ownerId = seedUser();
            seedTeam({ owned_by: ownerId });
            expect(teamRepo.listExpiredTeams()).toEqual([]);
        });
    });
});