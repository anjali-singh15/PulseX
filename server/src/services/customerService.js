const { Customer, Event, StateTransition } = require('../models');
const { replay, eventLabel } = require('../engine/engine');
const { diffSnapshots } = require('../engine/diff');
const { sentimentForEvent } = require('../engine/sentiment');
const { EVENT_TYPES, SOURCES } = require('../engine/catalog');
const { ApiError } = require('../middleware/errors');
const { validateEventInput } = require('./validation');
const bus = require('../utils/bus');

// Summary fields used by lists, cards and the dashboard
function summarize(c) {
  const s = c.snapshot || {};
  const m = s.metrics || {};
  return {
    _id: c._id,
    name: c.name,
    industry: c.industry,
    segment: c.segment,
    city: c.city,
    accountOwner: c.accountOwner,
    flagship: c.flagship,
    state: s.state || 'Stable',
    previousState: s.previousState || null,
    stateChangedAt: s.stateChangedAt || null,
    clv: s.clv?.total || 0,
    churn: s.churn?.probability ?? 0,
    topFactors: (s.churn?.factors || []).filter((f) => f.key !== 'baseline' && f.points > 0).slice(0, 3),
    sentiment: s.sentiment || { label: 'Neutral', score: 0 },
    engagement: s.engagement ?? 0,
    openComplaints: m.openComplaints || 0,
    outstanding: m.outstanding || 0,
    overdue: m.overdue || 0,
    revenue: m.revenue || 0,
    usageTrend: m.usageTrend || 0,
    pipeline: m.pipeline || 0,
    riskPoints: s.riskPoints || 0,
  };
}

/** Replays every event for a customer and persists the snapshot, event impacts and transitions. */
async function recomputeCustomer(customerId) {
  const customer = await Customer.findById(customerId).lean();
  if (!customer) throw new ApiError(404, 'Customer not found');
  const events = await Event.find({ customer: customerId }).lean();
  const result = replay(customer, events);

  await Customer.updateOne({ _id: customerId }, { $set: { snapshot: result.snapshot } });

  const ops = result.perEvent.map((p) => {
    const st = result.statuses[p.id] || {};
    return {
      updateOne: {
        filter: { _id: p.id },
        update: { $set: { impact: p.impact, status: st.status || null, resolvedAt: st.resolvedAt || null } },
      },
    };
  });
  if (ops.length) await Event.bulkWrite(ops, { ordered: false });

  await StateTransition.deleteMany({ customer: customerId });
  if (result.transitions.length) {
    await StateTransition.insertMany(result.transitions.map((t) => ({ ...t, customer: customerId })));
  }
  return { customer: { ...customer, snapshot: result.snapshot }, result };
}

function buildEventDoc(input, origin) {
  const meta = EVENT_TYPES[input.type];
  const n = Math.floor(10000 + Math.random() * 89999);
  return {
    customer: input.customerId,
    type: input.type,
    category: meta.category,
    source: input.source || meta.source,
    sourceRef: input.sourceRef || `${SOURCES[input.source || meta.source].prefix}-${n}`,
    occurredAt: input.occurredAt || new Date(),
    title: input.title || (input.type === 'COMPLAINT_RAISED' ? 'Customer complaint' : undefined),
    description: input.description,
    text: input.text,
    amount: input.amount,
    percent: input.percent,
    severity: input.severity,
    stage: input.stage,
    contact: input.contact,
    resolves: input.resolves,
    sentiment: sentimentForEvent(input.type, input),
    origin,
  };
}

/**
 * The live pipeline: save event → replay → recalculate sentiment, engagement, churn, CLV
 * and state → persist → broadcast → return exactly what changed and why.
 */
async function addEvent(body, origin = 'simulator') {
  const input = validateEventInput(body);
  const customer = await Customer.findById(input.customerId).lean();
  if (!customer) throw new ApiError(404, 'Customer not found');
  const before = customer.snapshot || {};

  const created = await Event.create(buildEventDoc(input, origin));
  const { customer: updated, result } = await recomputeCustomer(customer._id);
  const event = await Event.findById(created._id).lean();
  const transition = result.transitions.find((t) => String(t.event) === String(created._id)) || null;
  const after = updated.snapshot;

  const payload = {
    event,
    label: eventLabel(event),
    customer: summarize(updated),
    before: { state: before.state, churn: before.churn?.probability, sentiment: before.sentiment, engagement: before.engagement, clv: before.clv?.total },
    after: { state: after.state, churn: after.churn.probability, sentiment: after.sentiment, engagement: after.engagement, clv: after.clv.total },
    stateChanged: before.state !== after.state,
    transition: transition && { from: transition.from, to: transition.to, rule: transition.rule, reasons: transition.reasons, at: transition.at },
    reasons: after.stateReasons,
    rule: after.stateRule,
    changes: diffSnapshots(before, after),
  };

  bus.emit('change', { kind: 'event', customerId: String(customer._id), customerName: customer.name, label: payload.label, stateChanged: payload.stateChanged, from: before.state, to: after.state });
  return payload;
}

module.exports = { summarize, recomputeCustomer, addEvent, buildEventDoc };
