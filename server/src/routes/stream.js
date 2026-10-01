// Server-Sent Events: every open dashboard updates the moment an event is processed.
const router = require('express').Router();
const bus = require('../utils/bus');

router.get('/', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ kind: 'hello' })}\n\n`);
  const onChange = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  bus.on('change', onChange);
  req.on('close', () => {
    clearInterval(ping);
    bus.off('change', onChange);
  });
});

module.exports = router;
