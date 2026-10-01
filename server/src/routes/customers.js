const router = require('express').Router();
const mongoose = require('mongoose');
const { Customer, Event, StateTransition, SourceRecord } = require('../models');
const { STATES } = require('../engine/catalog');
const { asyncHandler, ApiError } = require('../middleware/errors');
const { summarize } = require('../services/customerService');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTS = {
  churn: (a, b) => b.churn - a.churn,
  clv: (a, b) => b.clv - a.clv,
  name: (a, b) => a.name.localeCompare(b.name),
  engagement: (a, b) => a.engagement - b.engagement,
  outstanding: (a, b) => b.outstanding - a.outstanding,
};

router.get('/', asyncHandler(async (req, res) => {
  const { search = '', state, sort = 'churn' } = req.query;
  const filter = {};
  if (search.trim()) filter.name = { $regex: escapeRegex(search.trim().slice(0, 80)), $options: 'i' };
  if (state) {
    if (!STATES.includes(state)) throw new ApiError(400, `state must be one of: ${STATES.join(', ')}`);
    filter['snapshot.state'] = state;
  }
  const customers = await Customer.find(filter, { contacts: 0, products: 0 }).lean();
  const list = customers.map(summarize).sort(SORTS[sort] || SORTS.churn);
  res.json({ customers: list, total: list.length });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid customer id');
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) throw new ApiError(404, 'Customer not found');
  const [events, transitions, records] = await Promise.all([
    Event.find({ customer: customer._id }).sort({ occurredAt: -1, _id: -1 }).lean(),
    StateTransition.find({ customer: customer._id }).sort({ at: -1 }).lean(),
    SourceRecord.find({ customer: customer._id }).sort({ system: 1 }).lean(),
  ]);
  res.json({ customer, summary: summarize(customer), events, transitions, sourceRecords: records });
}));

module.exports = router;
