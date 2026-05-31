import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './connection.js';

const DEFAULT_MIGRATIONS_DIR = path.resolve('./database/migrations');

/**
 * Call this before server startup. Only include arguments for testing.
 * @param {*} db_migrationsDir {[database connection method], [directory for schema migrations]}
 * @returns The current schema user_version
 */
export function runDatabaseMigrations({
  db = getDb(),
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
} = {}) {
  const currentVersion = db.pragma('user_version', { simple: true });

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d+_.+\.sql$/.test(f)) //Regex language: [digits]_[name].sql
    .sort();

  for (const file of files) {
    const targetVersion = parseInt(file.match(/^(\d+)_/)[1], 10); //Catches digits at start of filename
    if (targetVersion <= currentVersion) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    db.pragma('foreign_keys = OFF');
    try {
      const apply = db.transaction(() => {
        try {
          db.exec(sql);
        } catch (err) {
          throw new Error(
            `Migration failed in ${file}: ${err.message} (${err.code})`,
            { cause: err },
          );
        }
        const newVersion = db.pragma('user_version', { simple: true });
        if (newVersion !== targetVersion) {
          throw new Error(
            `Migration ${file} did not set user_version to ${targetVersion} (got ${newVersion})`,
          );
        }
      });

      apply();
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }

  return db.pragma('user_version', { simple: true });
}
