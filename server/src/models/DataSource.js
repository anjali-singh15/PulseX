const { Schema, model } = require('mongoose');

const DataSourceSchema = new Schema({
  key: { type: String, required: true, unique: true },
  name: String,
  description: String,
  status: { type: String, enum: ['Connected', 'Syncing', 'Error'], default: 'Connected' },
  lastSyncAt: Date,
  recordsImported: { type: Number, default: 0 },
  eventsImported: { type: Number, default: 0 },
  syncHistory: [{ _id: false, at: Date, records: Number, events: Number, note: String }],
}, { timestamps: true });

module.exports = model('DataSource', DataSourceSchema);
