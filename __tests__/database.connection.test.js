import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseConnection } from '../database/connection.js';
import { tempDbPath, tempDbPathInNewDir, cleanupDb } from '../__test-helpers__/tempDb.js';

describe('createDatabaseConnection', () => {
    let openDbs = [];
    let dbPaths = [];

    afterEach(() => {
        for (const db of openDbs) {
            try { db.close(); } catch { /* Pass */ }
        }
        for (const p of dbPaths) {
            cleanupDb(p);
        }
        openDbs = [];
        dbPaths = [];
    });

    function track(db, p) {
        openDbs.push(db);
        dbPaths.push(p);
        return db;
    }

    it('opens a database at the given path', () => {
        const p = tempDbPath();
        const db = track(createDatabaseConnection(p), p);

        expect(db.open).toBe(true);
        expect(fs.existsSync(p)).toBe(true);
    });

    it('creates the parent directory if it does not exist', () => {
        const p = tempDbPathInNewDir();
        expect(fs.existsSync(path.dirname(p))).toBe(false);

        const db = track(createDatabaseConnection(p), p);

        expect(fs.existsSync(path.dirname(p))).toBe(true);
        expect(fs.existsSync(p)).toBe(true);
        expect(db.open).toBe(true);
    });

    it('enables WAL journal mode', () => {
        const p = tempDbPath();
        const db = track(createDatabaseConnection(p), p);

        const mode = db.pragma('journal_mode', { simple: true });
        expect(mode).toBe('wal');
    });

    it('enables foreign key enforcement', () => {
        const p = tempDbPath();
        const db = track(createDatabaseConnection(p), p);

        const fk = db.pragma('foreign_keys', { simple: true });
        expect(fk).toBe(1);
    });

    it('sets synchronous mode to NORMAL', () => {
        const p = tempDbPath();
        const db = track(createDatabaseConnection(p), p);

        // 0=OFF, 1=NORMAL, 2=FULL, 3=EXTRA
        const sync = db.pragma('synchronous', { simple: true });
        expect(sync).toBe(1);
    });

    it('sets a busy timeout', () => {
        const p = tempDbPath();
        const db = track(createDatabaseConnection(p), p);

        const timeout = db.pragma('busy_timeout', { simple: true });
        expect(timeout).toBe(5000);
    });

    it('sets the cache size to 64 MB', () => {
        const p = tempDbPath();
        const db = track(createDatabaseConnection(p), p);

        // Negative cache_size means KiB; -64000 = 64 MB
        const cache = db.pragma('cache_size', { simple: true });
        expect(cache).toBe(-64000);
    });

    it('enforces foreign keys at write time', () => {
        const p = tempDbPath();
        const db = track(createDatabaseConnection(p), p);

        db.exec(`
            CREATE TABLE parent (id INTEGER PRIMARY KEY);
            CREATE TABLE child (
                id INTEGER PRIMARY KEY,
                parent_id INTEGER NOT NULL REFERENCES parent(id)
            );
        `);

        expect(() => {
            db.prepare('INSERT INTO child (parent_id) VALUES (?)').run(999);
        }).toThrow(/FOREIGN KEY/i);
    });

    it('persists data across connection close and reopen', () => {
        const p = tempDbPath();
        dbPaths.push(p);

        const db1 = createDatabaseConnection(p);
        db1.exec('CREATE TABLE things (id INTEGER PRIMARY KEY, name TEXT)');
        db1.prepare('INSERT INTO things (name) VALUES (?)').run('widget');
        db1.close();

        const db2 = createDatabaseConnection(p);
        openDbs.push(db2);
        const row = db2.prepare('SELECT name FROM things WHERE id = 1').get();
        expect(row.name).toBe('widget');
    });
});