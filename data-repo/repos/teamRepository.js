import { getDb } from '../../database/connection.js';
import { repoUtil } from '../_util.js';

/**
 * Pure CRUD for the teams table
 *
 * - All methods take simple arguments or plain objects
 * - All reads return plain objects, an array of plain object, or undefined
 * - No logic, authorization, or cross-table operations
 * - Soft-deleted rows excluded by default; overridden by includeDeleted
 * - Returns are in the form of persisted rows with database-assigned fields
 */

const MUTABLE_FIELDS = ['team_name', 'owned_by', 'standup_retention_days'];

export const teamRepo = {
  /**
   * Creates a new team.
   * @param {{ team_name: string, invite_code: string, owned_by: number, standup_retention_days?: number }} data
   * @returns {object} created team row
   */
  create({ team_name, invite_code, owned_by, standup_retention_days = null }) {
    const ts = repoUtil.now();
    const result = getDb()
      .prepare(
        `
            INSERT INTO teams (team_name, invite_code, owned_by, standup_retention_days, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(team_name, invite_code, owned_by, standup_retention_days, ts, ts);

    return this.findById(Number(result.lastInsertRowid));
  },

  /**
   * Finds an existing team by ID.
   * @param { number } id team id
   * @param { boolean } includeDeleted include soft-deleted rows in search (default false)
   * @returns {object | undefined } team row if found | undefined otherwise
   */
  findById(id, { includeDeleted = false } = {}) {
    const sql = includeDeleted
      ? 'SELECT * FROM teams WHERE id = ?'
      : 'SELECT * FROM teams WHERE id = ? AND deleted_at IS NULL';
    return getDb().prepare(sql).get(id);
  },

  /**
   * Finds an existing team by its unique invite code.
   * @param { string } invite_code team invite code
   * @param { boolean } includeDeleted include soft-deleted rows in search (default false)
   * @returns {object | undefined } team row if found | undefined otherwise
   */
  findByInviteCode(invite_code, { includeDeleted = false } = {}) {
    const sql = includeDeleted
      ? 'SELECT * FROM teams WHERE invite_code = ?'
      : 'SELECT * FROM teams WHERE invite_code = ? AND deleted_at IS NULL';
    return getDb().prepare(sql).get(invite_code);
  },

  /**
   * List teams owned by a given user, newest first.
   * @param { number } owner_id user id of the team owner
   * @param { boolean } includeDeleted include soft-deleted rows in search (default false)
   * @returns {object[]}
   */
  listByOwner(owner_id, { includeDeleted = false } = {}) {
    const sql = includeDeleted
      ? 'SELECT * FROM teams WHERE owned_by = ? ORDER BY created_at DESC'
      : 'SELECT * FROM teams WHERE owned_by = ? AND deleted_at IS NULL ORDER BY created_at DESC';
    return getDb().prepare(sql).all(owner_id);
  },

  /**
   * List teams, newest first.
   * @param { boolean } includeDeleted include soft-deleted rows in search (default false)
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns {object[]}
   */
  list({ includeDeleted = false, limit = 100, offset = 0 } = {}) {
    const sql = includeDeleted
      ? 'SELECT * FROM teams ORDER BY created_at DESC LIMIT ? OFFSET ?'
      : 'SELECT * FROM teams WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?';
    return getDb().prepare(sql).all(limit, offset);
  },

  /**
   * Checks existence of a team by its unique invite code.
   * @param { string } invite_code team invite code
   * @returns { boolean } true if team exists | false otherwise
   */
  existsByInviteCode(invite_code) {
    const row = getDb()
      .prepare('SELECT 1 FROM teams WHERE invite_code = ? LIMIT 1')
      .get(invite_code);
    return row !== undefined;
  },

  /**
   * Counts active (non-soft-deleted) teams owned by a given user. Useful for the
   * service layer to enforce the "resolve owned teams before account deletion" policy.
   * @param { number } owner_id user id of the team owner
   * @returns { number } count of active owned teams
   */
  countActiveByOwner(owner_id) {
    const row = getDb()
      .prepare(
        'SELECT COUNT(*) AS n FROM teams WHERE owned_by = ? AND deleted_at IS NULL',
      )
      .get(owner_id);
    return row.n;
  },

  /**
   * Updates any mutable team fields, including for soft-deleted teams. Updates updated_at.
   *  Ignores non-whitelisted keys. If no valid keys are given, the unmodified row is returned.
   * @param { number } id team id
   * @param { object } updates subset of { team_name, owned_by, standup_retention_days }; all other keys are ignored
   * @returns {object | undefined} updated row | undefined if not found
   */
  update(id, updates) {
    const fields = Object.keys(updates).filter((k) =>
      MUTABLE_FIELDS.includes(k),
    );

    if (fields.length === 0) {
      return this.findById(id, { includeDeleted: true });
    }

    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => updates[f]);
    values.push(repoUtil.now());
    values.push(id);

    getDb()
      .prepare(
        `
            UPDATE teams
            SET ${setClause}, updated_at = ?
            WHERE id = ?
        `,
      )
      .run(...values);

    return this.findById(id, { includeDeleted: true });
  },

  /**
   * Rotates a team's invite code. Separated from update() because invite_code is
   * unique and security-relevant; service layer supplies the new code.
   * @param { number } id team id
   * @param { string } newInviteCode the replacement invite code
   * @returns {object | undefined} updated row | undefined if not found
   */
  rotateInviteCode(id, new_invite_code) {
    getDb()
      .prepare(
        `
            UPDATE teams
            SET invite_code = ?, updated_at = ?
            WHERE id = ?
        `,
      )
      .run(new_invite_code, repoUtil.now(), id);

    return this.findById(id, { includeDeleted: true });
  },

  /**
   * Deactivate a team and schedule hard-deletion after killAfter. Rows related to the team are unaffected.
   * @param {number} id team id
   * @param {string} kill_after ISO-8601 timestamp string
   * @returns {object | undefined } the soft-deleted row | undefined if not found
   */
  softDelete(id, kill_after) {
    const ts = repoUtil.now();
    getDb()
      .prepare(
        `
            UPDATE teams
            SET deleted_at = ?,
                kill_after = ?,
                updated_at = ?
            WHERE id = ? AND deleted_at IS NULL
        `,
      )
      .run(ts, kill_after, ts, id);

    return this.findById(id, { includeDeleted: true });
  },

  /**
   * Restore a deactivated team and clear the scheduled deletion.
   * @param {number} id team id
   * @returns {object | undefined } the restored row | undefined if not found
   */
  restore(id) {
    getDb()
      .prepare(
        `
            UPDATE teams
            SET deleted_at = NULL,
                kill_after = NULL,
                updated_at = ?
            WHERE id = ?
        `,
      )
      .run(repoUtil.now(), id);

    return this.findById(id);
  },

  /**
   * Unrevokably deletes a team. Related rows (memberships, standups) are also cascade deleted.
   * @param {number} id team id
   * @returns {boolean} true if row was deleted | false otherwise
   */
  hardDelete(id) {
    const result = getDb().prepare('DELETE FROM teams WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Returns a list of deactivated teams who are due for hard deletion.
   * @returns {object[]} teams to delete
   */
  listExpiredTeams() {
    return getDb()
      .prepare(
        `
            SELECT * FROM teams
            WHERE kill_after IS NOT NULL
                AND kill_after < ?
        `,
      )
      .all(repoUtil.now());
  },
};
