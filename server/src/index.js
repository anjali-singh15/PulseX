const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { PORT, CLIENT_ORIGIN, AUTO_SEED } = require('./config/env');
const { connectDB } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errors');

function createApp() {
  const app = express();
  app.use(cors({ origin: CLIENT_ORIGIN.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '200kb' }));
  app.use('/api', require('./routes'));

  // In production (npm run build && npm start) the API also serves the built React app.
  const dist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function start() {
  await connectDB();
  if (AUTO_SEED) {
    const { ensureSeeded } = require('./seed');
    await ensureSeeded();
  }
  createApp().listen(PORT, () => console.log(`[api] PulseX API listening on http://localhost:${PORT}`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[api] failed to start:', err.message);
    console.error('      Is MongoDB running? Check MONGODB_URI in server/.env');
    process.exit(1);
  });
}

module.exports = { createApp, start };
