const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const testDatabaseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'beatbox-loan-test-'));
process.env.DATABASE_PATH = path.join(testDatabaseDirectory, 'test.sqlite');
const app = require('../server');
const db = require('../config/database');

async function setupApi(t) {
  const server = app.listen(0);
  await once(server, 'listening');
  t.after(async () => {
    server.close();
    await once(server, 'close');
    db.prepare('DELETE FROM loans').run();
    db.prepare('DELETE FROM instruments').run();
    db.prepare('DELETE FROM musicians').run();
  });

  const { port } = server.address();
  const request = async (method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
    };
  };

  const musicianResponse = await request('POST', '/api/musicians', {
    name: 'Asha',
    email: `asha-${Date.now()}-${Math.random()}@example.com`,
  });
  assert.equal(musicianResponse.status, 201);

  async function createInstrument(index) {
    const response = await request('POST', '/api/instruments', {
      name: `Instrument ${index}`,
      family: 'Strings',
    });
    assert.equal(response.status, 201);
    return response.data;
  }

  async function createLoan(instrument) {
    return request('POST', '/api/loans', {
      musician_id: musicianResponse.data.id,
      instrument_id: instrument.id,
    });
  }

  return {
    createInstrument,
    createLoan,
    musician: musicianResponse.data,
    request,
  };
}

test.after(() => {
  db.close();
  fs.rmSync(testDatabaseDirectory, { recursive: true, force: true });
});

test('allows Asha to create three active loans', async (t) => {
  const api = await setupApi(t);

  for (let index = 1; index <= 3; index += 1) {
    const instrument = await api.createInstrument(index);
    const loan = await api.createLoan(instrument);
    assert.equal(loan.status, 201);
  }
});

test('rejects Asha fourth active loan with the required conflict message', async (t) => {
  const api = await setupApi(t);

  for (let index = 1; index <= 3; index += 1) {
    const instrument = await api.createInstrument(index);
    assert.equal((await api.createLoan(instrument)).status, 201);
  }

  const fourthInstrument = await api.createInstrument(4);
  const response = await api.createLoan(fourthInstrument);
  assert.equal(response.status, 409);
  assert.equal(response.data.error, 'Limit of 3 reached');
});

test('allows Asha another loan after returning one and excludes it from the active count', async (t) => {
  const api = await setupApi(t);
  const loans = [];

  for (let index = 1; index <= 3; index += 1) {
    const instrument = await api.createInstrument(index);
    const response = await api.createLoan(instrument);
    assert.equal(response.status, 201);
    loans.push(response.data);
  }

  const returned = await api.request('PUT', `/api/loans/${loans[0].id}/return`);
  assert.equal(returned.status, 200);
  assert.equal(returned.data.status, 'returned');
  assert.ok(returned.data.return_date);

  const replacementInstrument = await api.createInstrument(4);
  const replacementLoan = await api.createLoan(replacementInstrument);
  assert.equal(replacementLoan.status, 201);
  assert.equal(replacementLoan.data.status, 'active');
});
