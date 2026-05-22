import { createStandup } from './standup.js';

export function createStandupStore() {
  const standups = [];
  return {
    add(name, done, todo, blockers) {
      const standup = createStandup(name, done, todo, blockers);
      standups.push(standup);
      return standup;
    },
    getAll() {
      return [...standups];
    },
    serialize() {
      return JSON.stringify(standups, null, 2);
    },
  };
}

export const standupStore = createStandupStore();
