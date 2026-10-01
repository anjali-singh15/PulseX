const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');

async function connectDB(uri = MONGODB_URI) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`[db] connected to ${uri.replace(/\/\/.*@/, '//***@')}`);
  return mongoose.connection;
}

module.exports = { connectDB };
