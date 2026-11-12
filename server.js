const express = require('express');
const db = require('./config/database');
const apiRoutes = require('./routes/api');

const app = express();

app.use(express.json());
app.use('/api', apiRoutes(db));

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
