// tests/data-repo/standupRepo.test.js
import { createDatabaseConnection, setDb, resetDb } from '../../database/connection.js';
import { runDatabaseMigrations } from '../../database/migrate.js';
import { tempDbPath, cleanupDb } from '../../__test-helpers__/tempDb.js';
import { standupRepo } from '../../data-repo/dataRepository.js'; // adjust to actual export path

describe('standupRepo', () => {
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

    let teamSeq = 0;
    function seedTeam({ owned_by, team_name, invite_code,
                        created_at = '2026-01-01T00:00:00.000Z',
                        updated_at = '2026-01-01T00:00:00.000Z' }) {
        teamSeq += 1;
        const result = db.prepare(`
            INSERT INTO teams (team_name, invite_code, owned_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(team_name ?? `Team${teamSeq}`, invite_code ?? `code${teamSeq}`,
               owned_by, created_at, updated_at);
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
                           worked_on = 'did stuff', will_work_on = 'will do stuff',
                           blocked_by = null,
                           blocker_resolved = 0,
                           status_flag = 'In progress',
                           created_at = '2026-01-01T00:00:00.000Z',
                           updated_at = '2026-01-01T00:00:00.000Z',
                           kill_after = null }) {
        const result = db.prepare(`
            INSERT INTO standups (posted_by, for_team, worked_on, will_work_on, blocked_by, blocker_resolved, status_flag, created_at, updated_at, kill_after)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(posted_by, for_team, worked_on, will_work_on, blocked_by, blocker_resolved, status_flag, created_at, updated_at, kill_after);
        return Number(result.lastInsertRowid);
    }

    // Convenience: a full chain ready for standup tests — owner, member user,
    // team, and the member's membership. Returns the membership + team ids.
    function setupPosterAndTeam() {
        const owner_id = seedUser();
        const userId = seedUser();
        const team_id = seedTeam({ owned_by: owner_id });
        const member_id = seedMembership({ user_id: userId, team_id: team_id });
        return { owner_id, userId, team_id, member_id };
    }

    const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    // ---- create ---------------------------------------------------------

    describe('create', () => {
        it('inserts a standup and returns the persisted row', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const s = standupRepo.create({
                posted_by: member_id,
                for_team: team_id,
                worked_on: 'shipped the repo',
                will_work_on: 'write tests',
                blocked_by: 'waiting on review',
            });

            expect(s).toBeDefined();
            expect(s.id).toBeGreaterThan(0);
            expect(s.posted_by).toBe(member_id);
            expect(s.for_team).toBe(team_id);
            expect(s.worked_on).toBe('shipped the repo');
            expect(s.will_work_on).toBe('write tests');
            expect(s.blocked_by).toBe('waiting on review');
        });

        it('persists the row to the database', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const s = standupRepo.create({ posted_by: member_id, for_team: team_id });
            const row = db.prepare('SELECT * FROM standups WHERE id = ?').get(s.id);
            expect(row.posted_by).toBe(member_id);
            expect(row.for_team).toBe(team_id);
        });

        it('defaults content fields and kill_after to null when omitted', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const s = standupRepo.create({ posted_by: member_id, for_team: team_id });
            expect(s.worked_on).toBeNull();
            expect(s.will_work_on).toBeNull();
            expect(s.blocked_by).toBeNull();
            expect(s.kill_after).toBeNull();
        });

        it('stores kill_after when provided', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const s = standupRepo.create({
                posted_by: member_id, for_team: team_id,
                kill_after: '2026-12-31T00:00:00.000Z',
            });
            expect(s.kill_after).toBe('2026-12-31T00:00:00.000Z');
        });

        it('sets created_at and updated_at as equal ISO timestamps', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const s = standupRepo.create({ posted_by: member_id, for_team: team_id });
            expect(s.created_at).toMatch(ISO_RE);
            expect(s.updated_at).toMatch(ISO_RE);
            expect(s.created_at).toBe(s.updated_at);
        });

        it('throws when posted_by references a nonexistent membership', () => {
            const owner_id = seedUser();
            const team_id = seedTeam({ owned_by: owner_id });
            expect(() => {
                standupRepo.create({ posted_by: 99999, for_team: team_id });
            }).toThrow(/FOREIGN KEY/i);
        });

        it('throws when for_team references a nonexistent team', () => {
            const { member_id } = setupPosterAndTeam();
            expect(() => {
                standupRepo.create({ posted_by: member_id, for_team: 99999 });
            }).toThrow(/FOREIGN KEY/i);
        });
    });

    // ---- findById -------------------------------------------------------

    describe('findById', () => {
        it('returns the matching standup', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'x' });
            const s = standupRepo.findById(id);
            expect(s.id).toBe(id);
            expect(s.worked_on).toBe('x');
        });

        it('returns undefined for a nonexistent id', () => {
            expect(standupRepo.findById(99999)).toBeUndefined();
        });
    });

    // ---- listByTeam -----------------------------------------------------

    describe('listByTeam', () => {
        it('returns the team\'s standups newest-first', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'old', created_at: '2026-01-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'mid', created_at: '2026-02-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'new', created_at: '2026-03-01T00:00:00.000Z' });

            const standups = standupRepo.listByTeam(team_id);
            expect(standups.map(s => s.worked_on)).toEqual(['new', 'mid', 'old']);
        });

        it('does not return standups of other teams', () => {
            const owner_id = seedUser();
            const teamA = seedTeam({ owned_by: owner_id });
            const teamB = seedTeam({ owned_by: owner_id });
            const uA = seedUser();
            const uB = seedUser();
            const mA = seedMembership({ user_id: uA, team_id: teamA });
            const mB = seedMembership({ user_id: uB, team_id: teamB });
            seedStandup({ posted_by: mA, for_team: teamA, worked_on: 'inA' });
            seedStandup({ posted_by: mB, for_team: teamB, worked_on: 'inB' });

            const standups = standupRepo.listByTeam(teamA);
            expect(standups).toHaveLength(1);
            expect(standups[0].worked_on).toBe('inA');
        });

        it('respects limit', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            for (let i = 0; i < 5; i++) {
                seedStandup({ posted_by: member_id, for_team: team_id });
            }
            expect(standupRepo.listByTeam(team_id, { limit: 2 })).toHaveLength(2);
        });

        it('respects offset', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            for (let i = 0; i < 5; i++) {
                seedStandup({
                    posted_by: member_id, for_team: team_id, worked_on: `s${i}`,
                    created_at: `2026-0${i + 1}-01T00:00:00.000Z`,
                });
            }
            // newest-first: s4, s3, s2, s1, s0 — offset 2 skips s4, s3
            const standups = standupRepo.listByTeam(team_id, { limit: 2, offset: 2 });
            expect(standups.map(s => s.worked_on)).toEqual(['s2', 's1']);
        });

        it('returns an empty array when the team has no standups', () => {
            const owner_id = seedUser();
            const team_id = seedTeam({ owned_by: owner_id });
            expect(standupRepo.listByTeam(team_id)).toEqual([]);
        });
    });

    // ---- listByPoster ---------------------------------------------------

    describe('listByPoster', () => {
        it('returns the poster\'s standups newest-first', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'old', created_at: '2026-01-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'new', created_at: '2026-02-01T00:00:00.000Z' });

            const standups = standupRepo.listByPoster(member_id);
            expect(standups.map(s => s.worked_on)).toEqual(['new', 'old']);
        });

        it('does not return standups posted by other members', () => {
            const owner_id = seedUser();
            const team_id = seedTeam({ owned_by: owner_id });
            const uA = seedUser();
            const uB = seedUser();
            const mA = seedMembership({ user_id: uA, team_id: team_id, display_name: 'A' });
            const mB = seedMembership({ user_id: uB, team_id: team_id, display_name: 'B' });
            seedStandup({ posted_by: mA, for_team: team_id, worked_on: 'byA' });
            seedStandup({ posted_by: mB, for_team: team_id, worked_on: 'byB' });

            const standups = standupRepo.listByPoster(mA);
            expect(standups).toHaveLength(1);
            expect(standups[0].worked_on).toBe('byA');
        });

        it('returns an empty array when the poster has no standups', () => {
            const { member_id } = setupPosterAndTeam();
            expect(standupRepo.listByPoster(member_id)).toEqual([]);
        });
    });

    // ---- listByTeamInRange ----------------------------------------------

    describe('listByTeamInRange', () => {
        it('returns only standups within the inclusive range, newest-first', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'before', created_at: '2026-01-15T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'inA',    created_at: '2026-02-10T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'inB',    created_at: '2026-02-20T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'after',  created_at: '2026-03-15T00:00:00.000Z' });

            const standups = standupRepo.listByTeamInRange(
                team_id, '2026-02-01T00:00:00.000Z', '2026-02-28T23:59:59.999Z',
            );
            expect(standups.map(s => s.worked_on)).toEqual(['inB', 'inA']);
        });

        it('includes standups exactly on the boundaries (inclusive)', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'start', created_at: '2026-02-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'end',   created_at: '2026-02-28T00:00:00.000Z' });

            const standups = standupRepo.listByTeamInRange(
                team_id, '2026-02-01T00:00:00.000Z', '2026-02-28T00:00:00.000Z',
            );
            expect(standups.map(s => s.worked_on).sort()).toEqual(['end', 'start']);
        });

        it('returns an empty array when nothing falls in range', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, created_at: '2026-01-01T00:00:00.000Z' });
            const standups = standupRepo.listByTeamInRange(
                team_id, '2026-06-01T00:00:00.000Z', '2026-06-30T00:00:00.000Z',
            );
            expect(standups).toEqual([]);
        });
    });

    // ---- countByTeam ----------------------------------------------------

    describe('countByTeam', () => {
        it('counts the team\'s standups', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id });
            seedStandup({ posted_by: member_id, for_team: team_id });
            expect(standupRepo.countByTeam(team_id)).toBe(2);
        });

        it('returns 0 when the team has no standups', () => {
            const owner_id = seedUser();
            const team_id = seedTeam({ owned_by: owner_id });
            expect(standupRepo.countByTeam(team_id)).toBe(0);
        });
    });

    // ---- update ---------------------------------------------------------

    describe('update', () => {
        it('updates content fields and returns the new row', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'old' });
            const updated = standupRepo.update(id, { worked_on: 'new' });
            expect(updated.worked_on).toBe('new');
        });

        it('persists the change to the database', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'old' });
            standupRepo.update(id, { worked_on: 'new' });
            const row = db.prepare('SELECT worked_on FROM standups WHERE id = ?').get(id);
            expect(row.worked_on).toBe('new');
        });

        it('clears a field when passed an explicit null', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'was blocked' });
            const updated = standupRepo.update(id, { blocked_by: null });
            expect(updated.blocked_by).toBeNull();
        });

        it('refreshes updated_at to a new ISO timestamp', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, updated_at: '2020-01-01T00:00:00.000Z' });
            const updated = standupRepo.update(id, { worked_on: 'changed' });
            expect(updated.updated_at).toMatch(ISO_RE);
            expect(updated.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });

        it('does not modify created_at', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, created_at: '2020-01-01T00:00:00.000Z' });
            const updated = standupRepo.update(id, { worked_on: 'changed' });
            expect(updated.created_at).toBe('2020-01-01T00:00:00.000Z');
        });

        it('ignores non-whitelisted keys', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'orig' });
            const updated = standupRepo.update(id, {
                worked_on: 'legit',
                id: 9999,                // ignored
                posted_by: 9999,         // ignored
                for_team: 9999,          // ignored
                created_at: 'hacked',    // ignored
                kill_after: 'hacked',    // ignored — has its own method
            });

            expect(updated.id).toBe(id);
            expect(updated.posted_by).toBe(member_id);
            expect(updated.for_team).toBe(team_id);
            expect(updated.worked_on).toBe('legit');
            expect(updated.created_at).not.toBe('hacked');
        });

        it('returns the unmodified row when no valid fields are given', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'unchanged', updated_at: '2020-01-01T00:00:00.000Z' });
            const result = standupRepo.update(id, { not_a_field: 'x' });
            expect(result.worked_on).toBe('unchanged');
            expect(result.updated_at).toBe('2020-01-01T00:00:00.000Z'); // not bumped
        });

        it('updates multiple content fields at once', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id });
            const updated = standupRepo.update(id, {
                worked_on: 'a', will_work_on: 'b', blocked_by: 'c',
            });
            expect(updated.worked_on).toBe('a');
            expect(updated.will_work_on).toBe('b');
            expect(updated.blocked_by).toBe('c');
        });
    });

    // ---- setKillAfter ---------------------------------------------------

    describe('setKillAfter', () => {
        it('sets the retention deadline and returns the row', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id });
            const updated = standupRepo.setKillAfter(id, '2026-12-31T00:00:00.000Z');
            expect(updated.kill_after).toBe('2026-12-31T00:00:00.000Z');
        });

        it('clears the deadline when passed null', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, kill_after: '2026-12-31T00:00:00.000Z' });
            const updated = standupRepo.setKillAfter(id, null);
            expect(updated.kill_after).toBeNull();
        });

        it('persists the change and bumps updated_at', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, updated_at: '2020-01-01T00:00:00.000Z' });
            standupRepo.setKillAfter(id, '2026-12-31T00:00:00.000Z');

            const row = db.prepare('SELECT kill_after, updated_at FROM standups WHERE id = ?').get(id);
            expect(row.kill_after).toBe('2026-12-31T00:00:00.000Z');
            expect(row.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });
    });

    // ---- hardDelete -----------------------------------------------------

    describe('hardDelete', () => {
        it('removes the row and returns true', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id });
            const ok = standupRepo.hardDelete(id);

            expect(ok).toBe(true);
            const row = db.prepare('SELECT * FROM standups WHERE id = ?').get(id);
            expect(row).toBeUndefined();
        });

        it('returns false when the standup does not exist', () => {
            expect(standupRepo.hardDelete(99999)).toBe(false);
        });
    });

    // ---- listExpiredStandups -------------------------------------------

    describe('listExpiredStandups', () => {
        it('returns standups whose kill_after is in the past', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const expiredId = seedStandup({ posted_by: member_id, for_team: team_id, kill_after: '2020-01-01T00:00:00.000Z' });

            const expired = standupRepo.listExpiredStandups();
            expect(expired.map(s => s.id)).toContain(expiredId);
        });

        it('excludes standups whose kill_after is in the future', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const futureId = seedStandup({ posted_by: member_id, for_team: team_id, kill_after: '2099-01-01T00:00:00.000Z' });

            const expired = standupRepo.listExpiredStandups();
            expect(expired.map(s => s.id)).not.toContain(futureId);
        });

        it('excludes standups with null kill_after (never expire)', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const keptId = seedStandup({ posted_by: member_id, for_team: team_id, kill_after: null });

            const expired = standupRepo.listExpiredStandups();
            expect(expired.map(s => s.id)).not.toContain(keptId);
        });

        it('returns an empty array when nothing is due', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id });
            expect(standupRepo.listExpiredStandups()).toEqual([]);
        });
    });

    // ---- purgeExpiredStandups ------------------------------------------

    describe('purgeExpiredStandups', () => {
        it('deletes expired standups and returns the count', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, kill_after: '2020-01-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, kill_after: '2020-02-01T00:00:00.000Z' });

            const removed = standupRepo.purgeExpiredStandups();
            expect(removed).toBe(2);
            expect(standupRepo.countByTeam(team_id)).toBe(0);
        });

        it('leaves future and null-kill_after standups intact', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const expiredId = seedStandup({ posted_by: member_id, for_team: team_id, kill_after: '2020-01-01T00:00:00.000Z' });
            const futureId  = seedStandup({ posted_by: member_id, for_team: team_id, kill_after: '2099-01-01T00:00:00.000Z' });
            const keptId    = seedStandup({ posted_by: member_id, for_team: team_id, kill_after: null });

            const removed = standupRepo.purgeExpiredStandups();
            expect(removed).toBe(1);
            expect(standupRepo.findById(expiredId)).toBeUndefined();
            expect(standupRepo.findById(futureId)).toBeDefined();
            expect(standupRepo.findById(keptId)).toBeDefined();
        });

        it('returns 0 when nothing is expired', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id });
            expect(standupRepo.purgeExpiredStandups()).toBe(0);
        });
    });

    // ---- listBlockersByTeam ---------------------------------------------

    describe('listBlockersByTeam', () => {
        it('returns all blocker standups (active and resolved) by default, newest-first', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'no blocker', blocked_by: null,        created_at: '2026-01-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'active',     blocked_by: 'stuck on X', blocker_resolved: 0, created_at: '2026-02-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'resolved',   blocked_by: 'was stuck',  blocker_resolved: 1, created_at: '2026-03-01T00:00:00.000Z' });

            const blockers = standupRepo.listBlockersByTeam(team_id);
            // Both the active and resolved blockers appear; the non-blocker does not
            expect(blockers.map(s => s.worked_on)).toEqual(['resolved', 'active']);
        });

        it('carries blocker_resolved through for display logic', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'active',   blocked_by: 'x', blocker_resolved: 0, created_at: '2026-01-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'resolved', blocked_by: 'y', blocker_resolved: 1, created_at: '2026-02-01T00:00:00.000Z' });

            const blockers = standupRepo.listBlockersByTeam(team_id);
            const byName = Object.fromEntries(blockers.map(s => [s.worked_on, s.blocker_resolved]));
            expect(byName.active).toBe(0);
            expect(byName.resolved).toBe(1);
        });

        it('excludes resolved blockers when includeResolved is false', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'active',   blocked_by: 'x', blocker_resolved: 0 });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'resolved', blocked_by: 'y', blocker_resolved: 1 });

            const blockers = standupRepo.listBlockersByTeam(team_id, { includeResolved: false });
            expect(blockers).toHaveLength(1);
            expect(blockers[0].worked_on).toBe('active');
        });

        it('treats empty-string blocked_by as not a blocker', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'empty', blocked_by: '' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'real',  blocked_by: 'genuinely blocked' });

            const blockers = standupRepo.listBlockersByTeam(team_id);
            expect(blockers).toHaveLength(1);
            expect(blockers[0].worked_on).toBe('real');
        });

        it('does not return blockers from other teams', () => {
            const owner_id = seedUser();
            const teamA = seedTeam({ owned_by: owner_id });
            const teamB = seedTeam({ owned_by: owner_id });
            const uA = seedUser();
            const uB = seedUser();
            const mA = seedMembership({ user_id: uA, team_id: teamA });
            const mB = seedMembership({ user_id: uB, team_id: teamB });
            seedStandup({ posted_by: mA, for_team: teamA, worked_on: 'A', blocked_by: 'blockedA' });
            seedStandup({ posted_by: mB, for_team: teamB, worked_on: 'B', blocked_by: 'blockedB' });

            const blockers = standupRepo.listBlockersByTeam(teamA);
            expect(blockers).toHaveLength(1);
            expect(blockers[0].worked_on).toBe('A');
        });

        it('respects limit and offset', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            for (let i = 0; i < 4; i++) {
                seedStandup({
                    posted_by: member_id, for_team: team_id, worked_on: `b${i}`,
                    blocked_by: `blk${i}`, created_at: `2026-0${i + 1}-01T00:00:00.000Z`,
                });
            }
            // newest-first: b3, b2, b1, b0 — offset 1, limit 2 → b2, b1
            const blockers = standupRepo.listBlockersByTeam(team_id, { limit: 2, offset: 1 });
            expect(blockers.map(s => s.worked_on)).toEqual(['b2', 'b1']);
        });

        it('returns an empty array when the team has no blockers', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: null });
            expect(standupRepo.listBlockersByTeam(team_id)).toEqual([]);
        });
    });

    // ---- listBlockersByPoster -------------------------------------------

    describe('listBlockersByPoster', () => {
        it('returns only the poster\'s blocker standups, newest-first', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'no blocker', blocked_by: null,         created_at: '2026-01-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'blocker1',   blocked_by: 'stuck',       created_at: '2026-02-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'blocker2',   blocked_by: 'still stuck', created_at: '2026-03-01T00:00:00.000Z' });

            const blockers = standupRepo.listBlockersByPoster(member_id);
            expect(blockers.map(s => s.worked_on)).toEqual(['blocker2', 'blocker1']);
        });

        it('does not return blockers posted by other members', () => {
            const owner_id = seedUser();
            const team_id = seedTeam({ owned_by: owner_id });
            const uA = seedUser();
            const uB = seedUser();
            const mA = seedMembership({ user_id: uA, team_id: team_id, display_name: 'A' });
            const mB = seedMembership({ user_id: uB, team_id: team_id, display_name: 'B' });
            seedStandup({ posted_by: mA, for_team: team_id, worked_on: 'byA', blocked_by: 'blockedA' });
            seedStandup({ posted_by: mB, for_team: team_id, worked_on: 'byB', blocked_by: 'blockedB' });

            const blockers = standupRepo.listBlockersByPoster(mA);
            expect(blockers).toHaveLength(1);
            expect(blockers[0].worked_on).toBe('byA');
        });

        it('treats empty-string blocked_by as not a blocker', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'empty', blocked_by: '' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'real',  blocked_by: 'blocked' });

            const blockers = standupRepo.listBlockersByPoster(member_id);
            expect(blockers).toHaveLength(1);
            expect(blockers[0].worked_on).toBe('real');
        });

        it('returns an empty array when the poster has no blockers', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: null });
            expect(standupRepo.listBlockersByPoster(member_id)).toEqual([]);
        });

        it('includes both active and resolved blockers by default', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'active',   blocked_by: 'x', blocker_resolved: 0, created_at: '2026-01-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'resolved', blocked_by: 'y', blocker_resolved: 1, created_at: '2026-02-01T00:00:00.000Z' });

            const blockers = standupRepo.listBlockersByPoster(member_id);
            expect(blockers.map(s => s.worked_on)).toEqual(['resolved', 'active']);
        });

        it('excludes resolved blockers when includeResolved is false', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'active',   blocked_by: 'x', blocker_resolved: 0 });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'resolved', blocked_by: 'y', blocker_resolved: 1 });

            const blockers = standupRepo.listBlockersByPoster(member_id, { includeResolved: false });
            expect(blockers).toHaveLength(1);
            expect(blockers[0].worked_on).toBe('active');
        });
    });

    // ---- countActiveBlockersByTeam --------------------------------------

    describe('countActiveBlockersByTeam', () => {
        it('counts only unresolved blockers', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'active1', blocker_resolved: 0 });
            seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'active2', blocker_resolved: 0 });
            seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'resolved', blocker_resolved: 1 });
            seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: null });
            expect(standupRepo.countActiveBlockersByTeam(team_id)).toBe(2);
        });

        it('returns 0 when all blockers are resolved', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'resolved', blocker_resolved: 1 });
            expect(standupRepo.countActiveBlockersByTeam(team_id)).toBe(0);
        });

        it('treats empty-string blocked_by as not a blocker', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: '' });
            seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'real' });
            expect(standupRepo.countActiveBlockersByTeam(team_id)).toBe(1);
        });

        it('returns 0 when the team has no blockers', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: null });
            expect(standupRepo.countActiveBlockersByTeam(team_id)).toBe(0);
        });

        it('does not count blockers from other teams', () => {
            const owner_id = seedUser();
            const teamA = seedTeam({ owned_by: owner_id });
            const teamB = seedTeam({ owned_by: owner_id });
            const uA = seedUser();
            const uB = seedUser();
            const mA = seedMembership({ user_id: uA, team_id: teamA });
            const mB = seedMembership({ user_id: uB, team_id: teamB });
            seedStandup({ posted_by: mA, for_team: teamA, blocked_by: 'blockedA' });
            seedStandup({ posted_by: mB, for_team: teamB, blocked_by: 'blockedB' });
            expect(standupRepo.countActiveBlockersByTeam(teamA)).toBe(1);
        });
    });

    // ---- listStatusByTeam -----------------------------------------------

    describe('listStatusByTeam', () => {
        it('returns non-blocked standups of the given status, newest-first', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'old', status_flag: 'In progress', blocked_by: null, created_at: '2026-01-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'new', status_flag: 'In progress', blocked_by: null, created_at: '2026-02-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'other', status_flag: 'On track', blocked_by: null });

            const rows = standupRepo.listStatusByTeam(team_id, 'In progress');
            expect(rows.map(r => r.worked_on)).toEqual(['new', 'old']);
        });

        it('excludes standups with an active blocker (their displayed status is Blocked)', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'clear',   status_flag: 'In progress', blocked_by: null });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'blocked', status_flag: 'In progress', blocked_by: 'stuck', blocker_resolved: 0 });

            const rows = standupRepo.listStatusByTeam(team_id, 'In progress');
            expect(rows).toHaveLength(1);
            expect(rows[0].worked_on).toBe('clear');
        });

        it('includes a resolved-blocker standup under its stored status', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'fixed', status_flag: 'On track', blocked_by: 'was stuck', blocker_resolved: 1 });

            const rows = standupRepo.listStatusByTeam(team_id, 'On track');
            expect(rows).toHaveLength(1);
            expect(rows[0].worked_on).toBe('fixed');
        });

        it('does not apply the Blocked overlay to returned rows (they are non-blocked by definition)', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'On track', blocked_by: 'was stuck', blocker_resolved: 1 });

            const rows = standupRepo.listStatusByTeam(team_id, 'On track');
            // Resolved blocker → overlay does not fire → status shows through as stored.
            expect(rows[0].status_flag).toBe('On track');
        });

        it('treats an empty-string blocker as non-blocked', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'empty', status_flag: 'In progress', blocked_by: '' });

            const rows = standupRepo.listStatusByTeam(team_id, 'In progress');
            expect(rows).toHaveLength(1);
            expect(rows[0].worked_on).toBe('empty');
        });

        it('does not return standups from other teams', () => {
            const owner_id = seedUser();
            const teamA = seedTeam({ owned_by: owner_id });
            const teamB = seedTeam({ owned_by: owner_id });
            const mA = seedMembership({ user_id: seedUser(), team_id: teamA });
            const mB = seedMembership({ user_id: seedUser(), team_id: teamB });
            seedStandup({ posted_by: mA, for_team: teamA, worked_on: 'A', status_flag: 'In progress', blocked_by: null });
            seedStandup({ posted_by: mB, for_team: teamB, worked_on: 'B', status_flag: 'In progress', blocked_by: null });

            const rows = standupRepo.listStatusByTeam(teamA, 'In progress');
            expect(rows).toHaveLength(1);
            expect(rows[0].worked_on).toBe('A');
        });

        it('respects limit and offset', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            for (let i = 0; i < 4; i++) {
                seedStandup({
                    posted_by: member_id, for_team: team_id, worked_on: `s${i}`,
                    status_flag: 'In progress', blocked_by: null,
                    created_at: `2026-0${i + 1}-01T00:00:00.000Z`,
                });
            }
            // newest-first: s3, s2, s1, s0 — offset 1, limit 2 → s2, s1
            const rows = standupRepo.listStatusByTeam(team_id, 'In progress', { limit: 2, offset: 1 });
            expect(rows.map(r => r.worked_on)).toEqual(['s2', 's1']);
        });

        it('returns an empty array when nothing matches', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'On track', blocked_by: null });
            expect(standupRepo.listStatusByTeam(team_id, 'In progress')).toEqual([]);
        });
    });

    // ---- listStatusByPoster ---------------------------------------------

    describe('listStatusByPoster', () => {
        it('returns the member\'s non-blocked standups of the given status, newest-first', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'old', status_flag: 'On track', blocked_by: null, created_at: '2026-01-01T00:00:00.000Z' });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'new', status_flag: 'On track', blocked_by: null, created_at: '2026-02-01T00:00:00.000Z' });

            const rows = standupRepo.listStatusByPoster(member_id, 'On track');
            expect(rows.map(r => r.worked_on)).toEqual(['new', 'old']);
        });

        it('excludes the member\'s actively-blocked standups', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'clear',   status_flag: 'In progress', blocked_by: null });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'blocked', status_flag: 'In progress', blocked_by: 'stuck', blocker_resolved: 0 });

            const rows = standupRepo.listStatusByPoster(member_id, 'In progress');
            expect(rows).toHaveLength(1);
            expect(rows[0].worked_on).toBe('clear');
        });

        it('does not return standups posted by other members', () => {
            const owner_id = seedUser();
            const team_id = seedTeam({ owned_by: owner_id });
            const mA = seedMembership({ user_id: seedUser(), team_id: team_id, display_name: 'A' });
            const mB = seedMembership({ user_id: seedUser(), team_id: team_id, display_name: 'B' });
            seedStandup({ posted_by: mA, for_team: team_id, worked_on: 'byA', status_flag: 'In progress', blocked_by: null });
            seedStandup({ posted_by: mB, for_team: team_id, worked_on: 'byB', status_flag: 'In progress', blocked_by: null });

            const rows = standupRepo.listStatusByPoster(mA, 'In progress');
            expect(rows).toHaveLength(1);
            expect(rows[0].worked_on).toBe('byA');
        });

        it('respects limit and offset', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            for (let i = 0; i < 4; i++) {
                seedStandup({
                    posted_by: member_id, for_team: team_id, worked_on: `s${i}`,
                    status_flag: 'On track', blocked_by: null,
                    created_at: `2026-0${i + 1}-01T00:00:00.000Z`,
                });
            }
            const rows = standupRepo.listStatusByPoster(member_id, 'On track', { limit: 2, offset: 1 });
            expect(rows.map(r => r.worked_on)).toEqual(['s2', 's1']);
        });

        it('returns an empty array when the member has no matching standups', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'In progress', blocked_by: null });
            expect(standupRepo.listStatusByPoster(member_id, 'On track')).toEqual([]);
        });
    });

    // ---- countStatusByTeam ----------------------------------------------

    describe('countStatusByTeam', () => {
        it('counts non-blocked standups matching the given status', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'In progress', blocked_by: null });
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'In progress', blocked_by: null });
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'On track',    blocked_by: null });

            expect(standupRepo.countStatusByTeam(team_id, 'In progress')).toBe(2);
            expect(standupRepo.countStatusByTeam(team_id, 'On track')).toBe(1);
        });

        it('excludes standups with an active (unresolved) blocker', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            // Stored as 'In progress' but actively blocked → displayed as 'Blocked',
            // so it must NOT count toward 'In progress'.
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'In progress', blocked_by: 'stuck', blocker_resolved: 0 });
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'In progress', blocked_by: null });

            expect(standupRepo.countStatusByTeam(team_id, 'In progress')).toBe(1);
        });

        it('counts a resolved-blocker standup under its stored status', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            // Resolved blocker → no longer 'Blocked', so it counts under its stored flag.
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'On track', blocked_by: 'was stuck', blocker_resolved: 1 });

            expect(standupRepo.countStatusByTeam(team_id, 'On track')).toBe(1);
        });

        it('treats an empty-string blocker as non-blocked', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'In progress', blocked_by: '' });
            expect(standupRepo.countStatusByTeam(team_id, 'In progress')).toBe(1);
        });

        it('returns 0 when no standup matches the status', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'In progress', blocked_by: null });
            expect(standupRepo.countStatusByTeam(team_id, 'On track')).toBe(0);
        });

        it('does not count standups from other teams', () => {
            const owner_id = seedUser();
            const teamA = seedTeam({ owned_by: owner_id });
            const teamB = seedTeam({ owned_by: owner_id });
            const mA = seedMembership({ user_id: seedUser(), team_id: teamA });
            const mB = seedMembership({ user_id: seedUser(), team_id: teamB });
            seedStandup({ posted_by: mA, for_team: teamA, status_flag: 'In progress', blocked_by: null });
            seedStandup({ posted_by: mB, for_team: teamB, status_flag: 'In progress', blocked_by: null });

            expect(standupRepo.countStatusByTeam(teamA, 'In progress')).toBe(1);
        });

        it('throws when the requested status_flag is not allowed', () => {
            const { team_id } = setupPosterAndTeam();
            expect(() => standupRepo.countStatusByTeam(team_id, 'Done')).toThrow(/status_flag/i);
        });

        it('throws when the requested status_flag is "Blocked" (not a stored value)', () => {
            const { team_id } = setupPosterAndTeam();
            // 'Blocked' is an outgoing overlay, never a queryable stored status.
            expect(() => standupRepo.countStatusByTeam(team_id, 'Blocked')).toThrow(/status_flag/i);
        });
    });

    // ---- resolveBlocker -------------------------------------------------

    describe('resolveBlocker', () => {
        it('sets blocker_resolved to 1 and returns the row', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'stuck' });
            const updated = standupRepo.resolveBlocker(id);
            expect(updated.blocker_resolved).toBe(1);
        });

        it('preserves the blocker content after resolving', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'waiting on review' });
            const updated = standupRepo.resolveBlocker(id);
            // The whole point: content stays so it can be shown crossed-out
            expect(updated.blocked_by).toBe('waiting on review');
            expect(updated.blocker_resolved).toBe(1);
        });

        it('persists the change to the database', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'stuck' });
            standupRepo.resolveBlocker(id);
            const row = db.prepare('SELECT blocker_resolved FROM standups WHERE id = ?').get(id);
            expect(row.blocker_resolved).toBe(1);
        });

        it('refreshes updated_at', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({
                posted_by: member_id, for_team: team_id, blocked_by: 'stuck',
                updated_at: '2020-01-01T00:00:00.000Z',
            });
            const updated = standupRepo.resolveBlocker(id);
            expect(updated.updated_at).toMatch(ISO_RE);
            expect(updated.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });

        it('is a no-op on a standup with no blocker (null)', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({
                posted_by: member_id, for_team: team_id, blocked_by: null,
                updated_at: '2020-01-01T00:00:00.000Z',
            });
            const updated = standupRepo.resolveBlocker(id);
            // Guarded by the WHERE clause — nothing changes, no CHECK violation
            expect(updated.blocker_resolved).toBe(0);
            expect(updated.updated_at).toBe('2020-01-01T00:00:00.000Z'); // not bumped
        });

        it('is a no-op on a standup with an empty-string blocker', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({
                posted_by: member_id, for_team: team_id, blocked_by: '',
                updated_at: '2020-01-01T00:00:00.000Z',
            });
            const updated = standupRepo.resolveBlocker(id);
            expect(updated.blocker_resolved).toBe(0);
            expect(updated.updated_at).toBe('2020-01-01T00:00:00.000Z');
        });

        it('is idempotent — resolving an already-resolved blocker stays resolved', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'stuck', blocker_resolved: 1 });
            const updated = standupRepo.resolveBlocker(id);
            expect(updated.blocker_resolved).toBe(1);
        });
    });

    // ---- unresolveBlocker -----------------------------------------------

    describe('unresolveBlocker', () => {
        it('sets blocker_resolved back to 0 and returns the row', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'stuck', blocker_resolved: 1 });
            const updated = standupRepo.unresolveBlocker(id);
            expect(updated.blocker_resolved).toBe(0);
        });

        it('preserves the blocker content', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'still stuck', blocker_resolved: 1 });
            const updated = standupRepo.unresolveBlocker(id);
            expect(updated.blocked_by).toBe('still stuck');
            expect(updated.blocker_resolved).toBe(0);
        });

        it('persists the change and bumps updated_at', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({
                posted_by: member_id, for_team: team_id, blocked_by: 'stuck', blocker_resolved: 1,
                updated_at: '2020-01-01T00:00:00.000Z',
            });
            standupRepo.unresolveBlocker(id);
            const row = db.prepare('SELECT blocker_resolved, updated_at FROM standups WHERE id = ?').get(id);
            expect(row.blocker_resolved).toBe(0);
            expect(row.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });

        it('is idempotent — unresolving an already-active blocker stays active', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, blocked_by: 'stuck', blocker_resolved: 0 });
            const updated = standupRepo.unresolveBlocker(id);
            expect(updated.blocker_resolved).toBe(0);
        });
    });

    // ---- status_flag behavior -------------------------------------------

    describe('status_flag', () => {
        // --- input restrictions (create) ---

        it('defaults to "In progress" when omitted on create', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const s = standupRepo.create({ posted_by: member_id, for_team: team_id });
            expect(s.status_flag).toBe('In progress');
        });

        it('accepts a valid status_flag on create', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const s = standupRepo.create({
                posted_by: member_id, for_team: team_id, status_flag: 'On track',
            });
            expect(s.status_flag).toBe('On track');
        });

        it('throws on create when status_flag is not an allowed value', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            expect(() => {
                standupRepo.create({
                    posted_by: member_id, for_team: team_id, status_flag: 'Done',
                });
            }).toThrow(/status_flag/i);
        });

        it('throws on create when status_flag is "Blocked" (an outgoing-only overlay, never stored)', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            // 'Blocked' is applied on the way out, never persisted — passing it in is invalid.
            expect(() => {
                standupRepo.create({
                    posted_by: member_id, for_team: team_id, status_flag: 'Blocked',
                });
            }).toThrow(/status_flag/i);
        });

        // --- input restrictions (update) ---

        it('accepts a valid status_flag on update', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id, status_flag: 'In progress' });
            const updated = standupRepo.update(id, { status_flag: 'On track' });
            expect(updated.status_flag).toBe('On track');
        });

        it('throws on update when status_flag is not an allowed value', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id });
            expect(() => {
                standupRepo.update(id, { status_flag: 'Done' });
            }).toThrow(/status_flag/i);
        });

        it('throws on update when status_flag is "Blocked"', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({ posted_by: member_id, for_team: team_id });
            expect(() => {
                standupRepo.update(id, { status_flag: 'Blocked' });
            }).toThrow(/status_flag/i);
        });

        it('persists only the stored value, never the "Blocked" overlay', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            // An active blocker — its returned status_flag will be 'Blocked',
            // but the stored column must remain the underlying 'In progress'.
            const id = seedStandup({
                posted_by: member_id, for_team: team_id,
                blocked_by: 'stuck', blocker_resolved: 0, status_flag: 'In progress',
            });
            standupRepo.update(id, { worked_on: 'changed' });

            const stored = db.prepare('SELECT status_flag FROM standups WHERE id = ?').get(id);
            expect(stored.status_flag).toBe('In progress'); // overlay never written
        });

        // --- outgoing overlay: blocker overrides status_flag ---

        it('overlays "Blocked" on a row with an active (unresolved) blocker', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const s = standupRepo.create({
                posted_by: member_id, for_team: team_id,
                status_flag: 'On track', blocked_by: 'waiting on review',
            });
            // Active blocker overrides whatever status_flag was supplied.
            expect(s.status_flag).toBe('Blocked');
        });

        it('does NOT overlay "Blocked" once the blocker is resolved', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({
                posted_by: member_id, for_team: team_id,
                status_flag: 'On track', blocked_by: 'was stuck', blocker_resolved: 1,
            });
            const row = standupRepo.findById(id);
            // Resolved blocker → the underlying status_flag shows through again.
            expect(row.status_flag).toBe('On track');
        });

        it('does NOT overlay "Blocked" on a standup with no blocker', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const s = standupRepo.create({
                posted_by: member_id, for_team: team_id,
                status_flag: 'On track', blocked_by: null,
            });
            expect(s.status_flag).toBe('On track');
        });

        it('treats an empty-string blocker as no blocker (no overlay)', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({
                posted_by: member_id, for_team: team_id,
                status_flag: 'In progress', blocked_by: '',
            });
            const row = standupRepo.findById(id);
            // '' is not a real blocker, so no overlay.
            expect(row.status_flag).toBe('In progress');
        });

        it('applies the overlay on reads through findById', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({
                posted_by: member_id, for_team: team_id,
                status_flag: 'In progress', blocked_by: 'stuck', blocker_resolved: 0,
            });
            expect(standupRepo.findById(id).status_flag).toBe('Blocked');
        });

        it('applies the overlay per-row in list results', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'clear',   status_flag: 'On track',    blocked_by: null });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'blocked', status_flag: 'In progress', blocked_by: 'stuck', blocker_resolved: 0 });
            seedStandup({ posted_by: member_id, for_team: team_id, worked_on: 'fixed',   status_flag: 'On track',    blocked_by: 'was stuck', blocker_resolved: 1 });

            const rows = standupRepo.listByTeam(team_id);
            const byName = Object.fromEntries(rows.map(r => [r.worked_on, r.status_flag]));
            expect(byName.clear).toBe('On track');    // no blocker → unchanged
            expect(byName.blocked).toBe('Blocked');    // active blocker → overlay
            expect(byName.fixed).toBe('On track');     // resolved blocker → unchanged
        });

        it('reflects the overlay transition across resolve / unresolve', () => {
            const { member_id, team_id } = setupPosterAndTeam();
            const id = seedStandup({
                posted_by: member_id, for_team: team_id,
                status_flag: 'On track', blocked_by: 'stuck', blocker_resolved: 0,
            });
            // Active blocker → Blocked
            expect(standupRepo.findById(id).status_flag).toBe('Blocked');
            // Resolve → underlying flag shows through
            expect(standupRepo.resolveBlocker(id).status_flag).toBe('On track');
            // Unresolve → Blocked again
            expect(standupRepo.unresolveBlocker(id).status_flag).toBe('Blocked');
        });
    });
});