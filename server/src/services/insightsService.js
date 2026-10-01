const { Customer, StateTransition } = require('../models');
const { ruleBook, RULES } = require('../engine/rules');
const { summarize } = require('./customerService');

const DAY = 86400000;

async function getInsights() {
  const customers = await Customer.find({}, { contacts: 0, products: 0 }).lean();
  const active = customers.filter((c) => c.snapshot?.state !== 'Lost');

  const drivers = {};
  for (const c of active) {
    for (const f of c.snapshot?.churn?.factors || []) {
      if (f.key === 'baseline' || f.points <= 0) continue;
      drivers[f.label] = drivers[f.label] || { factor: f.label, points: 0, customers: 0 };
      drivers[f.label].points += f.points;
      drivers[f.label].customers += 1;
    }
  }

  const list = customers.map(summarize);
  const atRisk = list.filter((c) => c.state === 'At Risk');
  const since = new Date(Date.now() - 30 * DAY);
  const recent = await StateTransition.find({ at: { $gte: since } }).sort({ at: -1 }).populate('customer', 'name').lean();

  return {
    rules: ruleBook(),
    thresholds: RULES,
    summary: {
      revenueAtRisk: atRisk.reduce((s, c) => s + c.clv, 0),
      atRiskCount: atRisk.length,
      highChurn: list.filter((c) => c.churn >= RULES.HIGH_CHURN && c.state !== 'Lost').length,
      avgChurn: active.length ? Math.round(active.reduce((s, c) => s + (c.snapshot?.churn?.probability || 0), 0) / active.length) : 0,
      transitions30d: recent.length,
    },
    drivers: Object.values(drivers).sort((a, b) => b.points - a.points),
    leaderboard: list.filter((c) => c.state !== 'Lost').sort((a, b) => b.churn - a.churn),
    riskMap: list.map((c) => ({ _id: c._id, name: c.name, churn: c.churn, clv: c.clv, state: c.state })),
    recentTransitions: recent.filter((t) => t.customer).map((t) => ({
      _id: t._id, customerId: t.customer._id, customerName: t.customer.name, from: t.from, to: t.to, at: t.at, trigger: t.trigger, rule: t.rule,
    })),
  };
}

module.exports = { getInsights };
