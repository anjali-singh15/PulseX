const { Schema, model } = require('mongoose');

// Queued incremental records a source system will deliver on its next sync.
const PendingRecordSchema = new Schema({
  source: { type: String, required: true, index: true },
  order: Number,
  record: { sourceId: String, rawName: String, email: String, phone: String, companyId: String },
  event: { type: Schema.Types.Mixed, required: true },
  imported: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model('PendingRecord', PendingRecordSchema);
