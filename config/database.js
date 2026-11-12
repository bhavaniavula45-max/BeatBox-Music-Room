const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const databasePath = process.env.DATABASE_PATH
  || path.join(__dirname, '..', 'database', 'beatbox.sqlite');

if (databasePath !== ':memory:') {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));

const expectedTables = ['musicians', 'instruments', 'loans'];
const tables = db.prepare(
  'SELECT name FROM sqlite_master WHERE type = ? AND name IN (?, ?, ?)',
).all('table', ...expectedTables);

if (tables.length !== expectedTables.length) {
  throw new Error('Database initialization failed: expected tables were not created.');
}

module.exports = db;
