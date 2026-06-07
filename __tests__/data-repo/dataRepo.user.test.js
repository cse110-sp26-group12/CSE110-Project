import { createDatabaseConnection, setDb, resetDb } from '../../database/connection.js';
import { runDatabaseMigrations } from '../../database/migrate.js';
import { tempDbPath, cleanupDb } from '../../__test-helpers__/tempDb.js';
import { userRepo } from '../../data-repo/dataRepository.js';

//zoo wee mama
describe('userRepo', () => {
    let db;
    let dbPath;

    beforeEach(() => {
        dbPath = tempDbPath();
        db = createDatabaseConnection(dbPath);
        runDatabaseMigrations({ db });
        setDb(db);            // repo's getDb() now resolves to this connection
    });

    afterEach(() => {
        resetDb();            // closes db and clears the singleton
        cleanupDb(dbPath);    // removes the temp file + WAL sidecars
    });

    // Convenience: insert a user directly (bypassing the repo) for setup
    function seedUser({ user_name = 'alice', user_email = 'alice@example.com',
                        pass_hash = 'hash', created_at = '2026-01-01T00:00:00.000Z',
                        updated_at = '2026-01-01T00:00:00.000Z' } = {}) {
        const result = db.prepare(`
            INSERT INTO users (user_name, user_email, pass_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(user_name, user_email, pass_hash, created_at, updated_at);
        return Number(result.lastInsertRowid);
    }

    const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    // ---- create ---------------------------------------------------------

    describe('create', () => {
        it('inserts a user and returns the persisted row', () => {
            const user = userRepo.create({
                user_name: 'alice',
                user_email: 'alice@example.com',
                pass_hash: 'hashed_pw',
            });

            expect(user).toBeDefined();
            expect(user.id).toBeGreaterThan(0);
            expect(user.user_name).toBe('alice');
            expect(user.user_email).toBe('alice@example.com');
            expect(user.pass_hash).toBe('hashed_pw');
        });

        it('persists the row to the database', () => {
            const user = userRepo.create({
                user_name: 'bob',
                user_email: 'bob@example.com',
                pass_hash: 'pw',
            });

            // Read back directly, bypassing the repo
            const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
            expect(row.user_name).toBe('bob');
            expect(row.user_email).toBe('bob@example.com');
        });

        it('sets created_at and updated_at as equal ISO timestamps', () => {
            const user = userRepo.create({
                user_name: 'carol',
                user_email: 'carol@example.com',
                pass_hash: 'pw',
            });

            expect(user.created_at).toMatch(ISO_RE);
            expect(user.updated_at).toMatch(ISO_RE);
            expect(user.created_at).toBe(user.updated_at);
        });

        it('leaves deleted_at and kill_after null on creation', () => {
            const user = userRepo.create({
                user_name: 'dave',
                user_email: 'dave@example.com',
                pass_hash: 'pw',
            });

            expect(user.deleted_at).toBeNull();
            expect(user.kill_after).toBeNull();
        });

        it('throws on duplicate username (case-insensitive)', () => {
            userRepo.create({ user_name: 'eve', user_email: 'eve@example.com', pass_hash: 'pw' });

            expect(() => {
                userRepo.create({ user_name: 'EVE', user_email: 'other@example.com', pass_hash: 'pw' });
            }).toThrow(/UNIQUE/);
        });

        it('throws on duplicate email (case-insensitive)', () => {
            userRepo.create({ user_name: 'frank', user_email: 'frank@example.com', pass_hash: 'pw' });

            expect(() => {
                userRepo.create({ user_name: 'frank2', user_email: 'FRANK@example.com', pass_hash: 'pw' });
            }).toThrow(/UNIQUE/);
        });
    });

    // ---- findById -------------------------------------------------------

    describe('findById', () => {
        it('returns the matching user', () => {
            const id = seedUser({ user_name: 'alice' });
            const user = userRepo.findById(id);
            expect(user.id).toBe(id);
            expect(user.user_name).toBe('alice');
        });

        it('returns undefined for a nonexistent id', () => {
            expect(userRepo.findById(99999)).toBeUndefined();
        });

        it('excludes soft-deleted users by default', () => {
            const id = seedUser();
            db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);

            expect(userRepo.findById(id)).toBeUndefined();
        });

        it('includes soft-deleted users when includeDeleted is true', () => {
            const id = seedUser();
            db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);

            const user = userRepo.findById(id, { includeDeleted: true });
            expect(user).toBeDefined();
            expect(user.id).toBe(id);
        });
    });

    // ---- findByUsername -------------------------------------------------

    describe('findByUsername', () => {
        it('finds a user case-insensitively', () => {
            seedUser({ user_name: 'Alice' });
            const user = userRepo.findByUsername('alice');
            expect(user).toBeDefined();
            expect(user.user_name).toBe('Alice');
        });

        it('returns undefined when no match', () => {
            expect(userRepo.findByUsername('ghost')).toBeUndefined();
        });

        it('excludes soft-deleted by default', () => {
            const id = seedUser({ user_name: 'alice' });
            db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);
            expect(userRepo.findByUsername('alice')).toBeUndefined();
        });

        it('includes soft-deleted when requested', () => {
            const id = seedUser({ user_name: 'alice' });
            db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);
            expect(userRepo.findByUsername('alice', { includeDeleted: true })).toBeDefined();
        });
    });

    // ---- findByEmail ----------------------------------------------------

    describe('findByEmail', () => {
        it('finds a user case-insensitively', () => {
            seedUser({ user_email: 'Alice@Example.com' });
            const user = userRepo.findByEmail('alice@example.com');
            expect(user).toBeDefined();
            expect(user.user_email).toBe('Alice@Example.com');
        });

        it('returns undefined when no match', () => {
            expect(userRepo.findByEmail('nobody@example.com')).toBeUndefined();
        });

        it('excludes soft-deleted by default', () => {
            const id = seedUser({ user_email: 'a@b.com' });
            db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);
            expect(userRepo.findByEmail('a@b.com')).toBeUndefined();
        });
    });

    // ---- list -----------------------------------------------------------

    describe('list', () => {
        it('returns users newest-first by created_at', () => {
            seedUser({ user_name: 'old',   user_email: 'old@x.com',   created_at: '2026-01-01T00:00:00.000Z' });
            seedUser({ user_name: 'mid',   user_email: 'mid@x.com',   created_at: '2026-02-01T00:00:00.000Z' });
            seedUser({ user_name: 'new',   user_email: 'new@x.com',   created_at: '2026-03-01T00:00:00.000Z' });

            const users = userRepo.list();
            expect(users.map(u => u.user_name)).toEqual(['new', 'mid', 'old']);
        });

        it('excludes soft-deleted users by default', () => {
            seedUser({ user_name: 'active', user_email: 'active@x.com' });
            const deletedId = seedUser({ user_name: 'gone', user_email: 'gone@x.com' });
            db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', deletedId);

            const users = userRepo.list();
            expect(users).toHaveLength(1);
            expect(users[0].user_name).toBe('active');
        });

        it('includes soft-deleted when requested', () => {
            seedUser({ user_name: 'active', user_email: 'active@x.com' });
            const deletedId = seedUser({ user_name: 'gone', user_email: 'gone@x.com' });
            db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', deletedId);

            const users = userRepo.list({ includeDeleted: true });
            expect(users).toHaveLength(2);
        });

        it('respects limit', () => {
            for (let i = 0; i < 5; i++) {
                seedUser({ user_name: `u${i}`, user_email: `u${i}@x.com` });
            }
            const users = userRepo.list({ limit: 2 });
            expect(users).toHaveLength(2);
        });

        it('respects offset', () => {
            for (let i = 0; i < 5; i++) {
                seedUser({
                    user_name: `u${i}`, user_email: `u${i}@x.com`,
                    created_at: `2026-0${i + 1}-01T00:00:00.000Z`,
                });
            }
            // newest-first: u4, u3, u2, u1, u0 — offset 2 skips u4, u3
            const users = userRepo.list({ limit: 2, offset: 2 });
            expect(users.map(u => u.user_name)).toEqual(['u2', 'u1']);
        });

        it('returns an empty array when no users exist', () => {
            expect(userRepo.list()).toEqual([]);
        });
    });

    // ---- existsByUsername / existsByEmail -------------------------------

    describe('existsByUsername', () => {
        it('returns true when the username exists (case-insensitive)', () => {
            seedUser({ user_name: 'Alice' });
            expect(userRepo.existsByUsername('alice')).toBe(true);
        });

        it('returns false when the username does not exist', () => {
            expect(userRepo.existsByUsername('ghost')).toBe(false);
        });

        it('returns true even for soft-deleted users', () => {
            const id = seedUser({ user_name: 'alice' });
            db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);
            // existence check has no deleted_at filter — username is still taken
            expect(userRepo.existsByUsername('alice')).toBe(true);
        });
    });

    describe('existsByEmail', () => {
        it('returns true when the email exists (case-insensitive)', () => {
            seedUser({ user_email: 'Alice@Example.com' });
            expect(userRepo.existsByEmail('alice@example.com')).toBe(true);
        });

        it('returns false when the email does not exist', () => {
            expect(userRepo.existsByEmail('nobody@example.com')).toBe(false);
        });
    });

    // ---- update ---------------------------------------------------------

    describe('update', () => {
        it('updates whitelisted fields and returns the new row', () => {
            const id = seedUser({ user_name: 'old_name', user_email: 'old@x.com' });
            const updated = userRepo.update(id, { user_name: 'new_name' });

            expect(updated.user_name).toBe('new_name');
            expect(updated.user_email).toBe('old@x.com'); // untouched
        });

        it('persists the change to the database', () => {
            const id = seedUser({ user_name: 'old_name' });
            userRepo.update(id, { user_name: 'new_name' });

            const row = db.prepare('SELECT user_name FROM users WHERE id = ?').get(id);
            expect(row.user_name).toBe('new_name');
        });

        it('refreshes updated_at to a new ISO timestamp', () => {
            const id = seedUser({ updated_at: '2020-01-01T00:00:00.000Z' });
            const updated = userRepo.update(id, { user_name: 'changed' });

            expect(updated.updated_at).toMatch(ISO_RE);
            expect(updated.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });

        it('does not modify created_at', () => {
            const id = seedUser({ created_at: '2020-01-01T00:00:00.000Z' });
            const updated = userRepo.update(id, { user_name: 'changed' });
            expect(updated.created_at).toBe('2020-01-01T00:00:00.000Z');
        });

        it('ignores non-whitelisted keys', () => {
            const id = seedUser();
            const updated = userRepo.update(id, {
                user_name: 'legit',
                id: 9999,                 // must be ignored
                created_at: 'hacked',     // must be ignored
                deleted_at: 'hacked',     // must be ignored
            });

            expect(updated.id).toBe(id);                 // id unchanged
            expect(updated.user_name).toBe('legit');
            expect(updated.created_at).not.toBe('hacked');
            expect(updated.deleted_at).toBeNull();
        });

        it('returns the unmodified row when no valid fields are given', () => {
            const id = seedUser({ user_name: 'unchanged', updated_at: '2020-01-01T00:00:00.000Z' });
            const result = userRepo.update(id, { not_a_field: 'x' });

            expect(result.user_name).toBe('unchanged');
            expect(result.updated_at).toBe('2020-01-01T00:00:00.000Z'); // not bumped
        });

        it('can update a soft-deleted user', () => {
            const id = seedUser();
            db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
              .run('2026-01-02T00:00:00.000Z', id);

            const updated = userRepo.update(id, { user_name: 'still_editable' });
            expect(updated).toBeDefined();
            expect(updated.user_name).toBe('still_editable');
        });

        it('updates multiple fields at once', () => {
            const id = seedUser();
            const updated = userRepo.update(id, {
                user_name: 'newname',
                user_email: 'newemail@x.com',
                pass_hash: 'newhash',
            });
            expect(updated.user_name).toBe('newname');
            expect(updated.user_email).toBe('newemail@x.com');
            expect(updated.pass_hash).toBe('newhash');
        });
    });

    // ---- softDelete -----------------------------------------------------

    describe('softDelete', () => {
        it('sets deleted_at and kill_after, returns the row', () => {
            const id = seedUser();
            const killAfter = '2026-12-31T00:00:00.000Z';
            const result = userRepo.softDelete(id, killAfter);

            expect(result.deleted_at).toMatch(ISO_RE);
            expect(result.kill_after).toBe(killAfter);
        });

        it('persists the soft-delete to the database', () => {
            const id = seedUser();
            userRepo.softDelete(id, '2026-12-31T00:00:00.000Z');

            const row = db.prepare('SELECT deleted_at, kill_after FROM users WHERE id = ?').get(id);
            expect(row.deleted_at).not.toBeNull();
            expect(row.kill_after).toBe('2026-12-31T00:00:00.000Z');
        });

        it('makes the user invisible to default findById', () => {
            const id = seedUser();
            userRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            expect(userRepo.findById(id)).toBeUndefined();
            expect(userRepo.findById(id, { includeDeleted: true })).toBeDefined();
        });

        it('does not re-soft-delete an already-deleted user', () => {
            const id = seedUser();
            const first = userRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            const firstDeletedAt = first.deleted_at;

            // Second call: WHERE deleted_at IS NULL means no row matches, so no change
            const second = userRepo.softDelete(id, '2099-01-01T00:00:00.000Z');
            expect(second.deleted_at).toBe(firstDeletedAt);
            expect(second.kill_after).toBe('2026-12-31T00:00:00.000Z'); // unchanged
        });

        it('refreshes updated_at', () => {
            const id = seedUser({ updated_at: '2020-01-01T00:00:00.000Z' });
            const result = userRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            expect(result.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });
    });

    // ---- restore --------------------------------------------------------

    describe('restore', () => {
        it('clears deleted_at and kill_after', () => {
            const id = seedUser();
            userRepo.softDelete(id, '2026-12-31T00:00:00.000Z');

            const restored = userRepo.restore(id);
            expect(restored.deleted_at).toBeNull();
            expect(restored.kill_after).toBeNull();
        });

        it('makes the user visible to default findById again', () => {
            const id = seedUser();
            userRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            userRepo.restore(id);
            expect(userRepo.findById(id)).toBeDefined();
        });

        it('persists the restore to the database', () => {
            const id = seedUser();
            userRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            userRepo.restore(id);

            const row = db.prepare('SELECT deleted_at, kill_after FROM users WHERE id = ?').get(id);
            expect(row.deleted_at).toBeNull();
            expect(row.kill_after).toBeNull();
        });

        it('refreshes updated_at', () => {
            const id = seedUser({ updated_at: '2020-01-01T00:00:00.000Z' });
            userRepo.softDelete(id, '2026-12-31T00:00:00.000Z');
            const restored = userRepo.restore(id);
            expect(restored.updated_at).toMatch(ISO_RE);
        });
    });

    // ---- hardDelete -----------------------------------------------------

    describe('hardDelete', () => {
        it('removes the row and returns true', () => {
            const id = seedUser();
            const ok = userRepo.hardDelete(id);

            expect(ok).toBe(true);
            const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
            expect(row).toBeUndefined();
        });

        it('returns false when the user does not exist', () => {
            expect(userRepo.hardDelete(99999)).toBe(false);
        });

        it('cascades to dependent rows (team_members)', () => {
            // Set up: an owner (so the team has a valid owned_by that we won't delete),
            // a member user, a team, and the member's membership.
            const ownerId = seedUser({ user_name: 'owner', user_email: 'owner@x.com' });
            const memberId = seedUser({ user_name: 'member', user_email: 'member@x.com' });

            const teamId = Number(db.prepare(`
                INSERT INTO teams (team_name, invite_code, owned_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            `).run('Alpha', 'invite1', ownerId, '2026-01-01T00:00:00.000Z',
                   '2026-01-01T00:00:00.000Z').lastInsertRowid);

            db.prepare(`
                INSERT INTO team_members (user_id, team_id, display_name, joined_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(memberId, teamId, 'Member', '2026-01-01T00:00:00.000Z',
                   '2026-01-01T00:00:00.000Z');

            // Hard-delete the member — their membership should cascade away
            userRepo.hardDelete(memberId);

            const memberships = db.prepare(
                'SELECT * FROM team_members WHERE user_id = ?'
            ).all(memberId);
            expect(memberships).toEqual([]);
        });

        it('is blocked by ON DELETE RESTRICT when user owns a team', () => {
            const ownerId = seedUser({ user_name: 'owner', user_email: 'owner@x.com' });
            db.prepare(`
                INSERT INTO teams (team_name, invite_code, owned_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            `).run('Alpha', 'invite1', ownerId, '2026-01-01T00:00:00.000Z',
                   '2026-01-01T00:00:00.000Z');

            // teams.owned_by has ON DELETE RESTRICT — deletion must throw
            expect(() => userRepo.hardDelete(ownerId)).toThrow(/FOREIGN KEY/i);
        });
    });

    // ---- listExpiredUsers ----------------------------------------------

    describe('listExpiredUsers', () => {
        it('returns users whose kill_after is in the past', () => {
            const expiredId = seedUser({ user_name: 'expired', user_email: 'exp@x.com' });
            db.prepare('UPDATE users SET deleted_at = ?, kill_after = ? WHERE id = ?')
              .run('2020-01-01T00:00:00.000Z', '2020-02-01T00:00:00.000Z', expiredId);

            const expired = userRepo.listExpiredUsers();
            expect(expired.map(u => u.id)).toContain(expiredId);
        });

        it('excludes users whose kill_after is in the future', () => {
            const futureId = seedUser({ user_name: 'future', user_email: 'fut@x.com' });
            db.prepare('UPDATE users SET deleted_at = ?, kill_after = ? WHERE id = ?')
              .run('2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z', futureId);

            const expired = userRepo.listExpiredUsers();
            expect(expired.map(u => u.id)).not.toContain(futureId);
        });

        it('excludes users with null kill_after (active users)', () => {
            const activeId = seedUser({ user_name: 'active', user_email: 'act@x.com' });

            const expired = userRepo.listExpiredUsers();
            expect(expired.map(u => u.id)).not.toContain(activeId);
        });

        it('returns an empty array when nothing is due', () => {
            seedUser();
            expect(userRepo.listExpiredUsers()).toEqual([]);
        });
    });
});