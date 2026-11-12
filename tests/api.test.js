const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const testDatabaseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'beatbox-api-test-'));
process.env.DATABASE_PATH = path.join(testDatabaseDirectory, 'test.sqlite');
const app = require('../server');
const db = require('../config/database');

test('REST API supports musician, instrument, and loan CRUD operations', async (t) => {
  const server = app.listen(0);
  await once(server, 'listening');
  t.after(async () => {
    server.close();
    await once(server, 'close');
    db.close();
    fs.rmSync(testDatabaseDirectory, { recursive: true, force: true });
  });

  const { port } = server.address();
  const request = async (method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = response.status === 204 ? null : await response.json();
    return { response, data };
  };

  let result = await request('GET', '/api/musicians');
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.data, []);
  assert.equal((await request('GET', '/api/musicians/999')).response.status, 404);
  assert.equal((await request('GET', '/api/musicians/not-an-id')).response.status, 400);
  assert.equal((await request('POST', '/api/musicians', {
    name: '   ',
    email: 'valid@example.com',
  })).response.status, 400);
  assert.equal((await request('POST', '/api/musicians', {
    name: 'Missing Email',
  })).response.status, 400);
  result = await request('POST', '/api/musicians', {
    name: 'Invalid Email',
    email: 'not-an-email',
  });
  assert.equal(result.response.status, 400);
  assert.match(result.data.error, /valid musician email/i);

  result = await request('POST', '/api/musicians', {
    name: 'Test Musician',
    email: 'musician@example.com',
  });
  assert.equal(result.response.status, 201);
  const musician = result.data;
  assert.equal((await request('GET', `/api/musicians/${musician.id}`)).response.status, 200);
  assert.equal((await request('POST', '/api/musicians', {
    name: 'Duplicate Musician',
    email: 'musician@example.com',
  })).response.status, 409);

  result = await request('GET', '/api/instruments');
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.data, []);
  assert.equal((await request('GET', '/api/instruments/999')).response.status, 404);
  assert.equal((await request('GET', '/api/instruments/nope')).response.status, 400);
  assert.equal((await request('GET', '/api/instruments?family=')).response.status, 400);
  assert.equal((await request('POST', '/api/instruments', {
    name: '   ',
    family: 'Strings',
  })).response.status, 400);
  assert.equal((await request('POST', '/api/instruments', {
    name: 'Missing Family',
  })).response.status, 400);
  assert.equal((await request('POST', '/api/instruments', {
    name: 'Invalid Status',
    family: 'Strings',
    status: 'unavailable',
  })).response.status, 400);
  assert.equal((await request('POST', '/api/instruments', {
    name: 'Unlinked Loaned Instrument',
    family: 'Strings',
    status: 'loaned',
  })).response.status, 409);

  result = await request('POST', '/api/instruments', {
    name: 'Test Guitar',
    family: 'Strings',
    status: 'available',
  });
  assert.equal(result.response.status, 201);
  const instrument = result.data;
  assert.equal(instrument.status, 'available');
  assert.equal((await request('GET', `/api/instruments/${instrument.id}`)).response.status, 200);
  assert.equal((await request('PUT', `/api/instruments/${instrument.id}`, {
    name: 'Updated Guitar',
    family: 'Electric Strings',
  })).response.status, 200);
  assert.equal((await request('PUT', `/api/instruments/${instrument.id}`, {
    name: '   ',
    family: 'Strings',
  })).response.status, 400);
  assert.equal((await request('PUT', `/api/instruments/${instrument.id}`, {
    name: 'Guitar',
  })).response.status, 400);
  assert.equal((await request('PUT', `/api/instruments/${instrument.id}`, {
    name: 'Guitar',
    family: 'Strings',
    status: 'unavailable',
  })).response.status, 400);
  assert.equal((await request('PUT', '/api/instruments/not-an-id', {
    name: 'Missing',
    family: 'Unknown',
  })).response.status, 400);
  assert.equal((await request('PUT', '/api/instruments/999', {
    name: 'Missing',
    family: 'Unknown',
  })).response.status, 404);
  assert.equal((await request('DELETE', '/api/instruments/not-an-id')).response.status, 400);
  assert.equal((await request('DELETE', '/api/instruments/999')).response.status, 404);

  for (const [name, family] of [
    ['Acoustic Guitar', 'Strings'],
    ['Drum Kit', 'Drums'],
    ['Keyboard', 'Keyboard'],
  ]) {
    const created = await request('POST', '/api/instruments', { name, family });
    assert.equal(created.response.status, 201);
  }
  for (const family of ['Strings', 'Drums', 'Keyboard']) {
    result = await request('GET', `/api/instruments?family=${family}`);
    assert.equal(result.response.status, 200);
    assert.ok(result.data.length > 0);
    assert.ok(result.data.every((item) => item.family === family));
  }
  result = await request('GET', '/api/instruments?family=Brass');
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.data, []);

  result = await request('GET', '/api/loans');
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.data, []);
  assert.equal((await request('GET', '/api/loans/999')).response.status, 404);
  assert.equal((await request('GET', '/api/loans/invalid')).response.status, 400);
  assert.equal((await request('POST', '/api/loans', {})).response.status, 400);
  assert.equal((await request('POST', '/api/loans', {
    musician_id: '1',
    instrument_id: 1,
  })).response.status, 400);
  assert.equal((await request('POST', '/api/loans', {
    musician_id: musician.id,
    instrument_id: instrument.id,
    loan_date: '2026-02-30',
  })).response.status, 400);
  assert.equal((await request('POST', '/api/loans', {
    musician_id: 999,
    instrument_id: instrument.id,
  })).response.status, 404);
  assert.equal((await request('POST', '/api/loans', {
    musician_id: musician.id,
    instrument_id: 999,
  })).response.status, 404);

  result = await request('POST', '/api/loans', {
    musician_id: musician.id,
    instrument_id: instrument.id,
    loan_date: '2026-11-12',
  });
  assert.equal(result.response.status, 201);
  const loan = result.data;
  assert.equal(loan.status, 'active');
  result = await request('GET', `/api/loans/${loan.id}`);
  assert.equal(result.response.status, 200);
  assert.equal(result.data.musician_name, 'Test Musician');
  assert.equal(result.data.instrument_name, 'Updated Guitar');
  result = await request('GET', '/api/loans');
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].musician_name, 'Test Musician');
  assert.equal(result.data[0].instrument_name, 'Updated Guitar');
  assert.equal((await request('POST', '/api/loans', {
    musician_id: musician.id,
    instrument_id: instrument.id,
  })).response.status, 409);
  assert.equal((await request('DELETE', `/api/instruments/${instrument.id}`)).response.status, 409);

  result = await request('PUT', `/api/loans/${loan.id}/return`);
  assert.equal(result.response.status, 200);
  assert.equal(result.data.status, 'returned');
  assert.equal((await request('GET', `/api/instruments/${instrument.id}`)).data.status, 'available');
  assert.equal((await request('PUT', `/api/loans/${loan.id}/return`)).response.status, 409);
  assert.equal((await request('PUT', '/api/loans/not-an-id/return')).response.status, 400);
  assert.equal((await request('PUT', '/api/loans/999/return')).response.status, 404);

  result = await request('POST', '/api/loans', {
    musician_id: musician.id,
    instrument_id: instrument.id,
  });
  assert.equal(result.response.status, 201);
  assert.equal((await request('PUT', `/api/loans/${result.data.id}/return`)).response.status, 200);
  assert.equal((await request('DELETE', `/api/instruments/${instrument.id}`)).response.status, 409);

  result = await request('POST', '/api/instruments', {
    name: 'Unused Instrument',
    family: 'Percussion',
  });
  assert.equal(result.response.status, 201);
  assert.equal((await request('DELETE', `/api/instruments/${result.data.id}`)).response.status, 204);
  assert.equal((await request('DELETE', `/api/instruments/${result.data.id}`)).response.status, 404);
});
