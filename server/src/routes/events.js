const router = require('express').Router();
const mongoose = require('mongoose');
const { Event } = require('../models');
const { CATEGORIES } = require('../engine/catalog');
const { asyncHandler, ApiError } = require('../middleware/errors');
const { addEvent } = require('../services/customerService');

// Timeline feed: one customer, or the latest activity across the portfolio
router.get('/', asyncHandler(async (req, res) => {
  const { customerId, category, limit = 100 } = req.query;
  const filter = {};
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) throw new ApiError(400, 'Invalid customerId');
    filter.customer = customerId;
  }
  if (category) {
    const lookup = Object.fromEntries(CATEGORIES.map((c) => [c.toLowerCase(), c]));
    const raw = String(category).split(',').map((c) => c.trim()).filter(Boolean);
    const bad = raw.filter((c) => !lookup[c.toLowerCase()]);
    const cats = raw.map((c) => lookup[c.toLowerCase()]);
    if (bad.length) throw new ApiError(400, `Unknown category: ${bad.join(', ')}`);
    filter.category = { $in: cats };
  }
  const events = await Event.find(filter)
    .sort({ occurredAt: -1, _id: -1 })
    .limit(Math.min(Number(limit) || 100, 500))
    .populate('customer', 'name')
    .lean();
  res.json({ events });
}));

// The live event pipeline
router.post('/', asyncHandler(async (req, res) => {
  const result = await addEvent(req.body, 'simulator');
  res.status(201).json(result);
}));

module.exports = router;
