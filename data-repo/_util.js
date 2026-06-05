export const repoUtil = {
  /** Returns current time as an ISO-8601 UTC string. */
  now() {
    return new Date().toISOString();
  },

  /** Returns true if a string is null or empty, false otherwise.
   * @param { string } text
   */
  isNullStr(str) {
    return str === null || str === '';
  },

  /**
   * Handles any outgoing hard logic conditions for standup rows immediately before return to service layer.
   * Wrap **ALL** standup row returns that are intended for client viewing.
   * @param { object } row standup row
   * @returns export-ready row
   */
  exportStandup(row) {
    if (row === undefined) return row;

    if (!this.isNullStr(row.blocked_by) && row.blocker_resolved === 0)
      row.status_flag = 'Blocked'; //Blocker overrides status flag

    return row;
  },
};
