// tests/data-repo/integration.test.js
import { createDatabaseConnection, setDb, resetDb } from '../../database/connection.js';
import { runDatabaseMigrations } from '../../database/migrate.js';
import { tempDbPath, cleanupDb } from '../../__test-helpers__/tempDb.js';
import {
    userRepo,
    teamRepo,
    teamMemberRepo,
    standupRepo,
} from '../../data-repo/dataRepository.js';

/**
 * Integration suite: multi-repo operations against a SINGLE persistent database,
 * simulating the kind of sequences the service layer performs in production.
 *
 * Unlike the per-repo unit suites (fresh DB per test), this whole file shares
 * one connection. Tests run in declaration order and build on each other's
 * state — the database accumulates a realistic working set as the "scenario"
 * progresses. This catches cross-repo issues the isolated unit tests can't:
 * cascade interactions, attribution surviving lifecycle transitions, ordering
 * across many writes, and the owner-resolution / retention policies that span
 * tables.
 * 
 * PROVEN FOR SCHEMA: v1
 * Future schema migrations are likely to require updates to this suite.
 */
describe('multi-repo integration scenario', () => {
    let db;
    let dbPath;

    // Shared scenario state — populated as the tests progress, mimicking how a
    // service holds onto ids it just created.
    const ctx = {};

    // Helper mirroring a service computing a retention deadline from a team's
    // standup_retention_days. Kept here (not in a repo) because it's service logic.
    function killAfterFromRetention(retentionDays) {
        if (retentionDays == null) return null;
        return new Date(Date.now() + retentionDays * 86400_000).toISOString();
    }

    beforeAll(() => {
        dbPath = tempDbPath();
        db = createDatabaseConnection(dbPath);
        runDatabaseMigrations({ db });
        setDb(db);
    });

    afterAll(() => {
        resetDb();
        cleanupDb(dbPath);
    });

    // =====================================================================
    // 1. Registration + team creation (the "found a team" service flow)
    // =====================================================================
    describe('1. founding users register and create teams', () => {
        it('registers the founding users', () => {
            ctx.alice = userRepo.create({ user_name: 'alice', user_email: 'alice@example.com', pass_hash: 'h_alice' });
            ctx.bob   = userRepo.create({ user_name: 'bob',   user_email: 'bob@example.com',   pass_hash: 'h_bob' });
            ctx.carol = userRepo.create({ user_name: 'carol', user_email: 'carol@example.com', pass_hash: 'h_carol' });

            expect(ctx.alice.id).toBeGreaterThan(0);
            expect(userRepo.list()).toHaveLength(3);
        });

        it('alice founds a team and is enrolled as its admin member (createTeam flow)', () => {
            // Service createTeam: create the team, then add the founder as an admin member.
            ctx.teamA = teamRepo.create({
                team_name: 'Alpha Squad',
                invite_code: 'ALPHA-001',
                owned_by: ctx.alice.id,
                standup_retention_days: 30,
            });
            ctx.aliceMemberA = teamMemberRepo.create({
                user_id: ctx.alice.id,
                team_id: ctx.teamA.id,
                display_name: 'Alice (Lead)',
                member_role: 'admin',
            });

            expect(ctx.teamA.owned_by).toBe(ctx.alice.id);
            expect(ctx.aliceMemberA.member_role).toBe('admin');
            // The founder is the sole member so far.
            expect(teamMemberRepo.countActiveByTeam(ctx.teamA.id)).toBe(1);
            // And alice now owns exactly one active team.
            expect(teamRepo.countActiveByOwner(ctx.alice.id)).toBe(1);
        });

        it('bob founds a separate team, isolated from alpha', () => {
            ctx.teamB = teamRepo.create({
                team_name: 'Bravo Crew',
                invite_code: 'BRAVO-001',
                owned_by: ctx.bob.id,
                standup_retention_days: null, // never expire
            });
            ctx.bobMemberB = teamMemberRepo.create({
                user_id: ctx.bob.id,
                team_id: ctx.teamB.id,
                display_name: 'Bob',
                member_role: 'admin',
            });

            // Cross-team isolation: alice owns A, bob owns B, neither bleeds.
            expect(teamRepo.countActiveByOwner(ctx.alice.id)).toBe(1);
            expect(teamRepo.countActiveByOwner(ctx.bob.id)).toBe(1);
            expect(teamMemberRepo.listByTeam(ctx.teamA.id)).toHaveLength(1);
            expect(teamMemberRepo.listByTeam(ctx.teamB.id)).toHaveLength(1);
        });
    });

    // =====================================================================
    // 2. Joining via invite code (the "join team" service flow)
    // =====================================================================
    describe('2. members join teams via invite code', () => {
        it('resolves an invite code to a team and enrolls a new member', () => {
            // Service joinTeam: look up by invite code, confirm not already a member, create.
            const found = teamRepo.findByInviteCode('ALPHA-001');
            expect(found.id).toBe(ctx.teamA.id);

            expect(teamMemberRepo.isActiveMember(ctx.bob.id, ctx.teamA.id)).toBe(false);
            ctx.bobMemberA = teamMemberRepo.create({
                user_id: ctx.bob.id,
                team_id: ctx.teamA.id,
                display_name: 'Bob B.',
                member_role: 'member',
            });

            expect(teamMemberRepo.isActiveMember(ctx.bob.id, ctx.teamA.id)).toBe(true);
            expect(teamMemberRepo.countActiveByTeam(ctx.teamA.id)).toBe(2);
        });

        it('carol joins alpha as well', () => {
            ctx.carolMemberA = teamMemberRepo.create({
                user_id: ctx.carol.id,
                team_id: ctx.teamA.id,
                display_name: 'Carol C.',
            });
            expect(teamMemberRepo.countActiveByTeam(ctx.teamA.id)).toBe(3);
            // Default role applied.
            expect(ctx.carolMemberA.member_role).toBe('member');
        });

        it('bob is now a member of two teams; listByUser reflects both', () => {
            const bobMemberships = teamMemberRepo.listByUser(ctx.bob.id);
            const teamIds = bobMemberships.map(m => m.team_id).sort();
            expect(teamIds).toEqual([ctx.teamA.id, ctx.teamB.id].sort());
        });

        it('bob has distinct display names per team (two-layer identity)', () => {
            const inA = teamMemberRepo.findByUserAndTeam(ctx.bob.id, ctx.teamA.id);
            const inB = teamMemberRepo.findByUserAndTeam(ctx.bob.id, ctx.teamB.id);
            expect(inA.display_name).toBe('Bob B.');
            expect(inB.display_name).toBe('Bob');
        });
    });

    // =====================================================================
    // 3. Posting standups (the "postStandup" service flow w/ retention)
    // =====================================================================
    describe('3. members post standups with team-derived retention', () => {
        it('alice posts a standup; retention is derived from the team policy', () => {
            // Service postStandup: read team for retention, compute kill_after, insert.
            const team = teamRepo.findById(ctx.teamA.id);
            const killAfter = killAfterFromRetention(team.standup_retention_days);

            ctx.aliceStandup1 = standupRepo.create({
                posted_by: ctx.aliceMemberA.id,
                for_team: ctx.teamA.id,
                worked_on: 'set up CI',
                will_work_on: 'write integration tests',
                blocked_by: null,
                kill_after: killAfter,
            });

            // 30-day retention → kill_after is set, in the future.
            expect(ctx.aliceStandup1.kill_after).not.toBeNull();
            expect(ctx.aliceStandup1.kill_after > new Date().toISOString()).toBe(true);
        });

        it('bob posts a standup with a blocker', () => {
            ctx.bobStandup1 = standupRepo.create({
                posted_by: ctx.bobMemberA.id,
                for_team: ctx.teamA.id,
                worked_on: 'API scaffolding',
                will_work_on: 'auth middleware',
                blocked_by: 'waiting on schema sign-off',
                kill_after: killAfterFromRetention(30),
            });
            expect(ctx.bobStandup1.blocked_by).toBe('waiting on schema sign-off');
            expect(ctx.bobStandup1.blocker_resolved).toBe(0);
        });

        it('carol posts a standup with a blocker too', () => {
            ctx.carolStandup1 = standupRepo.create({
                posted_by: ctx.carolMemberA.id,
                for_team: ctx.teamA.id,
                worked_on: 'frontend login form',
                will_work_on: 'wire up to API',
                blocked_by: 'API endpoints not ready',
                kill_after: killAfterFromRetention(30),
            });
            expect(ctx.carolStandup1.blocker_resolved).toBe(0);
        });

        it('a standup in bob\'s OTHER team never expires (null retention)', () => {
            const teamB = teamRepo.findById(ctx.teamB.id);
            const killAfter = killAfterFromRetention(teamB.standup_retention_days); // null
            ctx.bobStandupB = standupRepo.create({
                posted_by: ctx.bobMemberB.id,
                for_team: ctx.teamB.id,
                worked_on: 'solo work',
                will_work_on: 'more solo work',
                kill_after: killAfter,
            });
            expect(ctx.bobStandupB.kill_after).toBeNull();
        });

        it('the alpha team feed shows all three alpha standups, newest-first, isolated from bravo', () => {
            const feed = standupRepo.listByTeam(ctx.teamA.id);
            expect(feed).toHaveLength(3);
            // All belong to team A — bravo's standup must not leak in.
            expect(feed.every(s => s.for_team === ctx.teamA.id)).toBe(true);
            // Bravo feed is its own single standup.
            expect(standupRepo.listByTeam(ctx.teamB.id)).toHaveLength(1);
        });

        it('the team blockers view shows bob\'s and carol\'s active blockers', () => {
            const blockers = standupRepo.listBlockersByTeam(ctx.teamA.id);
            expect(blockers).toHaveLength(2);
            expect(standupRepo.countActiveBlockersByTeam(ctx.teamA.id)).toBe(2);
            // Alice's no-blocker standup is excluded.
            expect(blockers.every(s => s.blocked_by)).toBe(true);
        });
    });

    // =====================================================================
    // 4. Resolving blockers (content preserved for crossed-out display)
    // =====================================================================
    describe('4. blockers get resolved but stay visible', () => {
        it('bob resolves his blocker; content is preserved', () => {
            const resolved = standupRepo.resolveBlocker(ctx.bobStandup1.id);
            expect(resolved.blocker_resolved).toBe(1);
            expect(resolved.blocked_by).toBe('waiting on schema sign-off'); // still there
        });

        it('active blocker count drops, but the blockers view still shows the resolved one', () => {
            // Count is active-only: now just carol's.
            expect(standupRepo.countActiveBlockersByTeam(ctx.teamA.id)).toBe(1);
            // Full blockers view (default includeResolved) still shows both.
            const all = standupRepo.listBlockersByTeam(ctx.teamA.id);
            expect(all).toHaveLength(2);
            // Active-only view shows just carol's.
            const activeOnly = standupRepo.listBlockersByTeam(ctx.teamA.id, { includeResolved: false });
            expect(activeOnly).toHaveLength(1);
            expect(activeOnly[0].id).toBe(ctx.carolStandup1.id);
        });

        it('bob\'s per-member blocker history includes the resolved blocker', () => {
            const bobBlockers = standupRepo.listBlockersByPoster(ctx.bobMemberA.id);
            expect(bobBlockers).toHaveLength(1);
            expect(bobBlockers[0].blocker_resolved).toBe(1);
        });
    });

    // =====================================================================
    // 5. Editing standups and rotating an invite code
    // =====================================================================
    describe('5. content edits and invite rotation', () => {
        it('carol edits her standup content without touching blocker state', () => {
            const updated = standupRepo.update(ctx.carolStandup1.id, {
                will_work_on: 'wire up to API (rescheduled)',
            });
            expect(updated.will_work_on).toBe('wire up to API (rescheduled)');
            // Editing content must not have flipped resolution.
            expect(updated.blocker_resolved).toBe(0);
            expect(updated.blocked_by).toBe('API endpoints not ready');
        });

        it('alice rotates the alpha invite code; the old code stops resolving', () => {
            teamRepo.rotateInviteCode(ctx.teamA.id, 'ALPHA-002');
            expect(teamRepo.findByInviteCode('ALPHA-001')).toBeUndefined();
            const found = teamRepo.findByInviteCode('ALPHA-002');
            expect(found.id).toBe(ctx.teamA.id);
        });

        it('a would-be joiner using the stale code is correctly rejected at lookup', () => {
            // Simulates joinTeam: stale code → no team → service would 404.
            expect(teamRepo.findByInviteCode('ALPHA-001')).toBeUndefined();
        });
    });

    // =====================================================================
    // 6. A member leaves; attribution on their past standups survives
    // =====================================================================
    describe('6. member leaves but their content remains attributable', () => {
        it('carol leaves alpha (soft-leave)', () => {
            teamMemberRepo.leave(ctx.carolMemberA.id);
            expect(teamMemberRepo.isActiveMember(ctx.carol.id, ctx.teamA.id)).toBe(false);
            // Active roster drops to alice + bob.
            expect(teamMemberRepo.countActiveByTeam(ctx.teamA.id)).toBe(2);
        });

        it('carol\'s membership row still exists (includeFormer) so her standup stays attributable', () => {
            const former = teamMemberRepo.findById(ctx.carolMemberA.id, { includeFormer: true });
            expect(former).toBeDefined();
            expect(former.left_at).not.toBeNull();
            // Her standup is still in the team feed, still linked to her membership id.
            const carolStandup = standupRepo.findById(ctx.carolStandup1.id);
            expect(carolStandup).toBeDefined();
            expect(carolStandup.posted_by).toBe(ctx.carolMemberA.id);
        });

        it('carol\'s unresolved blocker still appears in the active blockers count', () => {
            // Leaving the team does NOT auto-resolve or hide her standup's blocker.
            expect(standupRepo.countActiveBlockersByTeam(ctx.teamA.id)).toBe(1);
        });

        it('carol rejoins with a new display name; her old standup keeps its membership link', () => {
            const rejoined = teamMemberRepo.rejoin(ctx.carolMemberA.id, { display_name: 'Carol (back)' });
            expect(rejoined.left_at).toBeNull();
            expect(rejoined.display_name).toBe('Carol (back)');
            // Same membership id → her historical standup is still hers.
            expect(standupRepo.findById(ctx.carolStandup1.id).posted_by).toBe(ctx.carolMemberA.id);
            expect(teamMemberRepo.countActiveByTeam(ctx.teamA.id)).toBe(3);
        });
    });

    // =====================================================================
    // 7. Retention purge removes only expired standups
    // =====================================================================
    describe('7. retention purge', () => {
        it('an already-expired standup is purged while live ones remain', () => {
            // Simulate an old standup whose retention window has lapsed.
            const expired = standupRepo.create({
                posted_by: ctx.aliceMemberA.id,
                for_team: ctx.teamA.id,
                worked_on: 'ancient history',
                will_work_on: 'forgotten',
                kill_after: '2020-01-01T00:00:00.000Z', // long past
            });

            const beforeCount = standupRepo.countByTeam(ctx.teamA.id);
            const removed = standupRepo.purgeExpiredStandups();

            expect(removed).toBe(1);
            expect(standupRepo.findById(expired.id)).toBeUndefined();
            // Exactly one fewer standup in the team.
            expect(standupRepo.countByTeam(ctx.teamA.id)).toBe(beforeCount - 1);
            // The future-dated and the never-expire standups survive.
            expect(standupRepo.findById(ctx.aliceStandup1.id)).toBeDefined();
            expect(standupRepo.findById(ctx.bobStandupB.id)).toBeDefined();
        });
    });

    // =====================================================================
    // 8. Cascade behavior when a team is hard-deleted
    // =====================================================================
    describe('8. hard-deleting a team cascades to its memberships and standups', () => {
        it('records bravo\'s dependent rows, then hard-deletes the team', () => {
            // Bravo has bob's membership and one standup.
            expect(teamMemberRepo.listByTeam(ctx.teamB.id, { includeFormer: true })).toHaveLength(1);
            expect(standupRepo.listByTeam(ctx.teamB.id).length).toBeGreaterThanOrEqual(1);

            const ok = teamRepo.hardDelete(ctx.teamB.id);
            expect(ok).toBe(true);
        });

        it('the team, its memberships, and its standups are all gone', () => {
            expect(teamRepo.findById(ctx.teamB.id, { includeDeleted: true })).toBeUndefined();
            // Bob's bravo membership cascaded away...
            expect(teamMemberRepo.findById(ctx.bobMemberB.id, { includeFormer: true })).toBeUndefined();
            // ...along with the standup he posted there.
            expect(standupRepo.findById(ctx.bobStandupB.id)).toBeUndefined();
        });

        it('bob\'s alpha membership and standups are untouched by bravo\'s deletion', () => {
            // Cross-team isolation under cascade: deleting B must not affect A.
            expect(teamMemberRepo.isActiveMember(ctx.bob.id, ctx.teamA.id)).toBe(true);
            expect(standupRepo.findById(ctx.bobStandup1.id)).toBeDefined();
            // Bob now belongs to only one team.
            expect(teamMemberRepo.listByUser(ctx.bob.id)).toHaveLength(1);
        });
    });

    // =====================================================================
    // 9. Owner-resolution policy guarding account deletion
    // =====================================================================
    describe('9. account deletion respects the team-ownership guard', () => {
        it('alice cannot be hard-deleted while she still owns alpha (RESTRICT guard)', () => {
            // Service would check countActiveByOwner first and refuse; the DB is the backstop.
            expect(teamRepo.countActiveByOwner(ctx.alice.id)).toBe(1);
            expect(() => userRepo.hardDelete(ctx.alice.id)).toThrow(/FOREIGN KEY/i);
            // She still exists.
            expect(userRepo.findById(ctx.alice.id)).toBeDefined();
        });

        it('after transferring ownership to bob, the count moves and alice is deletable', () => {
            // Service transferOwnership: reassign owned_by to another member.
            teamRepo.update(ctx.teamA.id, { owned_by: ctx.bob.id });
            expect(teamRepo.countActiveByOwner(ctx.alice.id)).toBe(0);
            expect(teamRepo.countActiveByOwner(ctx.bob.id)).toBe(1);

            // Alice soft-deletes her account first (30-day window), as the service would.
            const killAfter = new Date(Date.now() + 30 * 86400_000).toISOString();
            const softDeleted = userRepo.softDelete(ctx.alice.id, killAfter);
            expect(softDeleted.deleted_at).not.toBeNull();
            // She's hidden from active lookups but recoverable.
            expect(userRepo.findById(ctx.alice.id)).toBeUndefined();
            expect(userRepo.findById(ctx.alice.id, { includeDeleted: true })).toBeDefined();
        });

        it('alice\'s alpha membership and authored standup remain during the soft-delete window', () => {
            // Soft-deleting the USER doesn't touch the membership/standup — those persist
            // until hard-delete. Her admin membership is still active.
            expect(teamMemberRepo.isActiveMember(ctx.alice.id, ctx.teamA.id)).toBe(true);
            expect(standupRepo.findById(ctx.aliceStandup1.id)).toBeDefined();
        });
    });

    // =====================================================================
    // 10. Hard-deleting the (no-longer-owning) user cascades cleanly
    // =====================================================================
    describe('10. purging the soft-deleted account hard-deletes and cascades', () => {
        it('the soft-deleted alice shows up in the expired-users sweep when due', () => {
            // Force her purge deadline into the past to simulate the 30 days elapsing.
            db.prepare('UPDATE users SET kill_after = ? WHERE id = ?')
              .run('2020-01-01T00:00:00.000Z', ctx.alice.id);

            const expired = userRepo.listExpiredUsers();
            expect(expired.map(u => u.id)).toContain(ctx.alice.id);
        });

        it('hard-deleting alice removes her membership and her authored standup (cascade)', () => {
            // She no longer owns any team, so RESTRICT no longer blocks.
            const ok = userRepo.hardDelete(ctx.alice.id);
            expect(ok).toBe(true);

            expect(userRepo.findById(ctx.alice.id, { includeDeleted: true })).toBeUndefined();
            // Her alpha membership cascaded (users -> team_members ON DELETE CASCADE)...
            expect(teamMemberRepo.findById(ctx.aliceMemberA.id, { includeFormer: true })).toBeUndefined();
            // ...and her standup cascaded (team_members -> standups ON DELETE CASCADE).
            expect(standupRepo.findById(ctx.aliceStandup1.id)).toBeUndefined();
        });

        it('the alpha team itself survives — only alice\'s rows were removed', () => {
            // Team A still exists (now owned by bob), with bob + carol still members.
            const teamA = teamRepo.findById(ctx.teamA.id);
            expect(teamA).toBeDefined();
            expect(teamA.owned_by).toBe(ctx.bob.id);
            expect(teamMemberRepo.isActiveMember(ctx.bob.id, ctx.teamA.id)).toBe(true);
            expect(teamMemberRepo.isActiveMember(ctx.carol.id, ctx.teamA.id)).toBe(true);
            // Active roster is now bob + carol (alice's membership cascaded away).
            expect(teamMemberRepo.countActiveByTeam(ctx.teamA.id)).toBe(2);
        });
    });

    // =====================================================================
    // 11. Final consistency sweep over the accumulated database
    // =====================================================================
    describe('11. end-state consistency check', () => {
        it('the surviving users are bob and carol', () => {
            const users = userRepo.list({ includeDeleted: true }).map(u => u.user_name).sort();
            expect(users).toEqual(['bob', 'carol']);
        });

        it('only team alpha survives, owned by bob', () => {
            const teams = teamRepo.list({ includeDeleted: true });
            expect(teams).toHaveLength(1);
            expect(teams[0].id).toBe(ctx.teamA.id);
            expect(teams[0].owned_by).toBe(ctx.bob.id);
        });

        it('every surviving standup still resolves to an existing membership and team', () => {
            // The integrity invariant: no orphaned standups after all the cascades.
            const survivors = standupRepo.listByTeam(ctx.teamA.id, { limit: 1000 });
            for (const s of survivors) {
                const membership = teamMemberRepo.findById(s.posted_by, { includeFormer: true });
                const team = teamRepo.findById(s.for_team, { includeDeleted: true });
                expect(membership).toBeDefined();
                expect(team).toBeDefined();
            }
        });

        it('SQLite reports no foreign-key violations across the whole database', () => {
            // The ultimate cross-repo integrity assertion.
            const violations = db.pragma('foreign_key_check');
            expect(violations).toEqual([]);
        });
    });
});