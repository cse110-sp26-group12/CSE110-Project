import { createDatabaseConnection } from '../database/connection.js';
import { runDatabaseMigrations } from '../database/migrate.js';
import { tempDbPath, cleanupDb, createTempMigrationsDir } from '../__test-helpers__/tempDb.js';

describe('runDatabaseMigrations', () => {
    let openDbs = [];
    let dbPaths = [];
    let migrationCleanups = [];

    afterEach(() => {
        for (const db of openDbs) { try { db.close(); } catch { /* Pass */ } }
        for (const p of dbPaths) cleanupDb(p);
        for (const cleanup of migrationCleanups) cleanup();
        openDbs = [];
        dbPaths = [];
        migrationCleanups = [];
    });

    function freshDb() {
        const p = tempDbPath();
        const db = createDatabaseConnection(p);
        openDbs.push(db);
        dbPaths.push(p);
        return db;
    }

    function makeMigrations(files) {
        const result = createTempMigrationsDir(files);
        migrationCleanups.push(result.cleanup);
        return result.dir;
    }

    describe('happy path', () => {
        it('applies a single migration on a fresh database', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '001_initial.sql': `
                    CREATE TABLE foo (id INTEGER PRIMARY KEY);
                    PRAGMA user_version = 1;
                `,
            });

            const finalVersion = runDatabaseMigrations({ db, migrationsDir: dir });

            expect(finalVersion).toBe(1);
            const tables = db.prepare(
                'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'foo\''
            ).all();
            expect(tables).toHaveLength(1);
        });

        it('applies multiple migrations in order', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '001_initial.sql': `
                    CREATE TABLE foo (id INTEGER PRIMARY KEY);
                    PRAGMA user_version = 1;
                `,
                '002_add_bar.sql': `
                    CREATE TABLE bar (id INTEGER PRIMARY KEY);
                    PRAGMA user_version = 2;
                `,
                '003_add_baz.sql': `
                    CREATE TABLE baz (id INTEGER PRIMARY KEY);
                    PRAGMA user_version = 3;
                `,
            });

            const finalVersion = runDatabaseMigrations({ db, migrationsDir: dir });

            expect(finalVersion).toBe(3);
            const tableNames = db.prepare(
                'SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name'
            ).all().map(r => r.name);
            expect(tableNames).toEqual(['bar', 'baz', 'foo']);
        });

        it('applies migrations in numeric order regardless of filesystem order', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '003_third.sql':  'CREATE TABLE c (id INTEGER); PRAGMA user_version = 3;',
                '001_first.sql':  'CREATE TABLE a (id INTEGER); PRAGMA user_version = 1;',
                '002_second.sql': 'CREATE TABLE b (id INTEGER); PRAGMA user_version = 2;',
            });

            const finalVersion = runDatabaseMigrations({ db, migrationsDir: dir });
            expect(finalVersion).toBe(3);
        });

        it('returns the current version when no migrations exist', () => {
            const db = freshDb();
            const dir = makeMigrations({});

            const finalVersion = runDatabaseMigrations({ db, migrationsDir: dir });
            expect(finalVersion).toBe(0);
        });

        it('ignores files that do not match the migration naming pattern', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '001_initial.sql': 'CREATE TABLE foo (id INTEGER); PRAGMA user_version = 1;',
                'README.md':       '# notes',
                'helper.sql':      'SELECT 1;',
                'notes.txt':       'roblox',
            });

            const finalVersion = runDatabaseMigrations({ db, migrationsDir: dir });
            expect(finalVersion).toBe(1);
        });
    });

    describe('idempotency', () => {
        it('skips already-applied migrations on subsequent runs', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '001_initial.sql': `
                    CREATE TABLE foo (id INTEGER PRIMARY KEY);
                    PRAGMA user_version = 1;
                `,
            });

            runDatabaseMigrations({ db, migrationsDir: dir });

            const finalVersion = runDatabaseMigrations({ db, migrationsDir: dir });
            expect(finalVersion).toBe(1);
        });

        it('only applies new migrations when version already partially advanced', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '001_initial.sql': 'CREATE TABLE a (id INTEGER); PRAGMA user_version = 1;',
                '002_add_b.sql':   'CREATE TABLE b (id INTEGER); PRAGMA user_version = 2;',
            });

            runDatabaseMigrations({ db, migrationsDir: dir });
            expect(db.pragma('user_version', { simple: true })).toBe(2);

            const dir2 = makeMigrations({
                '001_initial.sql': 'CREATE TABLE a (id INTEGER); PRAGMA user_version = 1;',
                '002_add_b.sql':   'CREATE TABLE b (id INTEGER); PRAGMA user_version = 2;',
                '003_add_c.sql':   'CREATE TABLE c (id INTEGER); PRAGMA user_version = 3;',
            });

            const finalVersion = runDatabaseMigrations({ db, migrationsDir: dir2 });
            expect(finalVersion).toBe(3);
            const tables = db.prepare(
                'SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name'
            ).all().map(r => r.name);
            expect(tables).toEqual(['a', 'b', 'c']);
        });
    });

    describe('error handling', () => {
        it('throws a descriptive error when a migration has a SQL syntax error', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '001_broken.sql': `
                    CREATE TABLE foo (
                        id INTEGER PRIMARY KEY
                        name TEXT
                    );
                    PRAGMA user_version = 1;
                `,
            });

            expect(() => runDatabaseMigrations({ db, migrationsDir: dir }))
                .toThrow(/001_broken\.sql/);
        });

        it('includes the SQLite error code in the thrown message', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '001_broken.sql': 'THIS IS NOT VALID SQL;',
            });

            expect(() => runDatabaseMigrations({ db, migrationsDir: dir }))
                .toThrow(/SQLITE_ERROR/);
        });

        it('rolls back the entire migration on partial failure', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '001_partial.sql': `
                    CREATE TABLE good (id INTEGER PRIMARY KEY);
                    CREATE TABLE bad (id INTEGER PRIMARY KEY broken syntax here);
                    PRAGMA user_version = 1;
                `,
            });

            expect(() => runDatabaseMigrations({ db, migrationsDir: dir })).toThrow();

            const tables = db.prepare(
                'SELECT name FROM sqlite_master WHERE type=\'table\' AND name IN (\'good\', \'bad\')'
            ).all();
            expect(tables).toEqual([]);

            expect(db.pragma('user_version', { simple: true })).toBe(0);
        });

        it('throws when a migration does not bump user_version', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '001_forgot_pragma.sql': `
                    CREATE TABLE foo (id INTEGER PRIMARY KEY);
                    -- oops, forgot the PRAGMA
                `,
            });

            expect(() => runDatabaseMigrations({ db, migrationsDir: dir }))
                .toThrow(/did not set user_version to 1/);
        });

        it('throws when a migration sets the wrong user_version', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '002_misnamed.sql': `
                    CREATE TABLE foo (id INTEGER PRIMARY KEY);
                    PRAGMA user_version = 5;
                `,
            });

            expect(() => runDatabaseMigrations({ db, migrationsDir: dir }))
                .toThrow(/did not set user_version to 2.*got 5/);
        });

        it('stops applying further migrations after one fails', () => {
            const db = freshDb();
            const dir = makeMigrations({
                '001_good.sql':   'CREATE TABLE a (id INTEGER); PRAGMA user_version = 1;',
                '002_broken.sql': 'THIS IS BROKEN;',
                '003_good.sql':   'CREATE TABLE c (id INTEGER); PRAGMA user_version = 3;',
            });

            expect(() => runDatabaseMigrations({ db, migrationsDir: dir })).toThrow();

            expect(db.pragma('user_version', { simple: true })).toBe(1);
            const cExists = db.prepare(
                'SELECT name FROM sqlite_master WHERE name=\'c\''
            ).get();
            expect(cExists).toBeUndefined();
        });
    });

    describe('against the real initial migration', () => {
        it('successfully applies 01_initial.sql to a fresh database', () => {
            const db = freshDb();
            const finalVersion = runDatabaseMigrations({ db });

            expect(finalVersion).toBe(1);

            const tables = db.prepare(
                'SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name'
            ).all().map(r => r.name);

            expect(tables).toEqual(expect.arrayContaining([
                'users',
                'teams',
                'team_members',
                'standups',
                'user_sessions',
            ]));
        });

        it('creates expected indexes', () => {
            const db = freshDb();
            runDatabaseMigrations({ db });

            const indexes = db.prepare(
                'SELECT name FROM sqlite_master WHERE type=\'index\' AND name NOT LIKE \'sqlite_%\''
            ).all().map(r => r.name);

            expect(indexes).toEqual(expect.arrayContaining([
                'idx_users_email',
                'idx_users_kill_after',
                'idx_tm_owners',
                'idx_tm_memberships_user',
                'idx_tm_memberships_team',
                'idx_standups_team',
                'idx_standups_kill_after',
                'idx_sessions_token',
                'idx_sessions_user',
                'idx_sessions_expires'
            ]));
        });

        it('enforces unique constraint on user email (case-insensitive)', () => {
            const db = freshDb();
            runDatabaseMigrations({ db });

            db.prepare(
                'INSERT INTO users (user_name, user_email, pass_hash) VALUES (?, ?, ?)'
            ).run('alice', 'alice@example.com', 'hash1');

            expect(() => {
                db.prepare(
                    'INSERT INTO users (user_name, user_email, pass_hash) VALUES (?, ?, ?)'
                ).run('bob', 'ALICE@example.com', 'hash2');
            }).toThrow(/UNIQUE/);
        });

        it('enforces foreign key constraint on team_members', () => {
            const db = freshDb();
            runDatabaseMigrations({ db });

            expect(() => {
                db.prepare(
                    'INSERT INTO team_members (user_id, team_id, display_name) VALUES (?, ?, ?)'
                ).run(999, 999, 'Ghost');
            }).toThrow(/FOREIGN KEY/i);
        });

        it('enforces CHECK constraint on member_role', () => {
            const db = freshDb();
            runDatabaseMigrations({ db });

            const userId = db.prepare(
                'INSERT INTO users (user_name, user_email, pass_hash) VALUES (?, ?, ?)'
            ).run('alice', 'alice@example.com', 'hash').lastInsertRowid;

            const teamId = db.prepare(
                'INSERT INTO teams (team_name, invite_code, owned_by) VALUES (?, ?, ?)'
            ).run('Alpha', 'invite123', userId).lastInsertRowid;

            expect(() => {
                db.prepare(
                    'INSERT INTO team_members (user_id, team_id, display_name, member_role) VALUES (?, ?, ?, ?)'
                ).run(userId, teamId, 'Alice', 'superuser');
            }).toThrow(/CHECK/);
        });

        it('cascades deletes from users to team_members', () => {
            const db = freshDb();
            runDatabaseMigrations({ db });

            const userId = db.prepare(
                'INSERT INTO users (user_name, user_email, pass_hash) VALUES (?, ?, ?)'
            ).run('alice', 'alice@example.com', 'hash').lastInsertRowid;

            const ownerId = db.prepare(
                'INSERT INTO users (user_name, user_email, pass_hash) VALUES (?, ?, ?)'
            ).run('owner', 'owner@example.com', 'hash').lastInsertRowid;

            const teamId = db.prepare(
                'INSERT INTO teams (team_name, invite_code, owned_by) VALUES (?, ?, ?)'
            ).run('Alpha', 'invite123', ownerId).lastInsertRowid;

            db.prepare(
                'INSERT INTO team_members (user_id, team_id, display_name) VALUES (?, ?, ?)'
            ).run(userId, teamId, 'Alice');

            db.prepare('DELETE FROM users WHERE id = ?').run(userId);

            const remaining = db.prepare(
                'SELECT * FROM team_members WHERE user_id = ?'
            ).all(userId);
            expect(remaining).toEqual([]);
        });
    });
});