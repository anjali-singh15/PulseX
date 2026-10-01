const router = require('express').Router();
const { STATES, SOURCES, EVENT_TYPES, CATEGORIES, OPPORTUNITY_STAGES, PRESETS } = require('../engine/catalog');
const { RULES } = require('../engine/rules');

router.get('/', (req, res) => {
  res.json({ states: STATES, sources: SOURCES, eventTypes: EVENT_TYPES, categories: CATEGORIES, stages: OPPORTUNITY_STAGES, presets: PRESETS, thresholds: RULES });
});

module.exports = router;
