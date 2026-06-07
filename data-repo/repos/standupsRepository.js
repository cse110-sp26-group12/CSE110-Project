// repositories/standups/standupRepo.js
import { getDb } from '../../database/connection.js';
import { repoUtil } from '../_util.js';

/**
 * Pure CRUD for the standups table
 *
 * - All methods take simple arguments or plain objects
 * - All reads return plain objects, an array of plain object, or undefined
 * - No logic, authorization, or cross-table operations
 * - Returns are in the form of persisted rows with database-assigned fields
 *
 * NOTE: Standups have no soft-delete state. They use a `kill_after` retention
 * timestamp (derived by the service layer from the parent team's
 * standup_retention_days) and are removed by the scheduled purge job or by
 * cascade when the parent team or posting membership is hard-deleted. There is
 * therefore no deleted_at/left_at filtering — every stored standup is "live"
 * until it is hard-deleted.
 */

const MUTABLE_FIELDS = [
  'worked_on',
  'will_work_on',
  'blocked_by',
  'status_flag',
];
const STATUS_FLAGS = ['In progress', 'On track'];

export const standupRepo = {
  /**
   * Creates a new standup.
   * @param {{ posted_by: number, for_team: number, worked_on?: string|null, will_work_on?: string|null, blocked_by?: string|null, status_flag?: string|null, kill_after?: string|null }} data
   * @returns {object} created standup row
   */
  create({
    posted_by,
    for_team,
    worked_on = null,
    will_work_on = null,
    blocked_by = null,
    status_flag = 'In progress',
    kill_after = null,
  }) {
    if (!STATUS_FLAGS.includes(status_flag)) {
      throw new Error(
        `Invalid status_flag insertion: ${status_flag}. Must be one of: ${STATUS_FLAGS.join(', ')}`,
      );
    }
    const ts = repoUtil.now();
    const blocker_resolved = 0; //implicitly false on creation
    const result = getDb()
      .prepare(
        `
            INSERT INTO standups (posted_by, for_team, worked_on, will_work_on, blocked_by, blocker_resolved, status_flag, created_at, updated_at, kill_after)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        posted_by,
        for_team,
        worked_on,
        will_work_on,
        blocked_by,
        blocker_resolved,
        status_flag,
        ts,
        ts,
        kill_after,
      );

    const row = this.findById(Number(result.lastInsertRowid));
    return repoUtil.exportStandup(row);
  },

  /**
   * Finds an existing standup by ID.
   * @param { number } id standup id
   * @returns {object | undefined } standup row if found | undefined otherwise
   */
  findById(id) {
    const row = getDb().prepare('SELECT * FROM standups WHERE id = ?').get(id);
    return repoUtil.exportStandup(row);
  },

  /**
   * Lists standups for a team, newest first.
   * @param { number } teamId team id
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns {object[]}
   */
  listByTeam(team_id, { limit = 100, offset = 0 } = {}) {
    return getDb()
      .prepare(
        'SELECT * FROM standups WHERE for_team = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .all(team_id, limit, offset)
      .map((r) => repoUtil.exportStandup(r));
  },

  /**
   * Lists standups posted by a given membership, newest first.
   * @param { number } membershipId team_members.id of the poster
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns {object[]}
   */
  listByPoster(member_id, { limit = 100, offset = 0 } = {}) {
    return getDb()
      .prepare(
        'SELECT * FROM standups WHERE posted_by = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .all(member_id, limit, offset)
      .map((r) => repoUtil.exportStandup(r));
  },

  /**
   * Lists standups for a team created within an inclusive ISO timestamp range,
   * newest first. Useful for "today's standups" / date-bounded views.
   * @param { number } team_id
   * @param { string } startIso inclusive lower bound (ISO-8601)
   * @param { string } endIso inclusive upper bound (ISO-8601)
   * @returns {object[]} list of standups within the given timeframe
   */
  listByTeamInRange(team_id, start_iso, end_iso) {
    return getDb()
      .prepare(
        `
            SELECT * FROM standups
            WHERE for_team = ?
              AND created_at >= ?
              AND created_at <= ?
            ORDER BY created_at DESC
        `,
      )
      .all(team_id, start_iso, end_iso)
      .map((r) => repoUtil.exportStandup(r));
  },

  /**
   * Lists a team's blocker standups (including resovled by default), newest first.
   * Resolved blockers are included by default so the UI can show them as resolved.
   * Each row carries blocker_resolved (0/1) for display logic.
   * @param { number } team_id
   * @param { bool } includeResolved include resolved blockers in the list
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns { object[] } list of blocked standups
   */
  listBlockersByTeam(
    team_id,
    { includeResolved = true, limit = 100, offset = 0 } = {},
  ) {
    const resolvedClause = includeResolved ? '' : 'AND blocker_resolved = 0';
    return getDb()
      .prepare(
        `
            SELECT * FROM standups
            WHERE for_team = ?
              AND blocked_by IS NOT NULL
              AND blocked_by != ''
              AND blocked_by != 'none'
              ${resolvedClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `,
      )
      .all(team_id, limit, offset)
      .map((r) => repoUtil.exportStandup(r));
  },

  /**
   * Lists a member's blocker standups (including resolved by default), newest first.
   * Resolved blockers are included by default so the UI can show them as resolved.
   * Each row carries blocker_resolved (0/1) for display logic.
   * @param { number } member_id
   * @param { bool } includeResolved include resolved blockers in the list
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns {object[]} standups with a populated blocked_by
   */
  listBlockersByPoster(
    member_id,
    { includeResolved = true, limit = 100, offset = 0 } = {},
  ) {
    const resolvedClause = includeResolved ? '' : 'AND blocker_resolved = 0';
    return getDb()
      .prepare(
        `
            SELECT * FROM standups
            WHERE posted_by = ?
              AND blocked_by IS NOT NULL
              AND blocked_by != ''
              AND blocked_by != 'none'
              ${resolvedClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `,
      )
      .all(member_id, limit, offset)
      .map((r) => repoUtil.exportStandup(r));
  },

  /**
   * Lists a team's non-blocked standups of a given status, newest first.
   * @param { number } team_id
   * @param { bool } status_flag
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns { object[] } list of non-blocked standups of a given status
   */
  listStatusByTeam(team_id, status_flag, { limit = 100, offset = 0 } = {}) {
    return getDb()
      .prepare(
        `
            SELECT * FROM standups
            WHERE for_team = ?
              AND status_flag = ? 
              AND (blocked_by IS NULL OR blocked_by = '' OR blocker_resolved = 1)
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `,
      )
      .all(team_id, status_flag, limit, offset)
      .map((r) => repoUtil.exportStandup(r));
  },

  /**
   * Lists a member's non-blocked standups of a given status, newest first.
   * @param { number } member_id
   * @param { bool } status_flag
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns { object[] } list of non-blocked standups of given status
   */
  listStatusByPoster(member_id, status_flag, { limit = 100, offset = 0 } = {}) {
    return getDb()
      .prepare(
        `
            SELECT * FROM standups
            WHERE posted_by = ?
              AND status_flag = ? 
              AND (blocked_by IS NULL OR blocked_by = '' OR blocker_resolved = 1)
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `,
      )
      .all(member_id, status_flag, limit, offset)
      .map((r) => repoUtil.exportStandup(r));
  },

  /**
   * Counts standups for a team.
   * @param { number } team_id
   * @returns { number } count of standups
   */
  countByTeam(team_id) {
    const row = getDb()
      .prepare('SELECT COUNT(*) AS n FROM standups WHERE for_team = ?')
      .get(team_id);
    return row.n;
  },

  /**
   * Counts active blockers for a team. A standup is a "blocker" when blocked_by is a non-empty string.
   * @param { number } team_id
   * @param { string } status_flag
   * @returns { number } count of standups with a populated and unresolved blocked_by
   */
  countActiveBlockersByTeam(team_id) {
    const row = getDb()
      .prepare(
        `
            SELECT COUNT(*) AS n FROM standups
            WHERE for_team = ?
              AND blocked_by IS NOT NULL
              AND blocked_by != ''
              AND blocked_by != 'none'
              AND blocker_resolved = 0
        `,
      )
      .get(team_id);
    return row.n;
  },

  /**
   * Counts the number of non-blocker standups that fall under the given status flag.
   * @param {*} team_id
   * @param {*} status_flag
   * @returns { number} count of non-blocked standups of the given status
   */
  countStatusByTeam(team_id, status_flag) {
    if (!STATUS_FLAGS.includes(status_flag)) {
      throw new Error(
        `Invalid status_flag request: ${status_flag}. Must be one of: ${STATUS_FLAGS.join(', ')}`,
      );
    }

    const row = getDb()
      .prepare(
        `
            SELECT COUNT(*) AS n FROM standups
            WHERE for_team = ?
              AND status_flag = ?
              AND (blocked_by IS NULL OR blocked_by = '' OR blocker_resolved = 1)
        `,
      )
      .get(team_id, status_flag);
    return row.n;
  },

  /**
   * Updates mutable standup content fields. Updates updated_at.
   *  Ignores non-whitelisted keys. If no valid keys are given, the unmodified row is returned.
   *  Note: a key present with a null value IS applied (e.g. clearing blocked_by). Clearing blocked_by vacuously resolves any attached blocker.
   * @param { number } id standup id
   * @param { object } updates subset of { worked_on, will_work_on, blocked_by, status_flag (`"In progress"` OR `"On track"`) }; all other keys are ignored
   * @returns {object | undefined} updated row | undefined if not found
   */
  update(id, updates) {
    const updateStatus = Object.prototype.hasOwnProperty.call(
      updates,
      'status_flag',
    );
    const updateBlocker = Object.prototype.hasOwnProperty.call(
      updates,
      'blocked_by',
    );

    if (updateStatus && !STATUS_FLAGS.includes(updates.status_flag)) {
      throw new Error(
        `Invalid status_flag: ${updates.status_flag}. Must be one of: ${STATUS_FLAGS.join(', ')}`,
      );
    }

    const fields = Object.keys(updates).filter((k) =>
      MUTABLE_FIELDS.includes(k),
    );

    if (fields.length === 0) {
      const row = this.findById(id);
      return repoUtil.exportStandup(row);
    }

    let setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => updates[f]);

    if (updateBlocker) {
      const oldRow = this.findById(id);
      if (
        !repoUtil.isBlocker(updates.blocked_by) &&
        oldRow.blocker_resolved === 1
      ) {
        setClause += ', blocker_resolved = 0'; //empty blocker resolution is vacuous
      }
    }

    values.push(repoUtil.now());
    values.push(id);

    getDb()
      .prepare(
        `
            UPDATE standups
            SET ${setClause}, updated_at = ?
            WHERE id = ?
        `,
      )
      .run(...values);

    const row = this.findById(id);
    return repoUtil.exportStandup(row);
  },

  /**
   * Marks a standup's blocker as resolved. The blocker content is preserved so
   * it can still be displayed (e.g. crossed out). No-op if the standup has no
   * blocker, since "resolved" is only meaningful with blocker content present.
   * @param { number } id standup id
   * @returns {object | undefined} updated row | undefined if not found
   */
  resolveBlocker(id) {
    getDb()
      .prepare(
        `
            UPDATE standups
            SET blocker_resolved = 1, updated_at = ?
            WHERE id = ?
              AND blocked_by IS NOT NULL
              AND blocked_by != ''
              AND blocked_by != 'none'
        `,
      )
      .run(repoUtil.now(), id);

    const row = this.findById(id);

    return repoUtil.exportStandup(row);
  },

  /**
   * Reverts a blocker to unresolved (e.g. it turned out not to be fixed).
   * @param { number } id standup id
   * @returns {object | undefined} updated row | undefined if not found
   */
  unresolveBlocker(id) {
    getDb()
      .prepare(
        `
            UPDATE standups
            SET blocker_resolved = 0, updated_at = ?
            WHERE id = ?
        `,
      )
      .run(repoUtil.now(), id);

    const row = this.findById(id);

    return repoUtil.exportStandup(row);
  },

  /**
   * Sets or clears the retention deadline for a single standup. The service
   * layer supplies the value (derived from the team's standup_retention_days),
   * or null to mark the standup as never-expiring.
   * @param { number } id standup id
   * @param { string | null } killAfter ISO-8601 timestamp string, or null to clear
   * @returns {object | undefined} updated row | undefined if not found
   */
  setKillAfter(id, killAfter) {
    getDb()
      .prepare(
        `
            UPDATE standups
            SET kill_after = ?, updated_at = ?
            WHERE id = ?
        `,
      )
      .run(killAfter, repoUtil.now(), id);

    const row = this.findById(id);

    return repoUtil.exportStandup(row);
  },

  /**
   * Hard-deletes a standup. There is no soft-delete for standups.
   * @param { number } id standup id
   * @returns {boolean} true if row was deleted | false otherwise
   */
  hardDelete(id) {
    const result = getDb().prepare('DELETE FROM standups WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Returns standups whose retention deadline has passed — for the scheduled
   * purge job. Standups with a null kill_after never expire.
   * @returns {object[]} standups due for deletion
   */
  listExpiredStandups() {
    return getDb() //these are not intended for client viewing, so no export wrapper is needed
      .prepare(
        `
            SELECT * FROM standups
            WHERE kill_after IS NOT NULL
              AND kill_after < ?
        `,
      )
      .all(repoUtil.now());
  },

  /**
   * Bulk-deletes standups whose retention deadline has passed, in a single
   * statement. Convenience for the purge job when the individual rows aren't
   * needed. Returns the number of rows removed.
   * @returns { number } count of deleted standups
   */
  purgeExpiredStandups() {
    const result = getDb()
      .prepare(
        'DELETE FROM standups WHERE kill_after IS NOT NULL AND kill_after < ?',
      )
      .run(repoUtil.now());
    return result.changes;
  },
};
