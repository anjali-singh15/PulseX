const { Schema, model } = require('mongoose');

const ContactSchema = new Schema({
  name: { type: String, required: true },
  role: String,
  email: String,
  phone: String,
  primary: { type: Boolean, default: false },
}, { _id: false });

const ProductSchema = new Schema({
  name: { type: String, required: true },
  plan: String,
  seats: Number,
  activeSeats: Number,
}, { _id: false });

const CustomerSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  companyId: { type: String, index: true }, // CIN — used for identity resolution
  industry: String,
  segment: { type: String, enum: ['Enterprise', 'Mid-market', 'SMB'] },
  city: String,
  domain: String,
  phone: String,
  accountOwner: String,
  customerSince: Date,
  contacts: [ContactSchema],
  products: [ProductSchema],
  baseUsage: { type: Number, default: 65, min: 5, max: 100 },
  scenario: String, // describes the seeded demo story
  flagship: { type: Boolean, default: false },
  // Derived by the relationship engine after every event. Never edited by hand.
  snapshot: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, minimize: false });

CustomerSchema.index({ 'snapshot.state': 1 });
CustomerSchema.index({ name: 'text' });

module.exports = model('Customer', CustomerSchema);
