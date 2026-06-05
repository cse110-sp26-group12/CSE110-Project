import { createDatabaseConnection, setDb, resetDb } from '../../database/connection.js';
import { runDatabaseMigrations } from '../../database/migrate.js';
import { tempDbPath, cleanupDb } from '../../__test-helpers__/tempDb.js';
import { sessionRepo } from '../../data-repo/dataRepository.js';

describe('sessionRepo', () => {
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

    let userSeq = 0;
    function seedUser({ user_name, user_email,
                        pass_hash = 'hash',
                        created_at = '2026-01-01T00:00:00.000Z',
                        updated_at = '2026-01-01T00:00:00.000Z' } = {}) {
        userSeq += 1;
        const name = user_name ?? `user${userSeq}`;
        const email = user_email ?? `user${userSeq}@x.com`;
        const result = db.prepare(`
            INSERT INTO users (user_name, user_email, pass_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(name, email, pass_hash, created_at, updated_at);
        return Number(result.lastInsertRowid);
    }

    let tokenSeq = 0;
    function seedSession({ user_id, token_hash,
                           created_at = '2026-01-01T00:00:00.000Z',
                           expires_at, revoked_at = null,
                           user_agent = null, ip_address = null }) {
        tokenSeq += 1;
        const result = db.prepare(`
            INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at, user_agent, ip_address, revoked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(token_hash ?? `tok-${tokenSeq}`, user_id, created_at,
               expires_at, user_agent, ip_address, revoked_at);
        return Number(result.lastInsertRowid);
    }

    // Far-future and far-past expiry constants for clear validity setup.
    const FUTURE = '2099-01-01T00:00:00.000Z';
    const PAST = '2020-01-01T00:00:00.000Z';
    const REVOKED_TS = '2026-02-01T00:00:00.000Z';

    const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    // ---- create ---------------------------------------------------------

    describe('create', () => {
        it('inserts a session and returns the persisted row', () => {
            const userId = seedUser();
            const s = sessionRepo.create({
                token_hash: 'tok-abc',
                user_id: userId,
                expires_at: FUTURE,
                user_agent: 'Mozilla/5.0',
                ip_address: '203.0.113.5',
            });

            expect(s).toBeDefined();
            expect(s.id).toBeGreaterThan(0);
            expect(s.token_hash).toBe('tok-abc');
            expect(s.user_id).toBe(userId);
            expect(s.expires_at).toBe(FUTURE);
            expect(s.user_agent).toBe('Mozilla/5.0');
            expect(s.ip_address).toBe('203.0.113.5');
        });

        it('persists the row to the database', () => {
            const userId = seedUser();
            const s = sessionRepo.create({ token_hash: 'tok-xyz', user_id: userId, expires_at: FUTURE });
            const row = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(s.id);
            expect(row.token_hash).toBe('tok-xyz');
            expect(row.user_id).toBe(userId);
        });

        it('defaults user_agent and ip_address to null when omitted', () => {
            const userId = seedUser();
            const s = sessionRepo.create({ token_hash: 'tok-min', user_id: userId, expires_at: FUTURE });
            expect(s.user_agent).toBeNull();
            expect(s.ip_address).toBeNull();
        });

        it('sets created_at as an ISO timestamp and leaves revoked_at null', () => {
            const userId = seedUser();
            const s = sessionRepo.create({ token_hash: 'tok-ts', user_id: userId, expires_at: FUTURE });
            expect(s.created_at).toMatch(ISO_RE);
            expect(s.revoked_at).toBeNull();
        });

        it('throws on a duplicate token', () => {
            const userId = seedUser();
            sessionRepo.create({ token_hash: 'dup', user_id: userId, expires_at: FUTURE });
            expect(() => {
                sessionRepo.create({ token_hash: 'dup', user_id: userId, expires_at: FUTURE });
            }).toThrow(/UNIQUE/);
        });

        it('throws when user_id references a nonexistent user', () => {
            expect(() => {
                sessionRepo.create({ token_hash: 'tok-ghost', user_id: 99999, expires_at: FUTURE });
            }).toThrow(/FOREIGN KEY/i);
        });
    });

    // ---- findById -------------------------------------------------------

    describe('findById', () => {
        it('returns the matching session', () => {
            const userId = seedUser();
            const id = seedSession({ user_id: userId, token_hash: 'find-me', expires_at: FUTURE });
            const s = sessionRepo.findById(id);
            expect(s.id).toBe(id);
            expect(s.token_hash).toBe('find-me');
        });

        it('returns undefined for a nonexistent id', () => {
            expect(sessionRepo.findById(99999)).toBeUndefined();
        });

        it('returns the row regardless of revoked/expired state', () => {
            const userId = seedUser();
            const id = seedSession({ user_id: userId, expires_at: PAST, revoked_at: REVOKED_TS });
            // findById does no validity filtering — a dead session is still found.
            const s = sessionRepo.findById(id);
            expect(s).toBeDefined();
            expect(s.id).toBe(id);
        });
    });

    // ---- findByTokenHash ----------------------------------------------------

    describe('findByTokenHash', () => {
        it('returns the matching session', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'by-token', expires_at: FUTURE });
            const s = sessionRepo.findByTokenHash('by-token');
            expect(s).toBeDefined();
            expect(s.token_hash).toBe('by-token');
        });

        it('returns undefined when no such token exists', () => {
            expect(sessionRepo.findByTokenHash('nope')).toBeUndefined();
        });

        it('returns a revoked session (unfiltered)', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'revoked-tok', expires_at: FUTURE, revoked_at: REVOKED_TS });
            const s = sessionRepo.findByTokenHash('revoked-tok');
            expect(s).toBeDefined();
            expect(s.revoked_at).toBe(REVOKED_TS);
        });

        it('returns an expired session (unfiltered)', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'expired-tok', expires_at: PAST });
            const s = sessionRepo.findByTokenHash('expired-tok');
            expect(s).toBeDefined();
            expect(s.expires_at).toBe(PAST);
        });
    });

    // ---- findValidByToken (the validity matrix) -------------------------

    describe('findValidByToken', () => {
        it('returns a session that is neither revoked nor expired', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'valid', expires_at: FUTURE, revoked_at: null });
            const s = sessionRepo.findValidByToken('valid');
            expect(s).toBeDefined();
            expect(s.token_hash).toBe('valid');
        });

        it('returns undefined for an expired-but-not-revoked session', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'expired', expires_at: PAST, revoked_at: null });
            expect(sessionRepo.findValidByToken('expired')).toBeUndefined();
        });

        it('returns undefined for a revoked-but-not-expired session', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'revoked', expires_at: FUTURE, revoked_at: REVOKED_TS });
            expect(sessionRepo.findValidByToken('revoked')).toBeUndefined();
        });

        it('returns undefined for a session that is both revoked and expired', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'dead', expires_at: PAST, revoked_at: REVOKED_TS });
            expect(sessionRepo.findValidByToken('dead')).toBeUndefined();
        });

        it('returns undefined when the token does not exist', () => {
            expect(sessionRepo.findValidByToken('missing')).toBeUndefined();
        });
    });

    // ---- listByUser -----------------------------------------------------

    describe('listByUser', () => {
        it('returns all of a user\'s sessions newest-first by default', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'old', expires_at: FUTURE, created_at: '2026-01-01T00:00:00.000Z' });
            seedSession({ user_id: userId, token_hash: 'mid', expires_at: FUTURE, created_at: '2026-02-01T00:00:00.000Z' });
            seedSession({ user_id: userId, token_hash: 'new', expires_at: FUTURE, created_at: '2026-03-01T00:00:00.000Z' });

            const sessions = sessionRepo.listByUser(userId);
            expect(sessions.map(s => s.token_hash)).toEqual(['new', 'mid', 'old']);
        });

        it('includes revoked and expired sessions by default', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'valid',   expires_at: FUTURE });
            seedSession({ user_id: userId, token_hash: 'expired', expires_at: PAST });
            seedSession({ user_id: userId, token_hash: 'revoked', expires_at: FUTURE, revoked_at: REVOKED_TS });

            expect(sessionRepo.listByUser(userId)).toHaveLength(3);
        });

        it('returns only valid sessions when onlyValid is true', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'valid',   expires_at: FUTURE });
            seedSession({ user_id: userId, token_hash: 'expired', expires_at: PAST });
            seedSession({ user_id: userId, token_hash: 'revoked', expires_at: FUTURE, revoked_at: REVOKED_TS });
            seedSession({ user_id: userId, token_hash: 'dead',    expires_at: PAST, revoked_at: REVOKED_TS });

            const valid = sessionRepo.listByUser(userId, { onlyValid: true });
            expect(valid).toHaveLength(1);
            expect(valid[0].token_hash).toBe('valid');
        });

        it('does not return another user\'s sessions', () => {
            const userA = seedUser();
            const userB = seedUser();
            seedSession({ user_id: userA, token_hash: 'a-tok', expires_at: FUTURE });
            seedSession({ user_id: userB, token_hash: 'b-tok', expires_at: FUTURE });

            const sessions = sessionRepo.listByUser(userA);
            expect(sessions).toHaveLength(1);
            expect(sessions[0].token_hash).toBe('a-tok');
        });

        it('returns an empty array when the user has no sessions', () => {
            const userId = seedUser();
            expect(sessionRepo.listByUser(userId)).toEqual([]);
        });
    });

    // ---- countValidByUser -----------------------------------------------

    describe('countValidByUser', () => {
        it('counts only valid sessions', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'v1', expires_at: FUTURE });
            seedSession({ user_id: userId, token_hash: 'v2', expires_at: FUTURE });
            seedSession({ user_id: userId, token_hash: 'expired', expires_at: PAST });
            seedSession({ user_id: userId, token_hash: 'revoked', expires_at: FUTURE, revoked_at: REVOKED_TS });

            expect(sessionRepo.countValidByUser(userId)).toBe(2);
        });

        it('returns 0 when the user has no valid sessions', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'expired', expires_at: PAST });
            expect(sessionRepo.countValidByUser(userId)).toBe(0);
        });

        it('returns 0 when the user has no sessions at all', () => {
            const userId = seedUser();
            expect(sessionRepo.countValidByUser(userId)).toBe(0);
        });

        it('does not count another user\'s valid sessions', () => {
            const userA = seedUser();
            const userB = seedUser();
            seedSession({ user_id: userA, token_hash: 'a', expires_at: FUTURE });
            seedSession({ user_id: userB, token_hash: 'b', expires_at: FUTURE });
            expect(sessionRepo.countValidByUser(userA)).toBe(1);
        });
    });

    // ---- revoke ---------------------------------------------------------

    describe('revoke', () => {
        it('sets revoked_at and returns the row', () => {
            const userId = seedUser();
            const id = seedSession({ user_id: userId, expires_at: FUTURE });
            const revoked = sessionRepo.revoke(id);
            expect(revoked.revoked_at).toMatch(ISO_RE);
        });

        it('persists the revocation', () => {
            const userId = seedUser();
            const id = seedSession({ user_id: userId, expires_at: FUTURE });
            sessionRepo.revoke(id);
            const row = db.prepare('SELECT revoked_at FROM user_sessions WHERE id = ?').get(id);
            expect(row.revoked_at).not.toBeNull();
        });

        it('makes a previously-valid session invalid', () => {
            const userId = seedUser();
            const id = seedSession({ user_id: userId, token_hash: 'will-revoke', expires_at: FUTURE });
            expect(sessionRepo.findValidByToken('will-revoke')).toBeDefined();
            sessionRepo.revoke(id);
            expect(sessionRepo.findValidByToken('will-revoke')).toBeUndefined();
        });

        it('does not change revoked_at on an already-revoked session', () => {
            const userId = seedUser();
            const id = seedSession({ user_id: userId, expires_at: FUTURE, revoked_at: REVOKED_TS });
            const result = sessionRepo.revoke(id);
            // WHERE revoked_at IS NULL means no row matched — original timestamp preserved.
            expect(result.revoked_at).toBe(REVOKED_TS);
        });
    });

    // ---- revokeByToken --------------------------------------------------

    describe('revokeByToken', () => {
        it('revokes the session matching the token', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'tok-logout', expires_at: FUTURE });
            const revoked = sessionRepo.revokeByToken('tok-logout');
            expect(revoked.revoked_at).toMatch(ISO_RE);
        });

        it('makes the session invalid afterward', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'tok-logout', expires_at: FUTURE });
            sessionRepo.revokeByToken('tok-logout');
            expect(sessionRepo.findValidByToken('tok-logout')).toBeUndefined();
        });

        it('returns undefined when the token does not exist', () => {
            expect(sessionRepo.revokeByToken('no-such-token')).toBeUndefined();
        });

        it('does not change revoked_at on an already-revoked token', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'already', expires_at: FUTURE, revoked_at: REVOKED_TS });
            const result = sessionRepo.revokeByToken('already');
            expect(result.revoked_at).toBe(REVOKED_TS);
        });
    });

    // ---- revokeAllForUser -----------------------------------------------

    describe('revokeAllForUser', () => {
        it('revokes all currently-valid sessions and returns the count', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'v1', expires_at: FUTURE });
            seedSession({ user_id: userId, token_hash: 'v2', expires_at: FUTURE });
            seedSession({ user_id: userId, token_hash: 'v3', expires_at: FUTURE });

            const count = sessionRepo.revokeAllForUser(userId);
            expect(count).toBe(3);
            expect(sessionRepo.countValidByUser(userId)).toBe(0);
        });

        it('does not re-revoke already-revoked sessions (count reflects only newly revoked)', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'fresh', expires_at: FUTURE });
            seedSession({ user_id: userId, token_hash: 'already', expires_at: FUTURE, revoked_at: REVOKED_TS });

            const count = sessionRepo.revokeAllForUser(userId);
            expect(count).toBe(1); // only 'fresh' was revoked by this call
        });

        it('revokes expired-but-not-yet-revoked sessions too (they match revoked_at IS NULL)', () => {
            const userId = seedUser();
            // An expired session that was never explicitly revoked still has revoked_at NULL,
            // so revokeAllForUser will stamp it. (It was already invalid via expiry, but this
            // documents the WHERE clause behavior.)
            seedSession({ user_id: userId, token_hash: 'expired', expires_at: PAST, revoked_at: null });
            const count = sessionRepo.revokeAllForUser(userId);
            expect(count).toBe(1);
        });

        it('returns 0 when the user has no revocable sessions', () => {
            const userId = seedUser();
            expect(sessionRepo.revokeAllForUser(userId)).toBe(0);
        });

        it('does not affect another user\'s sessions', () => {
            const userA = seedUser();
            const userB = seedUser();
            seedSession({ user_id: userA, token_hash: 'a', expires_at: FUTURE });
            seedSession({ user_id: userB, token_hash: 'b', expires_at: FUTURE });

            sessionRepo.revokeAllForUser(userA);
            expect(sessionRepo.countValidByUser(userA)).toBe(0);
            expect(sessionRepo.countValidByUser(userB)).toBe(1); // untouched
        });
    });

    // ---- hardDelete -----------------------------------------------------

    describe('hardDelete', () => {
        it('removes the row and returns true', () => {
            const userId = seedUser();
            const id = seedSession({ user_id: userId, expires_at: FUTURE });
            const ok = sessionRepo.hardDelete(id);

            expect(ok).toBe(true);
            const row = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(id);
            expect(row).toBeUndefined();
        });

        it('returns false when the session does not exist', () => {
            expect(sessionRepo.hardDelete(99999)).toBe(false);
        });
    });

    // ---- purgeDeadSessions ----------------------------------------------

    describe('purgeDeadSessions', () => {
        it('deletes expired and revoked sessions, keeping valid ones', () => {
            const userId = seedUser();
            const validId = seedSession({ user_id: userId, token_hash: 'valid', expires_at: FUTURE });
            seedSession({ user_id: userId, token_hash: 'expired', expires_at: PAST });
            seedSession({ user_id: userId, token_hash: 'revoked', expires_at: FUTURE, revoked_at: REVOKED_TS });
            seedSession({ user_id: userId, token_hash: 'dead',    expires_at: PAST, revoked_at: REVOKED_TS });

            const removed = sessionRepo.purgeDeadSessions();
            expect(removed).toBe(3); // expired + revoked + dead
            // Only the valid session remains.
            expect(sessionRepo.findById(validId)).toBeDefined();
            expect(sessionRepo.listByUser(userId)).toHaveLength(1);
        });

        it('returns 0 when all sessions are valid', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'v1', expires_at: FUTURE });
            seedSession({ user_id: userId, token_hash: 'v2', expires_at: FUTURE });
            expect(sessionRepo.purgeDeadSessions()).toBe(0);
        });

        it('purges a revoked-but-not-expired session', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'revoked', expires_at: FUTURE, revoked_at: REVOKED_TS });
            expect(sessionRepo.purgeDeadSessions()).toBe(1);
        });

        it('purges an expired-but-not-revoked session', () => {
            const userId = seedUser();
            seedSession({ user_id: userId, token_hash: 'expired', expires_at: PAST });
            expect(sessionRepo.purgeDeadSessions()).toBe(1);
        });

        it('purges across multiple users', () => {
            const userA = seedUser();
            const userB = seedUser();
            seedSession({ user_id: userA, token_hash: 'a-dead', expires_at: PAST });
            seedSession({ user_id: userB, token_hash: 'b-dead', expires_at: PAST });
            seedSession({ user_id: userA, token_hash: 'a-valid', expires_at: FUTURE });

            const removed = sessionRepo.purgeDeadSessions();
            expect(removed).toBe(2);
            expect(sessionRepo.countValidByUser(userA)).toBe(1);
            expect(sessionRepo.countValidByUser(userB)).toBe(0);
        });

        it('cascades correctly: deleting a user removes their sessions too', () => {
            // Not a purge test per se, but confirms the users->sessions cascade
            // that the cleanup story relies on at the edges.
            const userId = seedUser();
            const id = seedSession({ user_id: userId, token_hash: 'tok', expires_at: FUTURE });
            db.prepare('DELETE FROM users WHERE id = ?').run(userId);
            expect(sessionRepo.findById(id)).toBeUndefined();
        });
    });
});