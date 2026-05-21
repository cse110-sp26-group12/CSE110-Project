import { createStandup } from "./standup.js";

export function createStandupStore() {
  const standups = [];
  return {
    add(name, done, todo, blockers) {
      const entry = createStandup(name, done, todo, blockers);
      standups.push(entry);
      return entry;
    },
    getAll() {
      return [...standups];
    },
    toJSON() {
      return JSON.stringify(standups, null, 2);
    },
    clear() {
      standups.length = 0;
    },
  };
}

export const standupStore = createStandupStore();
