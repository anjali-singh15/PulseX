const mongoose = require('mongoose');
const { EVENT_TYPES, SOURCES, OPPORTUNITY_STAGES } = require('../engine/catalog');
const { ApiError } = require('../middleware/errors');

const MAX_AMOUNT = 1e10;

// Validates and normalises input for a new customer event. Throws ApiError(400) listing every problem.
function validateEventInput(body = {}) {
  const errors = [];
  const out = {};
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

  if (!body.customerId || !mongoose.isValidObjectId(body.customerId)) errors.push('customerId must be a valid customer id');
  else out.customerId = body.customerId;

  const meta = EVENT_TYPES[body.type];
  if (!meta) errors.push(`type must be one of: ${Object.keys(EVENT_TYPES).join(', ')}`);
  else out.type = body.type;

  if (meta?.amount && body.type !== 'OPPORTUNITY_CREATED') {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) errors.push('amount must be a positive number');
    else out.amount = Math.round(amount);
  } else if (body.amount !== undefined && body.amount !== '' && body.amount !== null) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) errors.push('amount must be zero or a positive number');
    else out.amount = Math.round(amount);
  }

  if (meta?.percent) {
    const percent = Number(body.percent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) errors.push('percent must be between 1 and 100');
    else out.percent = Math.round(percent);
  }

  if (meta?.communication && !str(body.text, 2000)) errors.push('text is required for messages');

  if (body.source !== undefined && !SOURCES[body.source]) errors.push(`source must be one of: ${Object.keys(SOURCES).join(', ')}`);
  if (body.stage !== undefined && body.stage !== '' && !OPPORTUNITY_STAGES.includes(body.stage)) errors.push(`stage must be one of: ${OPPORTUNITY_STAGES.join(', ')}`);
  if (body.severity !== undefined && body.severity !== '' && !['Low', 'Medium', 'High'].includes(body.severity)) errors.push('severity must be Low, Medium or High');
  if (body.resolves !== undefined && body.resolves !== '' && !mongoose.isValidObjectId(body.resolves)) errors.push('resolves must be an event id');

  if (errors.length) throw new ApiError(400, 'Event is not valid', errors);

  Object.assign(out, {
    source: body.source || meta.source,
    title: str(body.title, 200),
    description: str(body.description, 2000),
    text: str(body.text, 2000),
    severity: body.severity || undefined,
    stage: body.stage || undefined,
    contact: str(body.contact, 120),
    resolves: body.resolves || undefined,
    sourceRef: str(body.sourceRef, 60),
  });
  return out;
}

module.exports = { validateEventInput };
