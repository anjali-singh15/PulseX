const router = require('express').Router();
const mongoose = require('mongoose');

router.get('/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', time: new Date() });
});
router.use('/meta', require('./meta'));
router.use('/dashboard', require('./dashboard'));
router.use('/customers', require('./customers'));
router.use('/events', require('./events'));
router.use('/sources', require('./sources'));
router.use('/insights', require('./insights'));
router.use('/stream', require('./stream'));

module.exports = router;
