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
   * @param {{ token_hash: string, user_id: number, expires_at: string, user_agent?: string|null, ip_address?: string|null }} data
   * @returns {object} created session row
   */
  create({
    token_hash,
    user_id,
    expires_at,
    user_agent = null,
    ip_address = null,
  }) {
    const ts = repoUtil.now();
    const result = getDb()
      .prepare(
        `
            INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at, user_agent, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(token_hash, user_id, ts, expires_at, user_agent, ip_address);

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
   * @param { string } token_hash session token
   * @returns {object | undefined } session row if found | undefined otherwise
   */
  findByTokenHash(token_hash) {
    return getDb()
      .prepare('SELECT * FROM user_sessions WHERE token_hash = ?')
      .get(token_hash);
  },

  /**
   * Finds a session by token hash ONLY if it is currently valid—neither revoked
   * nor expired. Returns raw row.
   * @param { string } token_hash session token hash
   * @returns {object | undefined } valid session row | undefined if absent/revoked/expired
   */
  findValidByToken(token_hash) {
    return getDb()
      .prepare(
        `
            SELECT * FROM user_sessions
            WHERE token_hash = ?
              AND revoked_at IS NULL
              AND expires_at > ?
        `,
      )
      .get(token_hash, repoUtil.now());
  },

  /**
   * Lists a user's sessions, newest first.
   * @param { number } user_id
   * @param { boolean } onlyValid when true, return only currently-valid sessions (default false)
   * @returns {object[]}
   */
  listByUser(user_id, { onlyValid = false } = {}) {
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
        .all(user_id, repoUtil.now());
    }
    return getDb()
      .prepare(
        'SELECT * FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC',
      )
      .all(user_id);
  },

  /**
   * Counts a user's currently-valid sessions.
   * @param { number } user_id
   * @returns { number } count of valid sessions
   */
  countValidByUser(user_id) {
    const row = getDb()
      .prepare(
        `
            SELECT COUNT(*) AS n FROM user_sessions
            WHERE user_id = ?
              AND revoked_at IS NULL
              AND expires_at > ?
        `,
      )
      .get(user_id, repoUtil.now());
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
   * Revokes a single session by its token hash (logout when the caller only holds
   * the token, not the id). No-op if already revoked.
   * @param { string } token_hash session token hash
   * @returns {object | undefined} the revoked session row | undefined if not found
   */
  revokeByToken(token_hash) {
    getDb()
      .prepare(
        `
            UPDATE user_sessions
            SET revoked_at = ?
            WHERE token_hash = ? AND revoked_at IS NULL
        `,
      )
      .run(repoUtil.now(), token_hash);

    return this.findByTokenHash(token_hash);
  },

  /**
   * Revokes ALL currently-valid sessions for a user (e.g. "log out everywhere",
   * or forced invalidation on password change). Already-revoked sessions are
   * left untouched so their original timestamps are preserved.
   * @param { number } user_id
   * @returns { number } count of sessions revoked by this call
   */
  revokeAllForUser(user_id) {
    const result = getDb()
      .prepare(
        `
            UPDATE user_sessions
            SET revoked_at = ?
            WHERE user_id = ? AND revoked_at IS NULL
        `,
      )
      .run(repoUtil.now(), user_id);
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
