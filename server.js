const express = require('express');
const db = require('./config/database');
const apiRoutes = require('./routes/api');

const app = express();

app.use(express.json());
app.use('/api', apiRoutes(db));

app.get('/', (req, res) => {
  res.json({
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
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'BeatBox Music Room API' });
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;

  app.listen(port, () => {
    console.log(`BeatBox Music Room API is listening on port ${port}`);
  });
}

module.exports = app;
