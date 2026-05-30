import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Creates or accesses an SQLite database at a specified directory
 * @param {*} dbPath The directory where the database files will be created/accessed
 * @returns An SQL database at `dbPath`
 */
export function createDatabaseConnection(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath, {
    // verbose: console.log, // uncomment for query logging
  });

  db.pragma('journal_mode = WAL'); //Write-Ahead Logging for concurrency, otherwise writes block reads
  db.pragma('foreign_keys = ON'); //needed for relationships between tables; off by default in SQLite
  db.pragma('synchronous = NORMAL'); //sync WAL file before checkpoints and DB file after checkpoints
  db.pragma('busy_timeout = 5000'); //time to wait on write contention before throwing
  db.pragma('cache_size = -64000'); //64 MB
  db.pragma('temp_store = MEMORY'); //stores temp tables in RAM rather than disk
  db.pragma('optimize = 0x10002'); //gather stats on close

  return db;
}

let dbInstance = null;

/**
 * Access the current singleton database instance; will create a connection if one does not exist
 * @returns The current database instance
 */
export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabaseConnection(
      process.env.DATABASE_PATH || './database/data/sitrep.db',
    );
  }
  return dbInstance;
}

/**
 * ### Do not use in production.
 * Replace the current singleton with a specific database instance. **Intended for tests**, which inject
 * an isolated temp-file connection so the repositories' getDb() calls resolve to the test database
 * instead of the real one. Closes any existing instance first to avoid leaking handles.
 * @param {Database} db An open database instance
 * @returns The injected instance
 */
export function setDb(db) {
  if (dbInstance && dbInstance !== db) {
    try {
      dbInstance.close();
    } catch {
      /* already closed */
    }
  }
  dbInstance = db;
  return dbInstance;
}

/**
 * ### Do not use in production.
 * Close and clear the current singleton. The next getDb() call will create a fresh connection from
 * DATABASE_PATH. **Intended between tests** so each test starts from a clean slate. Safe to call
 * when no instance exists.
 */
export function resetDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      /* already closed */
    }
    dbInstance = null;
  }
}

process.on('exit', () => dbInstance?.close());
process.on('SIGINT', () => {
  dbInstance?.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  dbInstance?.close();
  process.exit(0);
});
