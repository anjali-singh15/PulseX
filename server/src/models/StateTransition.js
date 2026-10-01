const { Schema, model } = require('mongoose');

const StateTransitionSchema = new Schema({
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  from: String,
  to: String,
  at: { type: Date, index: true },
  rule: String,
  reasons: [{ _id: false, kind: String, text: String, points: Number }],
  event: { type: Schema.Types.ObjectId, ref: 'Event' },
  trigger: String,
  churnBefore: Number,
  churnAfter: Number,
}, { timestamps: true });

module.exports = model('StateTransition', StateTransitionSchema);
