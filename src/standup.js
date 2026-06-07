/**
 * Creates a standup entry object for a team member's daily agile standup.
 *
 * @param {string} name - The name of the team member submitting the standup.
 * @param {string} done - What the team member completed yesterday.
 * @param {string} todo - What the team member plans to do today.
 * @param {string} blockers - Any blockers or impediments the team member is facing.
 * @returns {{name: string, done: string, todo: string, blockers: string, submittedAt: string}}
 *          A standup object containing the provided fields and an ISO 8601 timestamp.
 *
 * @example
 * const entry = createStandup(
 *   "Jane",
 *   "Finished the navbar layout",
 *   "Connect the form to local storage",
 *   "Waiting on API decision"
 * );
 * // entry.submittedAt => "2024-06-06T10:30:00.000Z"
 */
export function createStandup(name, done, todo, blockers) {
  return {
    name,
    done,
    todo,
    blockers,
    submittedAt: new Date().toISOString(),
  };
}
