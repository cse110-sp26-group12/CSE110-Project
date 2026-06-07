import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

/**
 * Returns a unique path inside the OS temp directory.
 */
export function tempDbPath() {
  const name = `sitrep-test-${crypto.randomBytes(6).toString('hex')}.db`;
  return path.join(os.tmpdir(), name);
}

/**
 * Returns a unique path inside a non-existent subdirectory.
 */
export function tempDbPathInNewDir() {
  const dir = path.join(
    os.tmpdir(),
    `sitrep-test-${crypto.randomBytes(6).toString('hex')}`,
  );
  return path.join(dir, 'nested', 'sitrep.db');
}

/**
 * Removes a database file and all its sidecars (-wal, -shm from WAL mode).
 * Safe to call regardless if files exist.
 */
export function cleanupDb(dbPath) {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try {
      fs.unlinkSync(dbPath + suffix);
    } catch {
      /* ignore */
    }
  }

  try {
    let dir = path.dirname(dbPath);
    while (dir !== os.tmpdir() && dir !== path.dirname(dir)) {
      fs.rmdirSync(dir);
      dir = path.dirname(dir);
    }
  } catch {
    /* directory not empty or already deleted */
  }
}

/**
 * Creates a temporary migrations directory with the given files.
 * @param {*} files the given files
 * @returns the directory path and a cleanup function.
 */
export function createTempMigrationsDir(files) {
  const dir = path.join(
    os.tmpdir(),
    `migrations-${crypto.randomBytes(6).toString('hex')}`,
  );
  fs.mkdirSync(dir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, filename), content);
  }
  return {
    dir,
    cleanup() {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* Pass */
      }
    },
  };
}
