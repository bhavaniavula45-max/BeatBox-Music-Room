const express = require('express');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isConstraintError(error) {
  return typeof error.code === 'string' && error.code.startsWith('SQLITE_CONSTRAINT');
}

function handleRoute(handler) {
  return (req, res, next) => {
    try {
      handler(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }

      if (isConstraintError(error)) {
        res.status(409).json({ error: 'The request conflicts with existing data.' });
        return;
      }

      next(error);
    }
  };
}

function requiredText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validEmail(value) {
  return requiredText(value)
    && value.trim().length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validId(value) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function requireValidId(value, resource) {
  if (!validId(value)) {
    throw new HttpError(400, `A valid ${resource} ID is required.`);
  }
  return Number(value);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

module.exports = function createApiRoutes(db) {
  const router = express.Router();

  router.get('/musicians', handleRoute((req, res) => {
    const musicians = db.prepare(
      'SELECT id, name, email, created_at FROM musicians ORDER BY id',
    ).all();
    res.status(200).json(musicians);
  }));

  router.get('/musicians/:id', handleRoute((req, res) => {
    const id = requireValidId(req.params.id, 'musician');
    const musician = db.prepare(
      'SELECT id, name, email, created_at FROM musicians WHERE id = ?',
    ).get(id);
    if (!musician) {
      throw new HttpError(404, 'Musician not found.');
    }
    res.status(200).json(musician);
  }));

  router.post('/musicians', handleRoute((req, res) => {
    const { name, email } = req.body || {};
    if (!requiredText(name)) {
      throw new HttpError(400, 'Musician name is required.');
    }
    if (!validEmail(email)) {
      throw new HttpError(400, 'A valid musician email is required.');
    }
    const result = db.prepare(
      'INSERT INTO musicians (name, email) VALUES (?, ?)',
    ).run(name.trim(), email.trim());
    const musician = db.prepare(
      'SELECT id, name, email, created_at FROM musicians WHERE id = ?',
    ).get(result.lastInsertRowid);
    res.status(201).json(musician);
  }));

  router.get('/instruments', handleRoute((req, res) => {
    const { family } = req.query;
    if (family !== undefined && !requiredText(family)) {
      throw new HttpError(400, 'Instrument family search must be a non-empty string.');
    }
    const instruments = family === undefined
      ? db.prepare(
        'SELECT id, name, family, status, created_at FROM instruments ORDER BY id',
      ).all()
      : db.prepare(
        'SELECT id, name, family, status, created_at FROM instruments WHERE family = ? ORDER BY id',
      ).all(family.trim());
    res.status(200).json(instruments);
  }));

  router.get('/instruments/:id', handleRoute((req, res) => {
    const id = requireValidId(req.params.id, 'instrument');
    const instrument = db.prepare(
      'SELECT id, name, family, status, created_at FROM instruments WHERE id = ?',
    ).get(id);
    if (!instrument) {
      throw new HttpError(404, 'Instrument not found.');
    }
    res.status(200).json(instrument);
  }));

  router.post('/instruments', handleRoute((req, res) => {
    const { name, family } = req.body || {};
    if (!requiredText(name)) {
      throw new HttpError(400, 'Instrument name is required.');
    }
    if (!requiredText(family)) {
      throw new HttpError(400, 'Instrument family is required.');
    }
    const status = !req.body || req.body.status === undefined ? 'available' : req.body.status;
    if (!['available', 'loaned'].includes(status)) {
      throw new HttpError(400, 'Instrument status must be available or loaned.');
    }
    if (status === 'loaned') {
      throw new HttpError(409, 'Create a loan to mark an instrument as loaned.');
    }
    const result = db.prepare(
      'INSERT INTO instruments (name, family, status) VALUES (?, ?, ?)',
    ).run(name.trim(), family.trim(), status);
    const instrument = db.prepare(
      'SELECT id, name, family, status, created_at FROM instruments WHERE id = ?',
    ).get(result.lastInsertRowid);
    res.status(201).json(instrument);
  }));

  router.put('/instruments/:id', handleRoute((req, res) => {
    const id = requireValidId(req.params.id, 'instrument');
    const { name, family } = req.body || {};
    if (!requiredText(name)) {
      throw new HttpError(400, 'Instrument name is required.');
    }
    if (!requiredText(family)) {
      throw new HttpError(400, 'Instrument family is required.');
    }
    if (req.body && req.body.status !== undefined) {
      if (!['available', 'loaned'].includes(req.body.status)) {
        throw new HttpError(400, 'Instrument status must be available or loaned.');
      }
      throw new HttpError(400, 'Instrument status is managed by loan operations.');
    }
    const result = db.prepare(
      'UPDATE instruments SET name = ?, family = ? WHERE id = ?',
    ).run(name.trim(), family.trim(), id);
    if (result.changes === 0) {
      throw new HttpError(404, 'Instrument not found.');
    }
    const instrument = db.prepare(
      'SELECT id, name, family, status, created_at FROM instruments WHERE id = ?',
    ).get(id);
    res.status(200).json(instrument);
  }));

  router.delete('/instruments/:id', handleRoute((req, res) => {
    const id = requireValidId(req.params.id, 'instrument');
    const instrument = db.prepare(
      `SELECT id, status,
              EXISTS (SELECT 1 FROM loans WHERE instrument_id = ? AND status = 'active') AS has_active_loan
       FROM instruments
       WHERE id = ?`,
    ).get(id, id);
    if (!instrument) {
      throw new HttpError(404, 'Instrument not found.');
    }
    if (instrument.status === 'loaned' || instrument.has_active_loan) {
      throw new HttpError(409, 'A loaned instrument cannot be deleted.');
    }
    db.prepare('DELETE FROM instruments WHERE id = ?').run(id);
    res.status(204).end();
  }));

  router.get('/loans', handleRoute((req, res) => {
    const loans = db.prepare(
      `SELECT l.id, l.musician_id, l.instrument_id, l.loan_date, l.return_date, l.status,
              m.name AS musician_name, i.name AS instrument_name
       FROM loans l
       JOIN musicians m ON m.id = l.musician_id
       JOIN instruments i ON i.id = l.instrument_id
       ORDER BY l.id`,
    ).all();
    res.status(200).json(loans);
  }));

  router.get('/loans/:id', handleRoute((req, res) => {
    const id = requireValidId(req.params.id, 'loan');
    const loan = db.prepare(
      `SELECT l.id, l.musician_id, l.instrument_id, l.loan_date, l.return_date, l.status,
              m.name AS musician_name, i.name AS instrument_name
       FROM loans l
       JOIN musicians m ON m.id = l.musician_id
       JOIN instruments i ON i.id = l.instrument_id
       WHERE l.id = ?`,
    ).get(id);
    if (!loan) {
      throw new HttpError(404, 'Loan not found.');
    }
    res.status(200).json(loan);
  }));

  router.post('/loans', handleRoute((req, res) => {
    const { musician_id: musicianId, instrument_id: instrumentId } = req.body || {};
    if (!Number.isSafeInteger(musicianId) || musicianId <= 0
      || !Number.isSafeInteger(instrumentId) || instrumentId <= 0) {
      throw new HttpError(400, 'Valid musician_id and instrument_id are required.');
    }

    const loanDate = req.body.loan_date === undefined
      ? new Date().toISOString().slice(0, 10)
      : req.body.loan_date;
    if (!requiredText(loanDate) || !validDate(loanDate.trim())) {
      throw new HttpError(400, 'Loan date must be a valid date in YYYY-MM-DD format.');
    }

    const createLoan = db.transaction(() => {
      const musician = db.prepare('SELECT id FROM musicians WHERE id = ?').get(musicianId);
      if (!musician) {
        throw new HttpError(404, 'Musician not found.');
      }
      const instrument = db.prepare(
        `SELECT id, status,
                EXISTS (SELECT 1 FROM loans WHERE instrument_id = ? AND status = 'active') AS has_active_loan
         FROM instruments
         WHERE id = ?`,
      ).get(instrumentId, instrumentId);
      if (!instrument) {
        throw new HttpError(404, 'Instrument not found.');
      }
      if (instrument.status !== 'available' || instrument.has_active_loan) {
        throw new HttpError(409, 'Instrument is not available.');
      }
      const { activeLoanCount } = db.prepare(
        'SELECT COUNT(*) AS activeLoanCount FROM loans WHERE musician_id = ? AND status = ?',
      ).get(musicianId, 'active');
      if (activeLoanCount >= 3) {
        throw new HttpError(409, 'Limit of 3 reached');
      }
      const result = db.prepare(
        'INSERT INTO loans (musician_id, instrument_id, loan_date) VALUES (?, ?, ?)',
      ).run(musicianId, instrumentId, loanDate.trim());
      db.prepare('UPDATE instruments SET status = ? WHERE id = ?').run('loaned', instrumentId);
      return result.lastInsertRowid;
    });

    const loanId = createLoan.immediate();
    const loan = db.prepare(
      'SELECT id, musician_id, instrument_id, loan_date, return_date, status FROM loans WHERE id = ?',
    ).get(loanId);
    res.status(201).json(loan);
  }));

  router.put('/loans/:id/return', handleRoute((req, res) => {
    const id = requireValidId(req.params.id, 'loan');
    const returnLoan = db.transaction(() => {
      const loan = db.prepare(
        'SELECT id, instrument_id, status FROM loans WHERE id = ?',
      ).get(id);
      if (!loan) {
        throw new HttpError(404, 'Loan not found.');
      }
      if (loan.status !== 'active') {
        throw new HttpError(409, 'Loan has already been returned.');
      }
      db.prepare(
        'UPDATE loans SET status = ?, return_date = ? WHERE id = ?',
      ).run('returned', new Date().toISOString().slice(0, 10), id);
      db.prepare(
        'UPDATE instruments SET status = ? WHERE id = ?',
      ).run('available', loan.instrument_id);
    });
    returnLoan();
    const loan = db.prepare(
      'SELECT id, musician_id, instrument_id, loan_date, return_date, status FROM loans WHERE id = ?',
    ).get(id);
    res.status(200).json(loan);
  }));

  return router;
};
