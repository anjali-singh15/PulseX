const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { runSeed } = require('./index');

(async () => {
  try {
    await connectDB();
    console.log('[seed] loading PulseX demo dataset…');
    const summary = await runSeed({ log: console.log });
    console.log(`[seed] done in ${summary.ms} ms`);
  } catch (err) {
    console.error('[seed] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
