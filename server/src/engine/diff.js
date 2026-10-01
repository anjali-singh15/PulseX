// Describes what changed between two customer snapshots, for the "what changed and why" panel.
const { inr } = require('../utils/format');

const FIELDS = [
  { key: 'state', label: 'Relationship state', get: (s) => s.state, kind: 'state' },
  { key: 'churn', label: 'Churn probability', get: (s) => s.churn?.probability, fmt: (v) => `${v}%`, better: 'down' },
  { key: 'sentiment', label: 'Sentiment', get: (s) => s.sentiment?.score, fmt: (v, s) => `${s.sentiment.label} (${v})`, better: 'up' },
  { key: 'engagement', label: 'Engagement', get: (s) => s.engagement, fmt: (v) => `${v}/100`, better: 'up' },
  { key: 'clv', label: 'Customer lifetime value', get: (s) => s.clv?.total, fmt: inr, better: 'up' },
  { key: 'overdue', label: 'Overdue amount', get: (s) => s.metrics?.overdue, fmt: inr, better: 'down' },
  { key: 'outstanding', label: 'Outstanding', get: (s) => s.metrics?.outstanding, fmt: inr, better: 'down' },
  { key: 'complaints', label: 'Open complaints', get: (s) => s.metrics?.openComplaints, fmt: String, better: 'down' },
  { key: 'usage', label: 'Usage trend (45 days)', get: (s) => s.metrics?.usageTrend, fmt: (v) => `${v > 0 ? '+' : ''}${v}%`, better: 'up' },
  { key: 'pipeline', label: 'Open pipeline', get: (s) => s.metrics?.pipeline, fmt: inr, better: 'up' },
  { key: 'revenue', label: 'Historical revenue', get: (s) => s.metrics?.revenue, fmt: inr, better: 'up' },
];

function diffSnapshots(before, after) {
  if (!before || !before.state) return [];
  const changes = [];
  for (const f of FIELDS) {
    const a = f.get(before);
    const b = f.get(after);
    if (a === undefined || b === undefined || a === b) continue;
    if (f.kind === 'state') {
      changes.push({ key: f.key, label: f.label, before: a, after: b, tone: 'state' });
      continue;
    }
    const up = b > a;
    const tone = (up && f.better === 'up') || (!up && f.better === 'down') ? 'good' : 'bad';
    changes.push({ key: f.key, label: f.label, before: f.fmt(a, before), after: f.fmt(b, after), delta: b - a, tone });
  }
  return changes;
}

module.exports = { diffSnapshots };
