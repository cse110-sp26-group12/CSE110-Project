import { getDb } from '../../database/connection.js';
import { repoUtil } from '../_util.js';

/**
 * Pure CRUD for the users table
 *
 * - All methods take simple arguments or plain objects
 * - All reads return plain objects, an array of plain object, or undefined
 * - No logic, authorization, or cross-table operations
 * - Soft-deleted rows excluded by default; overridden by includeDeleted
 * - Returns are in the form of persisted rows with database-assigned fields
 */

const MUTABLE_FIELDS = ['user_name', 'user_email', 'pass_hash'];

export const userRepo = {
  /**
   * Creates a new user.
   * @param {{ user_name: string, user_email: string, pass_hash: string }} data
   * @returns {object} created user row
   */
  create({ user_name, user_email, pass_hash }) {
    const ts = repoUtil.now();
    const result = getDb()
      .prepare(
        `
            INSERT INTO users (user_name, user_email, pass_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(user_name, user_email, pass_hash, ts, ts);

    return this.findById(Number(result.lastInsertRowid));
  },

  /**
   * Finds an existing user by ID.
   * @param { number } id user id
   * @param { boolean } includeDeleted include soft-deleted rows in search (default false)
   * @returns {object | undefined } user row if found | undefined otherwise
   */
  findById(id, { includeDeleted = false } = {}) {
    const sql = includeDeleted
      ? 'SELECT * FROM users WHERE id = ?'
      : 'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL';
    return getDb().prepare(sql).get(id);
  },

  /**
   * Finds an existing user by case-insensitive username.
   * @param { string } username (case-insensitive)
   * @param { boolean } includeDeleted include soft-deleted rows in search (default false)
   * @returns {object | undefined } user row if found | undefined otherwise
   */
  findByUsername(username, { includeDeleted = false } = {}) {
    const sql = includeDeleted
      ? 'SELECT * FROM users WHERE user_name = ?'
      : 'SELECT * FROM users WHERE user_name = ? AND deleted_at IS NULL';
    return getDb().prepare(sql).get(username);
  },

  /**
   * Finds an existing user by case-insensitive email.
   * @param { string } email (case-insensitive)
   * @param { boolean } includeDeleted include soft-deleted rows in search (default false)
   * @returns {object | undefined } user row if found | undefined otherwise
   */
  findByEmail(email, { includeDeleted = false } = {}) {
    const sql = includeDeleted
      ? 'SELECT * FROM users WHERE user_email = ?'
      : 'SELECT * FROM users WHERE user_email = ? AND deleted_at IS NULL';
    return getDb().prepare(sql).get(email);
  },

  /**
   * List users, newest first.
   * @param { boolean } includeDeleted include soft-deleted rows in search (default false)
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns {object[]}
   */
  list({ includeDeleted = false, limit = 100, offset = 0 } = {}) {
    const sql = includeDeleted
      ? 'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?'
      : 'SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?';
    return getDb().prepare(sql).all(limit, offset);
  },

  /**
   * Checks existence of a user by a case-insensitive username.
   * @param { string } username (case-insensitive)
   * @returns { boolean } true if user exists | false otherwise
   */
  existsByUsername(username) {
    const row = getDb()
      .prepare('SELECT 1 FROM users WHERE user_name = ? LIMIT 1')
      .get(username);
    return row !== undefined;
  },

  /**
   * Checks existence of a user by a case-insensitive username.
   * @param { string } username (case-insensitive)
   * @returns { boolean } true if user exists | false otherwise
   */
  existsByEmail(email) {
    const row = getDb()
      .prepare('SELECT 1 FROM users WHERE user_email = ? LIMIT 1')
      .get(email);
    return row !== undefined;
  },

  /**
   * Updates any mutable user fields, including for soft-deleted users. Updates updated_at.
   *  Ignores non-whitelisted keys. If no valid keys are given, the unmodified row is returned.
   * @param { number } id user id
   * @param { object } updates subset of { user_name, user_email, pass_hash }; all other keys are ignored
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
            UPDATE users
            SET ${setClause}, updated_at = ?
            WHERE id = ?    
        `,
      )
      .run(...values);

    return this.findById(id, { includeDeleted: true });
  },

  /**
   * Deactivate user and schedule hard-deletion after killAfter. Rows related to the user are unaffected.
   * @param {number} id user id
   * @param {string} killAfter ISO-8601 timestamp string
   * @returns {object | undefined } the soft-deleted row | undefined if not found
   */
  softDelete(id, killAfter) {
    const ts = repoUtil.now();
    getDb()
      .prepare(
        `
            UPDATE users
            SET deleted_at = ?,
                kill_after = ?,
                updated_at = ?
            WHERE id = ? AND deleted_at IS NULL
        `,
      )
      .run(ts, killAfter, ts, id);

    return this.findById(id, { includeDeleted: true });
  },

  /**
   * Restore a deactivated user and clear the scheduled deletion.
   * @param {number} id user id
   * @returns {object | undefined } the restored row | undefined if not found
   */
  restore(id) {
    getDb()
      .prepare(
        `
            UPDATE users
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
   * Unrevokably deletes a user. Related rows are also cascade deleted. Fails if the user is still a team owner.
   * @param {number} id user id
   * @returns {boolean} true if row was deleted | false otherwise
   */
  hardDelete(id) {
    const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Returns a list of deactivated users who are due for hard deletion.
   * @returns {object[]} users to delete
   */
  listExpiredUsers() {
    return getDb()
      .prepare(
        `
            SELECT * FROM users
            WHERE kill_after IS NOT NULL
                AND kill_after < ?
        `,
      )
      .all(repoUtil.now());
  },
};
