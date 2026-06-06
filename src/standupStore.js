import { createStandup } from './standup.js';

/**
 * Factory function that creates a standup store instance.
 * Manages a collection of daily standup entries for the team,
 * providing methods to add, retrieve, and serialize standups.
 *
 * @returns {{
 *   add: function(string, string, string, string): Object,
 *   getAll: function(): Object[],
 *   serialize: function(): string
 * }} A standup store object with add, getAll, and serialize methods.
 *
 * @example
 * const store = createStandupStore();
 * store.add("Jane", "Fixed bug", "Write tests", "None");
 * store.getAll(); // => [{ name: "Jane", done: "Fixed bug", ... }]
 */
export function createStandupStore() {
  const standups = [];
  return {
    /**
     * Creates a new standup entry and adds it to the store.
     *
     * @param {string} name - The name of the team member submitting the standup.
     * @param {string} done - What the team member completed yesterday.
     * @param {string} todo - What the team member plans to do today.
     * @param {string} blockers - Any blockers or impediments the team member is facing.
     * @returns {Object} The newly created standup entry.
     */
    add(name, done, todo, blockers) {
      const standup = createStandup(name, done, todo, blockers);
      standups.push(standup);
      return standup;
    },
    /**
     * Retrieves a shallow copy of all standup entries in the store.
     * Returns a copy to prevent direct mutation of the internal array.
     *
     * @returns {Object[]} An array of all submitted standup objects.
    */
    getAll() {
      return [...standups];
    },
     /**
     * Serializes all standup entries to a formatted JSON string.
     * Useful for persisting standup data to local storage or an API.
     *
     * @returns {string} A pretty-printed JSON string of all standup entries.
     */
    serialize() {
      return JSON.stringify(standups, null, 2);
    },
  };
}
/**
 * Shared singleton standup store instance for use across the application.
 * Initialized once via {@link createStandupStore} and exported for global access.
 *
 * @type {{
 *   add: function(string, string, string, string): Object,
 *   getAll: function(): Object[],
 *   serialize: function(): string
 * }}
 */
export const standupStore = createStandupStore();
