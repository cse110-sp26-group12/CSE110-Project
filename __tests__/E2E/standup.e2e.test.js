import request from 'supertest';
import { createServer } from '../../server.js';
import {
  createDatabaseConnection,
  setDb,
  resetDb,
} from '../../database/connection.js';
import { runDatabaseMigrations } from '../../database/migrate.js';
import { tempDbPath, cleanupDb } from '../../__test-helpers__/tempDb.js';

//E2E tests o algo
describe('standups API (E2E)', () => {
  let app;
  let db;
  let dbPath;

  beforeEach(() => {
    // Fresh DB per test. 
    // No manual user/team/membership seeding since service bootstraps a demo team + placeholder member via getOrCreateDemoTeam()
    // Manual seeding will be needed once user, team, and membership functionality are implemented (never happening lmao)
    dbPath = tempDbPath();
    db = createDatabaseConnection(dbPath);
    runDatabaseMigrations({ db });
    setDb(db);
    app = createServer();
  });

  afterEach(() => {
    resetDb();
    cleanupDb(dbPath);
  });

  describe('GET /api/standups', () => {
    it('returns 200 with a JSON array', async () => {
      const res = await request(app).get('/api/standups');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns an empty array when no standups exist yet', async () => {
      const res = await request(app).get('/api/standups');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('reflects a standup created via POST (round-trip)', async () => {
      await request(app)
        .post('/api/standups')
        .send({
          name: 'Jogny Tesk',
          done: 'shipped the API',
          todo: 'write E2E tests',
          blockers: null,
          statusFlag: 'In progress',
        });

      const res = await request(app).get('/api/standups');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Jogny Tesk');
    });
  });

  describe('POST /api/standups', () => {
    it('creates a standup and returns 201 with the created object', async () => {
      const res = await request(app)
        .post('/api/standups')
        .send({
          name: 'Jogny Tesk',
          done: 'shipped the API',
          todo: 'write E2E tests',
          blockers: null,
          statusFlag: 'In progress',
        });

      expect(res.status).toBe(201);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body.name).toBe('Jogny Tesk');
      expect(res.body.done).toBe('shipped the API');
      expect(res.body.todo).toBe('write E2E tests');
      expect(res.body.blockers).toBe('none');
      expect(res.body.statusFlag).toBe('In progress');
    });

    it('creates a standup carrying a blocker and returns status flag as BLOCKED', async () => {
      const res = await request(app)
        .post('/api/standups')
        .send({
          name: 'BBB',
          done: 'API scaffolding',
          todo: 'auth middleware',
          blockers: 'waiting on schema sign-off',
          statusFlag: 'In progress',
        });

      expect(res.status).toBe(201);
      expect(res.body.blockers).toBe('waiting on schema sign-off');
      expect(res.body.statusFlag).toBe('Blocked');
    });

    it('returns 400 on invalid JSON', async () => {
      const res = await request(app)
        .post('/api/standups')
        .set('Content-Type', 'application/json')
        .send('{ not valid json');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid json/i);
    });
  });

  describe('CORS preflight', () => {
    it('responds 204 to OPTIONS with the allowed methods', async () => {
      const res = await request(app).options('/api/standups');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
    });
  });
});