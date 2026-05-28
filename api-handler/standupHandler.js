/**
 * API Handler for Standups
 * 
 * Constraints:
 * - WILL NOT read or write storage directly.
 * - WILL NOT run conditional logic beyond input parsing and generating errors.
 */

// This is a placeholder for the Service Layer which will be implemented next.
// For now, it acts as a bridge.
const mockService = {
  async addStandup(data) {
    console.log('Service Layer: Adding standup', data);
    return { ...data, id: Date.now(), submittedAt: new Date().toISOString() };
  },
  async getAllStandups() {
    console.log('Service Layer: Fetching all standups');
    return [];
  }
};

export async function handleGetStandups(req, res) {
  try {
    const standups = await mockService.getAllStandups();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(standups));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}

export async function handlePostStandup(req, res, body) {
  try {
    // 1. Parsing and basic validation
    const { name, done, todo, blockers } = body;

    if (!name || !done || !todo) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required fields: name, done, and todo are required.' }));
      return;
    }

    // 2. Call Service Layer
    const newStandup = await mockService.addStandup({ name, done, todo, blockers });

    // 3. HTTP Response
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(newStandup));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}
