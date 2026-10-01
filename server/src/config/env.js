require('dotenv').config();

module.exports = {
  PORT: Number(process.env.PORT) || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pulsex',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  AUTO_SEED: (process.env.AUTO_SEED || 'true') !== 'false',
};
