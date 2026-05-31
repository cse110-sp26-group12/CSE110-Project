import { createDatabaseConnection, setDb, resetDb } from '../../database/connection.js';
import { runDatabaseMigrations } from '../../database/migrate.js';
import { tempDbPath, cleanupDb } from '../../__test-helpers__/tempDb.js';
import { teamMemberRepo } from '../../data-repo/dataRepository.js';

describe('teamMemberRepo', () => {
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
                              updated_at = '2026-01-01T00:00:00.000Z',
                              left_at = null }) {
        const result = db.prepare(`
            INSERT INTO team_members (user_id, team_id, display_name, member_role, joined_at, updated_at, left_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(user_id, team_id, display_name, member_role, joined_at, updated_at, left_at);
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

    // Convenience: a user + a team owned by a separate owner, ready for membership tests.
    function setupUserAndTeam() {
        const ownerId = seedUser();
        const userId = seedUser();
        const teamId = seedTeam({ owned_by: ownerId });
        return { ownerId, userId, teamId };
    }

    const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    // ---- create ---------------------------------------------------------

    describe('create', () => {
        it('inserts a membership and returns the persisted row', () => {
            const { userId, teamId } = setupUserAndTeam();
            const m = teamMemberRepo.create({
                user_id: userId,
                team_id: teamId,
                display_name: 'Alice A.',
            });

            expect(m).toBeDefined();
            expect(m.id).toBeGreaterThan(0);
            expect(m.user_id).toBe(userId);
            expect(m.team_id).toBe(teamId);
            expect(m.display_name).toBe('Alice A.');
        });

        it('defaults member_role to member when omitted', () => {
            const { userId, teamId } = setupUserAndTeam();
            const m = teamMemberRepo.create({
                user_id: userId, team_id: teamId, display_name: 'Alice',
            });
            expect(m.member_role).toBe('member');
        });

        it('stores member_role when provided', () => {
            const { userId, teamId } = setupUserAndTeam();
            const m = teamMemberRepo.create({
                user_id: userId, team_id: teamId, display_name: 'Boss', member_role: 'admin',
            });
            expect(m.member_role).toBe('admin');
        });

        it('persists the row to the database', () => {
            const { userId, teamId } = setupUserAndTeam();
            const m = teamMemberRepo.create({
                user_id: userId, team_id: teamId, display_name: 'Alice',
            });
            const row = db.prepare('SELECT * FROM team_members WHERE id = ?').get(m.id);
            expect(row.display_name).toBe('Alice');
        });

        it('sets joined_at and updated_at as equal ISO timestamps', () => {
            const { userId, teamId } = setupUserAndTeam();
            const m = teamMemberRepo.create({
                user_id: userId, team_id: teamId, display_name: 'Alice',
            });
            expect(m.joined_at).toMatch(ISO_RE);
            expect(m.updated_at).toMatch(ISO_RE);
            expect(m.joined_at).toBe(m.updated_at);
        });

        it('leaves left_at null on creation', () => {
            const { userId, teamId } = setupUserAndTeam();
            const m = teamMemberRepo.create({
                user_id: userId, team_id: teamId, display_name: 'Alice',
            });
            expect(m.left_at).toBeNull();
        });

        it('throws on a duplicate user/team pair', () => {
            const { userId, teamId } = setupUserAndTeam();
            teamMemberRepo.create({ user_id: userId, team_id: teamId, display_name: 'First' });

            expect(() => {
                teamMemberRepo.create({ user_id: userId, team_id: teamId, display_name: 'Second' });
            }).toThrow(/UNIQUE/);
        });

        it('throws when user_id references a nonexistent user', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            expect(() => {
                teamMemberRepo.create({ user_id: 99999, team_id: teamId, display_name: 'Ghost' });
            }).toThrow(/FOREIGN KEY/i);
        });

        it('throws when team_id references a nonexistent team', () => {
            const userId = seedUser();
            expect(() => {
                teamMemberRepo.create({ user_id: userId, team_id: 99999, display_name: 'Ghost' });
            }).toThrow(/FOREIGN KEY/i);
        });

        it('throws when member_role violates the CHECK constraint', () => {
            const { userId, teamId } = setupUserAndTeam();
            expect(() => {
                teamMemberRepo.create({
                    user_id: userId, team_id: teamId, display_name: 'X', member_role: 'superuser',
                });
            }).toThrow(/CHECK/);
        });

        it('allows the same user to be a member of two different teams', () => {
            const ownerId = seedUser();
            const userId = seedUser();
            const teamA = seedTeam({ owned_by: ownerId });
            const teamB = seedTeam({ owned_by: ownerId });

            const a = teamMemberRepo.create({ user_id: userId, team_id: teamA, display_name: 'In A' });
            const b = teamMemberRepo.create({ user_id: userId, team_id: teamB, display_name: 'In B' });
            expect(a.id).not.toBe(b.id);
        });
    });

    // ---- findById -------------------------------------------------------

    describe('findById', () => {
        it('returns the matching membership', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, display_name: 'Alice' });
            const m = teamMemberRepo.findById(id);
            expect(m.id).toBe(id);
            expect(m.display_name).toBe('Alice');
        });

        it('returns undefined for a nonexistent id', () => {
            expect(teamMemberRepo.findById(99999)).toBeUndefined();
        });

        it('excludes former members by default', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, left_at: '2026-02-01T00:00:00.000Z' });
            expect(teamMemberRepo.findById(id)).toBeUndefined();
        });

        it('includes former members when includeFormer is true', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, left_at: '2026-02-01T00:00:00.000Z' });
            const m = teamMemberRepo.findById(id, { includeFormer: true });
            expect(m).toBeDefined();
            expect(m.id).toBe(id);
        });
    });

    // ---- findByUserAndTeam ----------------------------------------------

    describe('findByUserAndTeam', () => {
        it('returns the matching active membership', () => {
            const { userId, teamId } = setupUserAndTeam();
            seedMembership({ user_id: userId, team_id: teamId, display_name: 'Alice' });
            const m = teamMemberRepo.findByUserAndTeam(userId, teamId);
            expect(m).toBeDefined();
            expect(m.user_id).toBe(userId);
            expect(m.team_id).toBe(teamId);
        });

        it('returns undefined when no membership exists for the pair', () => {
            const { userId, teamId } = setupUserAndTeam();
            expect(teamMemberRepo.findByUserAndTeam(userId, teamId)).toBeUndefined();
        });

        it('excludes a former membership by default', () => {
            const { userId, teamId } = setupUserAndTeam();
            seedMembership({ user_id: userId, team_id: teamId, left_at: '2026-02-01T00:00:00.000Z' });
            expect(teamMemberRepo.findByUserAndTeam(userId, teamId)).toBeUndefined();
        });

        it('includes a former membership when requested', () => {
            const { userId, teamId } = setupUserAndTeam();
            seedMembership({ user_id: userId, team_id: teamId, left_at: '2026-02-01T00:00:00.000Z' });
            const m = teamMemberRepo.findByUserAndTeam(userId, teamId, { includeFormer: true });
            expect(m).toBeDefined();
        });

        it('does not match a different team for the same user', () => {
            const ownerId = seedUser();
            const userId = seedUser();
            const teamA = seedTeam({ owned_by: ownerId });
            const teamB = seedTeam({ owned_by: ownerId });
            seedMembership({ user_id: userId, team_id: teamA });

            expect(teamMemberRepo.findByUserAndTeam(userId, teamB)).toBeUndefined();
        });
    });

    // ---- listByTeam -----------------------------------------------------

    describe('listByTeam', () => {
        it('returns active members of the team, oldest-joined first', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            const u1 = seedUser();
            const u2 = seedUser();
            const u3 = seedUser();
            seedMembership({ user_id: u1, team_id: teamId, display_name: 'first',  joined_at: '2026-01-01T00:00:00.000Z' });
            seedMembership({ user_id: u2, team_id: teamId, display_name: 'second', joined_at: '2026-02-01T00:00:00.000Z' });
            seedMembership({ user_id: u3, team_id: teamId, display_name: 'third',  joined_at: '2026-03-01T00:00:00.000Z' });

            const members = teamMemberRepo.listByTeam(teamId);
            expect(members.map(m => m.display_name)).toEqual(['first', 'second', 'third']);
        });

        it('excludes former members by default', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            const u1 = seedUser();
            const u2 = seedUser();
            seedMembership({ user_id: u1, team_id: teamId, display_name: 'active' });
            seedMembership({ user_id: u2, team_id: teamId, display_name: 'gone', left_at: '2026-02-01T00:00:00.000Z' });

            const members = teamMemberRepo.listByTeam(teamId);
            expect(members).toHaveLength(1);
            expect(members[0].display_name).toBe('active');
        });

        it('includes former members when requested', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            const u1 = seedUser();
            const u2 = seedUser();
            seedMembership({ user_id: u1, team_id: teamId, display_name: 'active' });
            seedMembership({ user_id: u2, team_id: teamId, display_name: 'gone', left_at: '2026-02-01T00:00:00.000Z' });

            const members = teamMemberRepo.listByTeam(teamId, { includeFormer: true });
            expect(members).toHaveLength(2);
        });

        it('does not return members of other teams', () => {
            const ownerId = seedUser();
            const teamA = seedTeam({ owned_by: ownerId });
            const teamB = seedTeam({ owned_by: ownerId });
            const u1 = seedUser();
            const u2 = seedUser();
            seedMembership({ user_id: u1, team_id: teamA, display_name: 'inA' });
            seedMembership({ user_id: u2, team_id: teamB, display_name: 'inB' });

            const members = teamMemberRepo.listByTeam(teamA);
            expect(members).toHaveLength(1);
            expect(members[0].display_name).toBe('inA');
        });

        it('returns an empty array when the team has no members', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            expect(teamMemberRepo.listByTeam(teamId)).toEqual([]);
        });
    });

    // ---- listByUser -----------------------------------------------------

    describe('listByUser', () => {
        it('returns the user\'s active memberships, newest-joined first', () => {
            const ownerId = seedUser();
            const userId = seedUser();
            const teamA = seedTeam({ owned_by: ownerId });
            const teamB = seedTeam({ owned_by: ownerId });
            const teamC = seedTeam({ owned_by: ownerId });
            seedMembership({ user_id: userId, team_id: teamA, display_name: 'old', joined_at: '2026-01-01T00:00:00.000Z' });
            seedMembership({ user_id: userId, team_id: teamB, display_name: 'mid', joined_at: '2026-02-01T00:00:00.000Z' });
            seedMembership({ user_id: userId, team_id: teamC, display_name: 'new', joined_at: '2026-03-01T00:00:00.000Z' });

            const memberships = teamMemberRepo.listByUser(userId);
            expect(memberships.map(m => m.display_name)).toEqual(['new', 'mid', 'old']);
        });

        it('excludes former memberships by default', () => {
            const ownerId = seedUser();
            const userId = seedUser();
            const teamA = seedTeam({ owned_by: ownerId });
            const teamB = seedTeam({ owned_by: ownerId });
            seedMembership({ user_id: userId, team_id: teamA, display_name: 'active' });
            seedMembership({ user_id: userId, team_id: teamB, display_name: 'left', left_at: '2026-02-01T00:00:00.000Z' });

            const memberships = teamMemberRepo.listByUser(userId);
            expect(memberships).toHaveLength(1);
            expect(memberships[0].display_name).toBe('active');
        });

        it('includes former memberships when requested', () => {
            const ownerId = seedUser();
            const userId = seedUser();
            const teamA = seedTeam({ owned_by: ownerId });
            const teamB = seedTeam({ owned_by: ownerId });
            seedMembership({ user_id: userId, team_id: teamA, display_name: 'active' });
            seedMembership({ user_id: userId, team_id: teamB, display_name: 'left', left_at: '2026-02-01T00:00:00.000Z' });

            const memberships = teamMemberRepo.listByUser(userId, { includeFormer: true });
            expect(memberships).toHaveLength(2);
        });

        it('returns an empty array when the user has no memberships', () => {
            const userId = seedUser();
            expect(teamMemberRepo.listByUser(userId)).toEqual([]);
        });
    });

    // ---- listByTeamAndRole ----------------------------------------------

    describe('listByTeamAndRole', () => {
        it('returns only active members with the given role', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            const a1 = seedUser();
            const a2 = seedUser();
            const m1 = seedUser();
            seedMembership({ user_id: a1, team_id: teamId, display_name: 'admin1', member_role: 'admin' });
            seedMembership({ user_id: a2, team_id: teamId, display_name: 'admin2', member_role: 'admin' });
            seedMembership({ user_id: m1, team_id: teamId, display_name: 'member1', member_role: 'member' });

            const admins = teamMemberRepo.listByTeamAndRole(teamId, 'admin');
            expect(admins.map(m => m.display_name).sort()).toEqual(['admin1', 'admin2']);
        });

        it('excludes former members even if their role matches', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            const a1 = seedUser();
            const a2 = seedUser();
            seedMembership({ user_id: a1, team_id: teamId, display_name: 'active_admin', member_role: 'admin' });
            seedMembership({ user_id: a2, team_id: teamId, display_name: 'former_admin', member_role: 'admin', left_at: '2026-02-01T00:00:00.000Z' });

            const admins = teamMemberRepo.listByTeamAndRole(teamId, 'admin');
            expect(admins).toHaveLength(1);
            expect(admins[0].display_name).toBe('active_admin');
        });

        it('returns an empty array when no member holds the role', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            const m1 = seedUser();
            seedMembership({ user_id: m1, team_id: teamId, member_role: 'member' });

            expect(teamMemberRepo.listByTeamAndRole(teamId, 'admin')).toEqual([]);
        });
    });

    // ---- isActiveMember -------------------------------------------------

    describe('isActiveMember', () => {
        it('returns true for an active membership', () => {
            const { userId, teamId } = setupUserAndTeam();
            seedMembership({ user_id: userId, team_id: teamId });
            expect(teamMemberRepo.isActiveMember(userId, teamId)).toBe(true);
        });

        it('returns false when no membership exists', () => {
            const { userId, teamId } = setupUserAndTeam();
            expect(teamMemberRepo.isActiveMember(userId, teamId)).toBe(false);
        });

        it('returns false for a former membership', () => {
            const { userId, teamId } = setupUserAndTeam();
            seedMembership({ user_id: userId, team_id: teamId, left_at: '2026-02-01T00:00:00.000Z' });
            expect(teamMemberRepo.isActiveMember(userId, teamId)).toBe(false);
        });
    });

    // ---- countActiveByTeam ----------------------------------------------

    describe('countActiveByTeam', () => {
        it('counts active members of the team', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            seedMembership({ user_id: seedUser(), team_id: teamId });
            seedMembership({ user_id: seedUser(), team_id: teamId });
            expect(teamMemberRepo.countActiveByTeam(teamId)).toBe(2);
        });

        it('returns 0 when the team has no members', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            expect(teamMemberRepo.countActiveByTeam(teamId)).toBe(0);
        });

        it('excludes former members from the count', () => {
            const ownerId = seedUser();
            const teamId = seedTeam({ owned_by: ownerId });
            seedMembership({ user_id: seedUser(), team_id: teamId });
            seedMembership({ user_id: seedUser(), team_id: teamId, left_at: '2026-02-01T00:00:00.000Z' });
            expect(teamMemberRepo.countActiveByTeam(teamId)).toBe(1);
        });

        it('does not count members of other teams', () => {
            const ownerId = seedUser();
            const teamA = seedTeam({ owned_by: ownerId });
            const teamB = seedTeam({ owned_by: ownerId });
            seedMembership({ user_id: seedUser(), team_id: teamA });
            seedMembership({ user_id: seedUser(), team_id: teamB });
            expect(teamMemberRepo.countActiveByTeam(teamA)).toBe(1);
        });
    });

    // ---- update ---------------------------------------------------------

    describe('update', () => {
        it('updates display_name and returns the new row', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, display_name: 'old' });
            const updated = teamMemberRepo.update(id, { display_name: 'new' });
            expect(updated.display_name).toBe('new');
        });

        it('updates member_role (promotion/demotion)', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, member_role: 'member' });
            const updated = teamMemberRepo.update(id, { member_role: 'admin' });
            expect(updated.member_role).toBe('admin');
        });

        it('persists the change to the database', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, display_name: 'old' });
            teamMemberRepo.update(id, { display_name: 'new' });
            const row = db.prepare('SELECT display_name FROM team_members WHERE id = ?').get(id);
            expect(row.display_name).toBe('new');
        });

        it('refreshes updated_at to a new ISO timestamp', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, updated_at: '2020-01-01T00:00:00.000Z' });
            const updated = teamMemberRepo.update(id, { display_name: 'changed' });
            expect(updated.updated_at).toMatch(ISO_RE);
            expect(updated.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });

        it('does not modify joined_at', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, joined_at: '2020-01-01T00:00:00.000Z' });
            const updated = teamMemberRepo.update(id, { display_name: 'changed' });
            expect(updated.joined_at).toBe('2020-01-01T00:00:00.000Z');
        });

        it('ignores non-whitelisted keys', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, display_name: 'orig' });
            const updated = teamMemberRepo.update(id, {
                display_name: 'legit',
                id: 9999,                       // ignored
                user_id: 9999,                  // ignored
                team_id: 9999,                  // ignored
                joined_at: 'hacked',            // ignored
                left_at: 'hacked',              // ignored
            });

            expect(updated.id).toBe(id);
            expect(updated.user_id).toBe(userId);
            expect(updated.team_id).toBe(teamId);
            expect(updated.display_name).toBe('legit');
            expect(updated.joined_at).not.toBe('hacked');
            expect(updated.left_at).toBeNull();
        });

        it('throws when member_role is updated to an invalid value', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId });
            expect(() => teamMemberRepo.update(id, { member_role: 'wizard' })).toThrow(/CHECK/);
        });

        it('returns the unmodified row when no valid fields are given', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, display_name: 'unchanged', updated_at: '2020-01-01T00:00:00.000Z' });
            const result = teamMemberRepo.update(id, { not_a_field: 'x' });
            expect(result.display_name).toBe('unchanged');
            expect(result.updated_at).toBe('2020-01-01T00:00:00.000Z'); // not bumped
        });

        it('can update a former member', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, left_at: '2026-02-01T00:00:00.000Z' });
            const updated = teamMemberRepo.update(id, { display_name: 'still_editable' });
            expect(updated).toBeDefined();
            expect(updated.display_name).toBe('still_editable');
        });
    });

    // ---- leave ----------------------------------------------------------

    describe('leave', () => {
        it('sets left_at and returns the row', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId });
            const result = teamMemberRepo.leave(id);
            expect(result.left_at).toMatch(ISO_RE);
        });

        it('persists the leave to the database', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId });
            teamMemberRepo.leave(id);
            const row = db.prepare('SELECT left_at FROM team_members WHERE id = ?').get(id);
            expect(row.left_at).not.toBeNull();
        });

        it('makes the membership invisible to default findById', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId });
            teamMemberRepo.leave(id);
            expect(teamMemberRepo.findById(id)).toBeUndefined();
            expect(teamMemberRepo.findById(id, { includeFormer: true })).toBeDefined();
        });

        it('does not re-leave an already-left member', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId });
            const first = teamMemberRepo.leave(id);
            const firstLeftAt = first.left_at;

            const second = teamMemberRepo.leave(id);
            expect(second.left_at).toBe(firstLeftAt); // unchanged
        });

        it('refreshes updated_at', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, updated_at: '2020-01-01T00:00:00.000Z' });
            const result = teamMemberRepo.leave(id);
            expect(result.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });
    });

    // ---- rejoin ---------------------------------------------------------

    describe('rejoin', () => {
        it('clears left_at and returns the active row', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, left_at: '2026-02-01T00:00:00.000Z' });
            const rejoined = teamMemberRepo.rejoin(id);
            expect(rejoined.left_at).toBeNull();
        });

        it('makes the membership visible to default findById again', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, left_at: '2026-02-01T00:00:00.000Z' });
            teamMemberRepo.rejoin(id);
            expect(teamMemberRepo.findById(id)).toBeDefined();
        });

        it('persists the rejoin to the database', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, left_at: '2026-02-01T00:00:00.000Z' });
            teamMemberRepo.rejoin(id);
            const row = db.prepare('SELECT left_at FROM team_members WHERE id = ?').get(id);
            expect(row.left_at).toBeNull();
        });

        it('keeps the existing display_name when none is supplied', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, display_name: 'OldName', left_at: '2026-02-01T00:00:00.000Z' });
            const rejoined = teamMemberRepo.rejoin(id);
            expect(rejoined.display_name).toBe('OldName');
        });

        it('updates display_name when supplied', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, display_name: 'OldName', left_at: '2026-02-01T00:00:00.000Z' });
            const rejoined = teamMemberRepo.rejoin(id, { display_name: 'NewName' });
            expect(rejoined.left_at).toBeNull();
            expect(rejoined.display_name).toBe('NewName');
        });

        it('refreshes updated_at', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId, left_at: '2026-02-01T00:00:00.000Z', updated_at: '2020-01-01T00:00:00.000Z' });
            const rejoined = teamMemberRepo.rejoin(id);
            expect(rejoined.updated_at).toMatch(ISO_RE);
            expect(rejoined.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
        });

        it('round-trips: leave then rejoin restores active state', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId });
            teamMemberRepo.leave(id);
            expect(teamMemberRepo.isActiveMember(userId, teamId)).toBe(false);

            teamMemberRepo.rejoin(id);
            expect(teamMemberRepo.isActiveMember(userId, teamId)).toBe(true);
        });
    });

    // ---- hardDelete -----------------------------------------------------

    describe('hardDelete', () => {
        it('removes the row and returns true', () => {
            const { userId, teamId } = setupUserAndTeam();
            const id = seedMembership({ user_id: userId, team_id: teamId });
            const ok = teamMemberRepo.hardDelete(id);

            expect(ok).toBe(true);
            const row = db.prepare('SELECT * FROM team_members WHERE id = ?').get(id);
            expect(row).toBeUndefined();
        });

        it('returns false when the membership does not exist', () => {
            expect(teamMemberRepo.hardDelete(99999)).toBe(false);
        });

        it('cascades to dependent rows (standups posted under the membership)', () => {
            const { userId, teamId } = setupUserAndTeam();
            const membershipId = seedMembership({ user_id: userId, team_id: teamId });
            seedStandup({ posted_by: membershipId, for_team: teamId });

            teamMemberRepo.hardDelete(membershipId);

            const standups = db.prepare(
                'SELECT * FROM standups WHERE posted_by = ?'
            ).all(membershipId);
            expect(standups).toEqual([]);
        });
    });
});