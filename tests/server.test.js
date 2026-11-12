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
