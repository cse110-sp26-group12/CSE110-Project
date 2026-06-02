import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleGetStandups,
  handlePostStandup,
} from './api-handler/standupHandler.js';
import { runDatabaseMigrations } from './database/migrate.js';

const dbVersion = runDatabaseMigrations();
console.log(`Migration complete for database version: ${dbVersion}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const url = req.url;
  const method = req.method;

   // --- CORS (let the GitHub Pages frontend call this API cross-origin) ---
   res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
   res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
   if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Routes ---
  if (url === '/api/standups' && method === 'GET') {
    return handleGetStandups(req, res);
  }

  if (url === '/api/standups' && method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const parsedBody = JSON.parse(body);
        await handlePostStandup(req, res, parsedBody);
      } catch (err) {
        console.warn('Failed to parse request body:', err.message); //so linter shuts up
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // --- Static File Serving (from /src) --- NOTE: this is
  let filePath = path.join(__dirname, 'src', url === '/' ? 'index.html' : url);
  const extname = path.extname(filePath);
  let contentType = 'text/html';

  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
      contentType = 'image/jpg';
      break;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
