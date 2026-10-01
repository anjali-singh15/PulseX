const { Schema, model } = require('mongoose');
const { SOURCES } = require('../engine/catalog');

// A raw record as it exists in one source system, with the identity-resolution decision.
const SourceRecordSchema = new Schema({
  system: { type: String, required: true, enum: Object.keys(SOURCES) },
  sourceId: { type: String, required: true },
  rawName: String,
  email: String,
  phone: String,
  companyId: String,
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
  resolution: { type: Schema.Types.Mixed, default: {} },
  ingestedAt: { type: Date, default: Date.now },
}, { timestamps: true });

SourceRecordSchema.index({ system: 1, sourceId: 1 }, { unique: true });

module.exports = model('SourceRecord', SourceRecordSchema);
