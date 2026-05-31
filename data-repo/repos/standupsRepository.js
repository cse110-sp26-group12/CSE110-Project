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

const MUTABLE_FIELDS = ['worked_on', 'will_work_on', 'blocked_by'];

export const standupRepo = {
  /**
   * Creates a new standup.
   * @param {{ posted_by: number, for_team: number, worked_on?: string|null, will_work_on?: string|null, blocked_by?: string|null, kill_after?: string|null }} data
   * @returns {object} created standup row
   */
  create({
    posted_by,
    for_team,
    worked_on = null,
    will_work_on = null,
    blocked_by = null,
    blocker_resolved = false,
    kill_after = null,
  }) {
    const ts = repoUtil.now();
    const result = getDb()
      .prepare(
        `
            INSERT INTO standups (posted_by, for_team, worked_on, will_work_on, blocked_by, blocker_resolved, created_at, updated_at, kill_after)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        posted_by,
        for_team,
        worked_on,
        will_work_on,
        blocked_by,
        blocker_resolved ? 1 : 0,
        ts,
        ts,
        kill_after,
      );

    return this.findById(Number(result.lastInsertRowid));
  },

  /**
   * Finds an existing standup by ID.
   * @param { number } id standup id
   * @returns {object | undefined } standup row if found | undefined otherwise
   */
  findById(id) {
    return getDb().prepare('SELECT * FROM standups WHERE id = ?').get(id);
  },

  /**
   * Lists standups for a team, newest first.
   * @param { number } teamId team id
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns {object[]}
   */
  listByTeam(teamId, { limit = 100, offset = 0 } = {}) {
    return getDb()
      .prepare(
        'SELECT * FROM standups WHERE for_team = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .all(teamId, limit, offset);
  },

  /**
   * Lists standups posted by a given membership, newest first.
   * @param { number } membershipId team_members.id of the poster
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns {object[]}
   */
  listByPoster(membershipId, { limit = 100, offset = 0 } = {}) {
    return getDb()
      .prepare(
        'SELECT * FROM standups WHERE posted_by = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .all(membershipId, limit, offset);
  },

  /**
   * Lists standups for a team created within an inclusive ISO timestamp range,
   * newest first. Useful for "today's standups" / date-bounded views.
   * @param { number } teamId team id
   * @param { string } startIso inclusive lower bound (ISO-8601)
   * @param { string } endIso inclusive upper bound (ISO-8601)
   * @returns {object[]}
   */
  listByTeamInRange(teamId, startIso, endIso) {
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
      .all(teamId, startIso, endIso);
  },

  /**
   * Lists a team's blocker standups (including resovled by default), newest first.
   * Resolved blockers are included by default so the UI can show them as resolved.
   * Each row carries blocker_resolved (0/1) for display logic.
   * @param { number } teamId team id
   * @param { bool } includeResolved include resolved blockers in the list
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   */
  listBlockersByTeam(
    teamId,
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
              ${resolvedClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `,
      )
      .all(teamId, limit, offset);
  },

  /**
   * Lists a team's blocker standups (including resolved by default), newest first.
   * Resolved blockers are included by default so the UI can show them as resolved.
   * Each row carries blocker_resolved (0/1) for display logic.
   * @param { number } membershipId team_members.id of the poster
   * @param { number } limit (default 100)
   * @param { number } offset (default 0)
   * @returns {object[]} standups with a populated blocked_by
   */
  listBlockersByPoster(
    membershipId,
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
              ${resolvedClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `,
      )
      .all(membershipId, limit, offset);
  },

  /**
   * Counts standups for a team.
   * @param { number } teamId team id
   * @returns { number } count of standups
   */
  countByTeam(teamId) {
    const row = getDb()
      .prepare('SELECT COUNT(*) AS n FROM standups WHERE for_team = ?')
      .get(teamId);
    return row.n;
  },

  /**
   * Counts active blockers for a team. A standup is a "blocker" when blocked_by is a non-empty string.
   * @param { number } teamId team id
   * @returns { number } count of standups with a populated and unresolved blocked_by
   */
  countActiveBlockersByTeam(teamId) {
    const row = getDb()
      .prepare(
        `
            SELECT COUNT(*) AS n FROM standups
            WHERE for_team = ?
              AND blocked_by IS NOT NULL
              AND blocked_by != ''
              AND blocker_resolved = 0
        `,
      )
      .get(teamId);
    return row.n;
  },

  /**
   * Updates mutable standup content fields. Updates updated_at.
   *  Ignores non-whitelisted keys. If no valid keys are given, the unmodified row is returned.
   *  Note: a key present with a null value IS applied (e.g. clearing blocked_by).
   * @param { number } id standup id
   * @param { object } updates subset of { worked_on, will_work_on, blocked_by }; all other keys are ignored
   * @returns {object | undefined} updated row | undefined if not found
   */
  update(id, updates) {
    const fields = Object.keys(updates).filter((k) =>
      MUTABLE_FIELDS.includes(k),
    );

    if (fields.length === 0) {
      return this.findById(id);
    }

    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => updates[f]);
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

    return this.findById(id);
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
        `,
      )
      .run(repoUtil.now(), id);

    return this.findById(id);
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

    return this.findById(id);
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

    return this.findById(id);
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
    return getDb()
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
