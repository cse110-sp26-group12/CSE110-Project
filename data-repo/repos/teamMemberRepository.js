// repositories/team-members/teamMemberRepo.js
import { getDb } from '../../database/connection.js';
import { repoUtil } from '../_util.js';

/**
 * Pure CRUD for the team_members table
 *
 * - All methods take simple arguments or plain objects
 * - All reads return plain objects, an array of plain object, or undefined
 * - No logic, authorization, or cross-table operations
 * - Former members (left_at IS NOT NULL) excluded by default; overridden by includeFormer
 * - Returns are in the form of persisted rows with database-assigned fields
 *
 * NOTE: Unlike users/teams, memberships use a leave/rejoin model via `left_at`
 * rather than deleted_at/kill_after. There is no scheduled purge — a membership
 * row persists as long as the team exists so the user can rejoin and so past
 * content stays attributable. Hard deletion happens only via cascade when the
 * parent user or team is hard-deleted.
 */

const MUTABLE_FIELDS = ['display_name', 'member_role'];

export const teamMemberRepo = {
  /**
   * Creates a new membership.
   * @param {{ user_id: number, team_id: number, display_name: string, member_role?: 'admin' | 'member' }} data
   * @returns {object} created membership row
   */
  create({ user_id, team_id, display_name, member_role = 'member' }) {
    const ts = repoUtil.now();
    const result = getDb()
      .prepare(
        `
            INSERT INTO team_members (user_id, team_id, display_name, member_role, joined_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(user_id, team_id, display_name, member_role, ts, ts);

    return this.findById(Number(result.lastInsertRowid));
  },

  /**
   * Finds an existing membership by ID.
   * @param { number } id membership id
   * @param { boolean } includeFormer include rows where the member has left (default false)
   * @returns {object | undefined } membership row if found | undefined otherwise
   */
  findById(id, { includeFormer = false } = {}) {
    const sql = includeFormer
      ? 'SELECT * FROM team_members WHERE id = ?'
      : 'SELECT * FROM team_members WHERE id = ? AND left_at IS NULL';
    return getDb().prepare(sql).get(id);
  },

  /**
   * Finds a membership by the user/team pair (the table's natural key). Call this to check for former team
   * membership before creating a new row.
   * @param { number } userId user id
   * @param { number } teamId team id
   * @param { boolean } includeFormer include rows where the member has left (default false)
   * @returns {object | undefined } membership row if found | undefined otherwise
   */
  findByUserAndTeam(userId, teamId, { includeFormer = false } = {}) {
    const sql = includeFormer
      ? 'SELECT * FROM team_members WHERE user_id = ? AND team_id = ?'
      : 'SELECT * FROM team_members WHERE user_id = ? AND team_id = ? AND left_at IS NULL';
    return getDb().prepare(sql).get(userId, teamId);
  },

  /**
   * Lists memberships for a team, oldest-joined first.
   * @param { number } teamId team id
   * @param { boolean } includeFormer include rows where the member has left (default false)
   * @returns {object[]}
   */
  listByTeam(teamId, { includeFormer = false } = {}) {
    const sql = includeFormer
      ? 'SELECT * FROM team_members WHERE team_id = ? ORDER BY joined_at ASC'
      : 'SELECT * FROM team_members WHERE team_id = ? AND left_at IS NULL ORDER BY joined_at ASC';
    return getDb().prepare(sql).all(teamId);
  },

  /**
   * Lists memberships for a user (the teams they belong to), newest-joined first.
   * @param { number } userId user id
   * @param { boolean } includeFormer include rows where the member has left (default false)
   * @returns {object[]}
   */
  listByUser(userId, { includeFormer = false } = {}) {
    const sql = includeFormer
      ? 'SELECT * FROM team_members WHERE user_id = ? ORDER BY joined_at DESC'
      : 'SELECT * FROM team_members WHERE user_id = ? AND left_at IS NULL ORDER BY joined_at DESC';
    return getDb().prepare(sql).all(userId);
  },

  /**
   * Lists active members of a team holding a given role.
   * @param { number } teamId team id
   * @param { 'admin' | 'member' } role role to filter by
   * @returns {object[]}
   */
  listByTeamAndRole(teamId, role) {
    return getDb()
      .prepare(
        'SELECT * FROM team_members WHERE team_id = ? AND member_role = ? AND left_at IS NULL ORDER BY joined_at ASC',
      )
      .all(teamId, role);
  },

  /**
   * Checks whether an active membership exists for the user/team pair.
   * @param { number } userId user id
   * @param { number } teamId team id
   * @returns { boolean } true if an active membership exists | false otherwise
   */
  isActiveMember(userId, teamId) {
    const row = getDb()
      .prepare(
        'SELECT 1 FROM team_members WHERE user_id = ? AND team_id = ? AND left_at IS NULL LIMIT 1',
      )
      .get(userId, teamId);
    return row !== undefined;
  },

  /**
   * Counts active members of a team.
   * @param { number } teamId team id
   * @returns { number } count of active members
   */
  countActiveByTeam(teamId) {
    const row = getDb()
      .prepare(
        'SELECT COUNT(*) AS n FROM team_members WHERE team_id = ? AND left_at IS NULL',
      )
      .get(teamId);
    return row.n;
  },

  /**
   * Updates mutable membership fields, including for former members. Updates updated_at.
   *  Ignores non-whitelisted keys. If no valid keys are given, the unmodified row is returned.
   * @param { number } id membership id
   * @param { object } updates subset of { display_name, member_role }; all other keys are ignored
   * @returns {object | undefined} updated row | undefined if not found
   */
  update(id, updates) {
    const fields = Object.keys(updates).filter((k) =>
      MUTABLE_FIELDS.includes(k),
    );

    if (fields.length === 0) {
      return this.findById(id, { includeFormer: true });
    }

    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => updates[f]);
    values.push(repoUtil.now());
    values.push(id);

    getDb()
      .prepare(
        `
            UPDATE team_members
            SET ${setClause}, updated_at = ?
            WHERE id = ?
        `,
      )
      .run(...values);

    return this.findById(id, { includeFormer: true });
  },

  /**
   * Marks a membership as left (soft-leave). The row persists so past content
   * stays attributable and the user can rejoin later. No-op if already left.
   * @param { number } id membership id
   * @returns {object | undefined} the left membership row | undefined if not found
   */
  leave(id) {
    const ts = repoUtil.now();
    getDb()
      .prepare(
        `
            UPDATE team_members
            SET left_at = ?,
                updated_at = ?
            WHERE id = ? AND left_at IS NULL
        `,
      )
      .run(ts, ts, id);

    return this.findById(id, { includeFormer: true });
  },

  /**
   * Reactivates a former membership by clearing left_at. Optionally updates the
   * display name on rejoin. No-op on left_at if the membership is already active.
   * @param { number } id membership id
   * @param {{ display_name?: string }} [opts] optional new display name for the rejoin
   * @returns {object | undefined} the rejoined membership row | undefined if not found
   */
  rejoin(id, { display_name } = {}) {
    const ts = repoUtil.now();

    if (display_name !== undefined) {
      getDb()
        .prepare(
          `
            UPDATE team_members
            SET left_at = NULL,
                display_name = ?,
                updated_at = ?
            WHERE id = ?
        `,
        )
        .run(display_name, ts, id);
    } else {
      getDb()
        .prepare(
          `
            UPDATE team_members
            SET left_at = NULL,
                updated_at = ?
            WHERE id = ?
        `,
        )
        .run(ts, id);
    }

    return this.findById(id);
  },

  /**
   * Unrevokably deletes a membership row. Related rows (standups) are cascade
   * deleted. **Team member deletions in practice should execute implicitly through the cascading
   * behavior of user deletion.**
   * @param { number } id membership id
   * @returns {boolean} true if row was deleted | false otherwise
   */
  hardDelete(id) {
    const result = getDb()
      .prepare('DELETE FROM team_members WHERE id = ?')
      .run(id);
    return result.changes > 0;
  },
};
