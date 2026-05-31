// repositories/sessions/sessionRepo.js
import { getDb } from '../../database/connection.js';
import { repoUtil } from '../_util.js';

/**
 * Pure CRUD for the user_sessions table
 *
 * - All methods take simple arguments or plain objects
 * - All reads return plain objects, an array of plain object, or undefined
 * - No logic, authorization, or cross-table operations
 * - Returns are in the form of persisted rows with database-assigned fields
 *
 * NOTE: Sessions have two independent "not usable" conditions:
 *   - revoked   (revoked_at IS NOT NULL)  — explicit logout / invalidation
 *   - expired   (expires_at <= now)       — natural lifetime lapse
 * A session is VALID only when it is neither revoked nor expired. Most reads
 * filter on validity; the token, expiry, and revocation timestamps are supplied
 * by the service layer (the repo does not generate tokens or compute lifetimes).
 */

export const sessionRepo = {
  /**
   * Creates a new session.
   * @param {{ token: string, user_id: number, expires_at: string, user_agent?: string|null, ip_address?: string|null }} data
   * @returns {object} created session row
   */
  create({ token, user_id, expires_at, user_agent = null, ip_address = null }) {
    const ts = repoUtil.now();
    const result = getDb()
      .prepare(
        `
            INSERT INTO user_sessions (token, user_id, created_at, expires_at, user_agent, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(token, user_id, ts, expires_at, user_agent, ip_address);

    return this.findById(Number(result.lastInsertRowid));
  },

  /**
   * Finds a session by ID, regardless of revoked/expired state.
   * @param { number } id session id
   * @returns {object | undefined } session row if found | undefined otherwise
   */
  findById(id) {
    return getDb().prepare('SELECT * FROM user_sessions WHERE id = ?').get(id);
  },

  /**
   * Finds a session by its opaque token, regardless of revoked/expired state.
   * Returns the raw row even if revoked or expired.
   * @param { string } token session token
   * @returns {object | undefined } session row if found | undefined otherwise
   */
  findByToken(token) {
    return getDb()
      .prepare('SELECT * FROM user_sessions WHERE token = ?')
      .get(token);
  },

  /**
   * Finds a session by token ONLY if it is currently valid—neither revoked
   * nor expired. Returns raw row.
   * @param { string } token session token
   * @returns {object | undefined } valid session row | undefined if absent/revoked/expired
   */
  findValidByToken(token) {
    return getDb()
      .prepare(
        `
            SELECT * FROM user_sessions
            WHERE token = ?
              AND revoked_at IS NULL
              AND expires_at > ?
        `,
      )
      .get(token, repoUtil.now());
  },

  /**
   * Lists a user's sessions, newest first.
   * @param { number } userId user id
   * @param { boolean } onlyValid when true, return only currently-valid sessions (default false)
   * @returns {object[]}
   */
  listByUser(userId, { onlyValid = false } = {}) {
    if (onlyValid) {
      return getDb()
        .prepare(
          `
            SELECT * FROM user_sessions
            WHERE user_id = ?
              AND revoked_at IS NULL
              AND expires_at > ?
            ORDER BY created_at DESC
        `,
        )
        .all(userId, repoUtil.now());
    }
    return getDb()
      .prepare(
        'SELECT * FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC',
      )
      .all(userId);
  },

  /**
   * Counts a user's currently-valid sessions.
   * @param { number } userId user id
   * @returns { number } count of valid sessions
   */
  countValidByUser(userId) {
    const row = getDb()
      .prepare(
        `
            SELECT COUNT(*) AS n FROM user_sessions
            WHERE user_id = ?
              AND revoked_at IS NULL
              AND expires_at > ?
        `,
      )
      .get(userId, repoUtil.now());
    return row.n;
  },

  /**
   * Revokes a single session by id (e.g. explicit logout). No-op if already
   * revoked, preserving the original revocation timestamp.
   * @param { number } id session id
   * @returns {object | undefined} the revoked session row | undefined if not found
   */
  revoke(id) {
    getDb()
      .prepare(
        `
            UPDATE user_sessions
            SET revoked_at = ?
            WHERE id = ? AND revoked_at IS NULL
        `,
      )
      .run(repoUtil.now(), id);

    return this.findById(id);
  },

  /**
   * Revokes a single session by its token (logout when the caller only holds
   * the token, not the id). No-op if already revoked.
   * @param { string } token session token
   * @returns {object | undefined} the revoked session row | undefined if not found
   */
  revokeByToken(token) {
    getDb()
      .prepare(
        `
            UPDATE user_sessions
            SET revoked_at = ?
            WHERE token = ? AND revoked_at IS NULL
        `,
      )
      .run(repoUtil.now(), token);

    return this.findByToken(token);
  },

  /**
   * Revokes ALL currently-valid sessions for a user (e.g. "log out everywhere",
   * or forced invalidation on password change). Already-revoked sessions are
   * left untouched so their original timestamps are preserved.
   * @param { number } userId user id
   * @returns { number } count of sessions revoked by this call
   */
  revokeAllForUser(userId) {
    const result = getDb()
      .prepare(
        `
            UPDATE user_sessions
            SET revoked_at = ?
            WHERE user_id = ? AND revoked_at IS NULL
        `,
      )
      .run(repoUtil.now(), userId);
    return result.changes;
  },

  /**
   * Hard-deletes a single session row. Sessions have no soft-delete; revocation
   * is the "soft" state, and deletion is purely for cleanup.
   * @param { number } id session id
   * @returns {boolean} true if row was deleted | false otherwise
   */
  hardDelete(id) {
    const result = getDb()
      .prepare('DELETE FROM user_sessions WHERE id = ?')
      .run(id);
    return result.changes > 0;
  },

  /**
   * Bulk-deletes sessions that are no longer usable—expired OR revoked—in a
   * single statement. Returns the number removed.
   * @returns { number } count of deleted sessions
   */
  purgeDeadSessions() {
    const now = repoUtil.now();
    const result = getDb()
      .prepare(
        `
            DELETE FROM user_sessions
            WHERE revoked_at IS NOT NULL
               OR expires_at <= ?
        `,
      )
      .run(now);
    return result.changes;
  },
};
