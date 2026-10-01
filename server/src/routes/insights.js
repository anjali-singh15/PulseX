const router = require('express').Router();
const { asyncHandler } = require('../middleware/errors');
const { getInsights } = require('../services/insightsService');

router.get('/', asyncHandler(async (req, res) => res.json(await getInsights())));

module.exports = router;
