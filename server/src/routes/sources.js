const router = require('express').Router();
const { asyncHandler } = require('../middleware/errors');
const { listSources, syncSource, identityOverview } = require('../services/ingestionService');
const { runSeed } = require('../seed');
const bus = require('../utils/bus');

router.get('/', asyncHandler(async (req, res) => res.json({ sources: await listSources() })));
router.get('/identity', asyncHandler(async (req, res) => res.json(await identityOverview())));
router.post('/:key/sync', asyncHandler(async (req, res) => res.json(await syncSource(req.params.key))));

// Reload the full demo dataset from every source (wipes simulator events)
router.post('/import-demo', asyncHandler(async (req, res) => {
  const summary = await runSeed();
  bus.emit('change', { kind: 'reset' });
  res.json(summary);
}));

module.exports = router;
