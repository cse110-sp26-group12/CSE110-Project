import fs from 'node:fs';
import path from 'node:path';
import {
    createDatabaseConnection,
    getDb,
    setDb,
    resetDb,
} from '../../database/connection.js';
import { runDatabaseMigrations } from '../../database/migrate.js';
import {
    userRepo,
    teamRepo,
    teamMemberRepo,
    standupRepo,
} from '../../data-repo/dataRepository.js';

/**
 * Persistence test: verifies a database survives a full connection lifecycle.
 *
 * This suite writes to a FIXED on-disk path, fully closes the connection, then
 * reopens a brand-new connection to the same file and confirms the data is
 * intact.
 *
 * Three phases:
 *   Session 1 — open, migrate, write a working set, close.
 *   (no connection exists here — simulated downtime)
 *   Session 2 — reopen the SAME file, read back, assert state, mutate, close.
 *   Session 3 — reopen AGAIN, confirm session-2 mutations also persisted.
 */
describe('database persistence across sessions', () => {
    // A fixed, non-temp path so the file outlives each connection.
    const DB_PATH = path.resolve('./database/test-data/persistence.db');

    // IDs captured in session 1 and re-checked in later sessions.
    const ids = {};

    // Ensure a clean slate before the whole sequence, and clean up after.
    // We delete the file (and WAL sidecars) so a leftover from a previous run
    // can't make the test pass for the wrong reason.
    function removeDbFiles() {
        for (const suffix of ['', '-wal', '-shm', '-journal']) {
            try { fs.unlinkSync(DB_PATH + suffix); } catch { /* not present */ }
        }
    }

    beforeAll(() => {
        removeDbFiles();
    });

    afterAll(() => {
        // Make sure no lingering singleton holds the file open, then remove it.
        resetDb();

        try {
            if (fs.existsSync(DB_PATH)) {
                const dir = path.dirname(DB_PATH);
                const logCopy = path.join(dir, 'persistence-last.db');
                fs.copyFileSync(DB_PATH, logCopy);
            }
        } catch (err) {
            // Logging snapshot is best-effort — never fail the suite over it.
            console.warn('Could not write persistence log snapshot:', err.message);
        }

        removeDbFiles();
    });

    // =====================================================================
    // SESSION 1 — create the database, write data, then fully close.
    // =====================================================================
    describe('session 1: write and close', () => {
        it('opens a fresh connection at the fixed path and migrates it', () => {
            const db = createDatabaseConnection(DB_PATH);
            setDb(db);
            const version = runDatabaseMigrations({ db });

            expect(fs.existsSync(DB_PATH)).toBe(true);
            expect(version).toBeGreaterThanOrEqual(1);
        });

        it('writes a working set across all repos', () => {
            const user = userRepo.create({
                user_name: 'persist_alice',
                user_email: 'persist_alice@example.com',
                pass_hash: 'h_alice',
            });
            const team = teamRepo.create({
                team_name: 'Persistent Team',
                invite_code: 'PERSIST-001',
                owned_by: user.id,
                standup_retention_days: 30,
            });
            const membership = teamMemberRepo.create({
                user_id: user.id,
                team_id: team.id,
                display_name: 'Alice P.',
                member_role: 'admin',
            });
            const standup = standupRepo.create({
                posted_by: membership.id,
                for_team: team.id,
                worked_on: 'durable work',
                will_work_on: 'survive a restart',
                blocked_by: 'flaky power supply',
            });

            // Capture ids so later sessions can look the exact rows back up.
            ids.user = user.id;
            ids.team = team.id;
            ids.membership = membership.id;
            ids.standup = standup.id;

            // Sanity: everything is present within this same session.
            expect(userRepo.findById(ids.user)).toBeDefined();
            expect(standupRepo.findById(ids.standup)).toBeDefined();
        });

        it('closes the connection and clears the singleton (simulated shutdown)', () => {
            resetDb(); // closes the underlying connection and nulls dbInstance

            // The file remains on disk after the connection is gone.
            expect(fs.existsSync(DB_PATH)).toBe(true);
        });
    });

    // =====================================================================
    // SESSION 2 — reopen the SAME file; data must be exactly as left.
    // =====================================================================
    describe('session 2: reopen and verify prior state survived', () => {
        it('opens a brand-new connection to the same path', () => {
            // A genuinely new connection object — no shared in-memory state with
            // session 1, since that one was closed and the singleton cleared.
            const db = createDatabaseConnection(DB_PATH);
            setDb(db);

            // Migrations are idempotent: re-running against an existing DB is a
            // no-op and must not error or reset the version.
            const version = runDatabaseMigrations({ db });
            expect(version).toBeGreaterThanOrEqual(1);
        });

        it('the user written in session 1 is still present and intact', () => {
            const user = userRepo.findById(ids.user);
            expect(user).toBeDefined();
            expect(user.user_name).toBe('persist_alice');
            expect(user.user_email).toBe('persist_alice@example.com');
            expect(user.pass_hash).toBe('h_alice');
        });

        it('the team survived with its owner and retention setting', () => {
            const team = teamRepo.findById(ids.team);
            expect(team).toBeDefined();
            expect(team.team_name).toBe('Persistent Team');
            expect(team.owned_by).toBe(ids.user);
            expect(team.standup_retention_days).toBe(30);
            // Lookup by the original invite code still resolves.
            expect(teamRepo.findByInviteCode('PERSIST-001').id).toBe(ids.team);
        });

        it('the membership survived and is still active', () => {
            const membership = teamMemberRepo.findById(ids.membership);
            expect(membership).toBeDefined();
            expect(membership.display_name).toBe('Alice P.');
            expect(membership.member_role).toBe('admin');
            expect(teamMemberRepo.isActiveMember(ids.user, ids.team)).toBe(true);
        });

        it('the standup survived with all content, including the blocker', () => {
            const standup = standupRepo.findById(ids.standup);
            expect(standup).toBeDefined();
            expect(standup.worked_on).toBe('durable work');
            expect(standup.will_work_on).toBe('survive a restart');
            expect(standup.blocked_by).toBe('flaky power supply');
            expect(standup.blocker_resolved).toBe(0);
        });

        it('foreign-key relationships survived intact (no orphans)', () => {
            const violations = getDb().pragma('foreign_key_check');
            expect(violations).toEqual([]);
        });

        it('mutates the surviving data, then closes again', () => {
            // Resolve the blocker and rename the team — changes we expect to also
            // persist into session 3.
            standupRepo.resolveBlocker(ids.standup);
            teamRepo.update(ids.team, { team_name: 'Persistent Team (renamed)' });

            // Confirm the mutations took within this session before closing.
            expect(standupRepo.findById(ids.standup).blocker_resolved).toBe(1);
            expect(teamRepo.findById(ids.team).team_name).toBe('Persistent Team (renamed)');

            resetDb(); // shut down session 2
            expect(fs.existsSync(DB_PATH)).toBe(true);
        });
    });

    // =====================================================================
    // SESSION 3 — reopen once more; session-2 mutations must also persist.
    // =====================================================================
    describe('session 3: reopen and verify session-2 mutations survived', () => {
        it('opens yet another fresh connection to the same path', () => {
            const db = createDatabaseConnection(DB_PATH);
            setDb(db);
            const version = runDatabaseMigrations({ db });
            expect(version).toBeGreaterThanOrEqual(1);
        });

        it('the blocker resolved in session 2 is still resolved', () => {
            const standup = standupRepo.findById(ids.standup);
            expect(standup.blocker_resolved).toBe(1);
            // Content preserved across the resolve AND the restart.
            expect(standup.blocked_by).toBe('flaky power supply');
        });

        it('the team rename from session 2 persisted', () => {
            const team = teamRepo.findById(ids.team);
            expect(team.team_name).toBe('Persistent Team (renamed)');
        });

        it('the overall working set is still coherent', () => {
            // One user, one team, one active member, one standup — exactly what
            // we built and mutated, nothing lost or duplicated across 3 sessions.
            expect(userRepo.list()).toHaveLength(1);
            expect(teamRepo.list()).toHaveLength(1);
            expect(teamMemberRepo.countActiveByTeam(ids.team)).toBe(1);
            expect(standupRepo.countByTeam(ids.team)).toBe(1);
        });
    });
});