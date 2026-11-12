CREATE TABLE IF NOT EXISTS musicians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS instruments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'loaned')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  musician_id INTEGER NOT NULL,
  instrument_id INTEGER NOT NULL,
  loan_date TEXT NOT NULL,
  return_date TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'returned')),
  FOREIGN KEY (musician_id) REFERENCES musicians(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (instrument_id) REFERENCES instruments(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_instruments_status
  ON instruments(status);

CREATE INDEX IF NOT EXISTS idx_loans_musician_id
  ON loans(musician_id);

CREATE INDEX IF NOT EXISTS idx_loans_instrument_id
  ON loans(instrument_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_one_active_per_instrument
  ON loans(instrument_id)
  WHERE status = 'active';
