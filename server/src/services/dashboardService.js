const { Customer, Event, StateTransition } = require('../models');
const { STATES } = require('../engine/catalog');
const { RULES } = require('../engine/rules');
const { summarize } = require('./customerService');

const sum = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0);

function monthBuckets(count) {
  const now = new Date();
  const buckets = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short' }), start: d });
  }
  return buckets;
}
const keyOf = (date) => { const d = new Date(date); return `${d.getFullYear()}-${d.getMonth()}`; };

async function getDashboard() {
  const customers = await Customer.find({}, { contacts: 0, products: 0 }).lean();
  const list = customers.map(summarize);
  const months = monthBuckets(6);
  const events = await Event.find(
    { occurredAt: { $gte: months[0].start } },
    { type: 1, amount: 1, occurredAt: 1, category: 1, 'impact.engagementAfter': 1 },
  ).lean();

  const series = Object.fromEntries(months.map((m) => [m.key, {
    month: m.label, revenue: 0, collected: 0, overdue: 0, complaints: 0, resolved: 0,
    email: 0, whatsapp: 0, website: 0, product: 0, engagementSum: 0, engagementN: 0,
  }]));
  for (const ev of events) {
    const b = series[keyOf(ev.occurredAt)];
    if (!b) continue;
    switch (ev.type) {
      case 'PURCHASE_MADE': b.revenue += ev.amount || 0; break;
      case 'PAYMENT_RECEIVED': b.collected += ev.amount || 0; break;
      case 'PAYMENT_OVERDUE': b.overdue += ev.amount || 0; break;
      case 'COMPLAINT_RAISED': b.complaints += 1; break;
      case 'TICKET_RESOLVED': b.resolved += 1; break;
      case 'EMAIL': b.email += 1; break;
      case 'WHATSAPP': b.whatsapp += 1; break;
      case 'WEBSITE_VISIT': b.website += 1; break;
      case 'USAGE_INCREASED': case 'USAGE_DECREASED': b.product += 1; break;
      default: break;
    }
    if (typeof ev.impact?.engagementAfter === 'number') {
      b.engagementSum += ev.impact.engagementAfter;
      b.engagementN += 1;
    }
  }
  const trends = Object.values(series).map(({ engagementSum, engagementN, ...rest }) => ({
    ...rest,
    engagement: engagementN ? Math.round(engagementSum / engagementN) : null,
    interactions: rest.email + rest.whatsapp + rest.website + rest.product,
  }));

  const transitions = await StateTransition.find().sort({ at: -1 }).limit(8).populate('customer', 'name').lean();

  return {
    generatedAt: new Date(),
    kpis: {
      totalCustomers: list.length,
      byState: Object.fromEntries(STATES.map((s) => [s, list.filter((c) => c.state === s).length])),
      totalClv: sum(list, (c) => c.clv),
      totalRevenue: sum(list, (c) => c.revenue),
      openComplaints: sum(list, (c) => c.openComplaints),
      overdueAmount: sum(list, (c) => c.overdue),
      overdueCustomers: list.filter((c) => c.overdue > 0).length,
      highChurn: list.filter((c) => c.churn >= RULES.HIGH_CHURN && c.state !== 'Lost').length,
      avgChurn: list.length ? Math.round(sum(list, (c) => c.churn) / list.length) : 0,
      pipeline: sum(list, (c) => c.pipeline),
      highChurnThreshold: RULES.HIGH_CHURN,
    },
    stateDistribution: STATES.map((s) => ({
      state: s,
      count: list.filter((c) => c.state === s).length,
      clv: sum(list.filter((c) => c.state === s), (c) => c.clv),
    })),
    trends,
    transitions: transitions.filter((t) => t.customer).map((t) => ({
      _id: t._id, customerId: t.customer._id, customerName: t.customer.name, from: t.from, to: t.to, at: t.at, trigger: t.trigger,
      reason: (t.reasons || [])[0]?.text,
    })),
    customers: list.sort((a, b) => b.churn - a.churn),
  };
}

module.exports = { getDashboard };
