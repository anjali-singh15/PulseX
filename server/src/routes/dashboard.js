const router = require('express').Router();
const { asyncHandler } = require('../middleware/errors');
const { getDashboard } = require('../services/dashboardService');

router.get('/', asyncHandler(async (req, res) => res.json(await getDashboard())));

module.exports = router;
