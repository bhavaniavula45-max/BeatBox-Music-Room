const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const testDatabaseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'beatbox-server-test-'));
process.env.DATABASE_PATH = path.join(testDatabaseDirectory, 'test.sqlite');
const app = require('../server');
const db = require('../config/database');

test('GET / describes the project and lists available endpoints', async () => {
  const server = app.listen(0);

  try {
    await once(server, 'listening');
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      projectName: 'BeatBox Music Room',
      description: 'Instrument Loans Management System',
      status: 'running',
      availableEndpoints: [
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/api/musicians' },
        { method: 'GET', path: '/api/musicians/:id' },
        { method: 'POST', path: '/api/musicians' },
        { method: 'GET', path: '/api/instruments' },
        { method: 'GET', path: '/api/instruments?family=Strings' },
        { method: 'GET', path: '/api/instruments/:id' },
        { method: 'POST', path: '/api/instruments' },
        { method: 'PUT', path: '/api/instruments/:id' },
        { method: 'DELETE', path: '/api/instruments/:id' },
        { method: 'GET', path: '/api/loans' },
        { method: 'GET', path: '/api/loans/:id' },
        { method: 'POST', path: '/api/loans' },
        { method: 'PUT', path: '/api/loans/:id/return' },
      ],
      healthCheck: '/health',
    });
  } finally {
    server.close();
    await once(server, 'close');
    db.close();
    fs.rmSync(testDatabaseDirectory, { recursive: true, force: true });
  }
});

test('GET /health reports that the API is running', async () => {
  const server = app.listen(0);

  try {
    await once(server, 'listening');
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'ok',
      service: 'BeatBox Music Room API',
    });
  } finally {
    server.close();
    await once(server, 'close');
    db.close();
    fs.rmSync(testDatabaseDirectory, { recursive: true, force: true });
  }
});
