const { Schema, model } = require('mongoose');
const { EVENT_TYPES, SOURCES } = require('../engine/catalog');

const EventSchema = new Schema({
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  type: { type: String, required: true, enum: Object.keys(EVENT_TYPES) },
  category: { type: String, required: true },
  source: { type: String, required: true, enum: Object.keys(SOURCES) },
  sourceRef: String, // reference in the originating system, e.g. TKT-20931
  occurredAt: { type: Date, required: true, index: true },
  title: { type: String, maxlength: 200 },
  description: { type: String, maxlength: 2000 },
  text: { type: String, maxlength: 2000 },
  amount: { type: Number, min: 0 },
  percent: { type: Number, min: 0, max: 100 },
  severity: { type: String, enum: ['Low', 'Medium', 'High', null] },
  stage: String,
  contact: String,
  resolves: String, // event id of the complaint a resolution closes
  sentiment: { type: Schema.Types.Mixed, default: null },
  status: { type: String, default: null },
  resolvedAt: { type: Date, default: null },
  impact: { type: Schema.Types.Mixed, default: null },
  origin: { type: String, enum: ['seed', 'simulator', 'sync'], default: 'seed' },
}, { timestamps: true });

EventSchema.index({ customer: 1, occurredAt: -1 });

module.exports = model('Event', EventSchema);
