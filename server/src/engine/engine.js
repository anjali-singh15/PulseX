/**
 * PulseX relationship engine.
 *
 * A customer's relationship is a pure function of its event history. Events are replayed
 * in time order and, after every event, the engine recalculates metrics, sentiment,
 * engagement, churn probability, CLV and relationship state. Because transitions depend
 * on the previous state (Recovering only follows At Risk or Lost), replaying the full
 * history keeps the result deterministic and auditable.
 */
const { RULES, ACTIVITY_POINTS } = require('./rules');
const { EVENT_TYPES } = require('./catalog');
const { inr, fmtDate, plural } = require('../utils/format');

const DAY = 86400000;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const within = (items, now, days) => items.filter((x) => x.t <= now && now - x.t <= days * DAY);
const sum = (arr, fn = (x) => x) => arr.reduce((s, x) => s + fn(x), 0);

function createAccumulator(customer) {
  return {
    revenue: 0,
    paid: 0,
    outstanding: 0,
    overdueItems: [],
    overdueEvents: [],
    openComplaints: [],
    openTickets: [],
    complaintEvents: [],
    usageIndex: customer.baseUsage ?? 65,
    usageChanges: [],
    sentimentItems: [],
    activity: [],
    purchases: [],
    opportunities: [],
    cancelledAt: null,
    lastPurchaseAt: null,
    state: 'Stable',
    stateSince: null,
    previousState: null,
    recoveringSince: null,
    recoveryReasons: [],
    atRiskFlags: [],
    statuses: {},
  };
}

const overdueTotal = (acc) => sum(acc.overdueItems, (i) => i.remaining);

function applyEvent(acc, ev) {
  const id = String(ev._id);
  const t = new Date(ev.occurredAt).getTime();
  if (ACTIVITY_POINTS[ev.type]) acc.activity.push({ t, pts: ACTIVITY_POINTS[ev.type] });
  if (ev.sentiment && typeof ev.sentiment.score === 'number') {
    acc.sentimentItems.push({ t, score: ev.sentiment.score, weight: ev.type === 'TICKET_RESOLVED' ? 0.5 : 1 });
  }

  switch (ev.type) {
    case 'PURCHASE_MADE':
      acc.revenue += ev.amount;
      acc.outstanding += ev.amount;
      acc.purchases.push({ t, amount: ev.amount });
      acc.lastPurchaseAt = t;
      acc.statuses[id] = { status: 'invoiced' };
      break;
    case 'PAYMENT_RECEIVED': {
      let remaining = ev.amount;
      acc.paid += ev.amount;
      for (const item of acc.overdueItems) {
        if (remaining <= 0) break;
        if (item.remaining <= 0) continue;
        const cleared = Math.min(remaining, item.remaining);
        item.remaining -= cleared;
        remaining -= cleared;
        acc.statuses[item.id] = item.remaining <= 0
          ? { status: 'cleared', resolvedAt: new Date(t) }
          : { status: 'partially paid' };
      }
      acc.outstanding = Math.max(overdueTotal(acc), acc.outstanding - ev.amount);
      acc.statuses[id] = { status: 'received' };
      break;
    }
    case 'PAYMENT_OVERDUE':
      acc.overdueItems.push({ id, remaining: ev.amount, t });
      acc.overdueEvents.push({ t });
      acc.outstanding = Math.max(acc.outstanding, overdueTotal(acc));
      acc.statuses[id] = { status: 'overdue' };
      break;
    case 'COMPLAINT_RAISED':
      acc.openComplaints.push(id);
      acc.complaintEvents.push({ t });
      acc.statuses[id] = { status: 'open' };
      break;
    case 'TICKET_OPENED':
      acc.openTickets.push(id);
      acc.statuses[id] = { status: 'open' };
      break;
    case 'TICKET_RESOLVED': {
      // Resolve the complaint picked by the user, otherwise the oldest open complaint, then the oldest ticket
      let target = null;
      const wanted = ev.resolves ? String(ev.resolves) : null;
      if (wanted) {
        for (const list of [acc.openComplaints, acc.openTickets]) {
          const idx = list.indexOf(wanted);
          if (idx >= 0) { target = list.splice(idx, 1)[0]; break; }
        }
      }
      if (!target) target = acc.openComplaints.shift() || acc.openTickets.shift() || null;
      if (target) acc.statuses[target] = { status: 'resolved', resolvedAt: new Date(t) };
      acc.statuses[id] = { status: target ? 'resolved' : 'nothing open', resolves: target };
      break;
    }
    case 'USAGE_INCREASED':
    case 'USAGE_DECREASED': {
      const pct = (ev.type === 'USAGE_INCREASED' ? 1 : -1) * Math.abs(ev.percent || 0);
      acc.usageIndex = clamp(acc.usageIndex * (1 + pct / 100), 5, 100);
      acc.usageChanges.push({ t, pct });
      break;
    }
    case 'OPPORTUNITY_CREATED':
      acc.opportunities.push({
        id, title: ev.title || 'New opportunity', value: ev.amount || 0,
        stage: ev.stage || 'Qualification', status: 'open', createdAt: new Date(t), updatedAt: new Date(t),
      });
      break;
    case 'OPPORTUNITY_UPDATED': {
      const key = (ev.title || '').trim().toLowerCase();
      const opp = [...acc.opportunities].reverse().find((o) => o.status === 'open' && (!key || o.title.toLowerCase() === key));
      if (opp) {
        if (ev.stage) opp.stage = ev.stage;
        if (ev.amount) opp.value = ev.amount;
        if (opp.stage === 'Closed Won') opp.status = 'won';
        if (opp.stage === 'Closed Lost') opp.status = 'lost';
        opp.updatedAt = new Date(t);
      }
      break;
    }
    case 'CONTRACT_CANCELLED':
      acc.cancelledAt = t;
      break;
    default:
      break;
  }
}

function computeMetrics(acc, now) {
  const R = RULES;
  const overdue = overdueTotal(acc);
  const usageTrend = Math.round(sum(within(acc.usageChanges, now, R.USAGE_WINDOW_DAYS), (c) => c.pct));

  // Recency-weighted sentiment: weight = (position from oldest)^2, so the newest item counts most
  const recent = acc.sentimentItems.slice(-R.SENTIMENT_LOOKBACK).reverse();
  let wSum = 0;
  let sSum = 0;
  recent.forEach((item, i) => {
    const w = (R.SENTIMENT_LOOKBACK - i) ** 2 * item.weight;
    wSum += w;
    sSum += w * item.score;
  });
  const sentimentScore = wSum ? Math.round(sSum / wSum) : 0;
  const sentimentLabel = sentimentScore >= R.SENTIMENT_POSITIVE ? 'Positive'
    : sentimentScore <= R.SENTIMENT_NEGATIVE ? 'Negative' : 'Neutral';

  const activityPoints = sum(within(acc.activity, now, R.ENGAGEMENT_WINDOW_DAYS), (a) => a.pts);
  const engagement = clamp(Math.round(R.ENGAGEMENT_USAGE_WEIGHT * acc.usageIndex + Math.min(R.ENGAGEMENT_ACTIVITY_CAP, activityPoints)), 0, 100);

  const recentDelays = within(acc.overdueEvents, now, R.DELAY_WINDOW_DAYS).length;
  const openOpps = acc.opportunities.filter((o) => o.status === 'open');

  return {
    revenue: acc.revenue,
    paid: acc.paid,
    outstanding: Math.round(acc.outstanding),
    overdue: Math.round(overdue),
    overdueInvoices: acc.overdueItems.filter((i) => i.remaining > 0).length,
    pastDelays: Math.max(0, recentDelays - (overdue > 0 ? 1 : 0)),
    openComplaints: acc.openComplaints.length,
    openTickets: acc.openTickets.length,
    complaints90: within(acc.complaintEvents, now, 90).length,
    usageIndex: Math.round(acc.usageIndex),
    usageTrend,
    sentimentScore,
    sentimentLabel,
    engagement,
    activityPoints,
    purchases90: within(acc.purchases, now, R.PURCHASE_WINDOW_DAYS).length,
    runRate: sum(within(acc.purchases, now, 365), (p) => p.amount),
    lastPurchaseDays: acc.lastPurchaseAt ? Math.floor((now - acc.lastPurchaseAt) / DAY) : null,
    openOpportunities: openOpps.length,
    pipeline: sum(openOpps, (o) => o.value),
  };
}

function riskFlags(m) {
  const R = RULES;
  const flags = [];
  if (m.overdue > 0) flags.push({ key: 'overdue', points: 2, value: m.overdue, text: `${inr(m.overdue)} overdue payment` });
  if (m.openComplaints > 0) flags.push({ key: 'complaints', points: m.openComplaints >= 2 ? 2 : 1, value: m.openComplaints, text: plural(m.openComplaints, 'unresolved complaint') });
  if (m.sentimentLabel === 'Negative') flags.push({ key: 'sentiment', points: 1, value: m.sentimentScore, text: `Negative sentiment detected (score ${m.sentimentScore})` });
  if (m.usageTrend <= R.USAGE_DECLINE_PCT) flags.push({ key: 'usage', points: 1, value: m.usageTrend, text: `Product usage decreased ${Math.abs(m.usageTrend)}% in ${R.USAGE_WINDOW_DAYS} days` });
  if (m.engagement < R.ENGAGEMENT_LOW) flags.push({ key: 'engagement', points: 1, value: m.engagement, text: `Low engagement (score ${m.engagement}/100)` });
  return flags;
}

function growthFlags(m) {
  const R = RULES;
  const flags = [];
  if (m.purchases90 >= R.PURCHASE_FREQUENT) flags.push({ key: 'purchases', text: `${m.purchases90} purchases in the last ${R.PURCHASE_WINDOW_DAYS} days` });
  if (m.usageTrend >= R.USAGE_GROWTH_PCT) flags.push({ key: 'usage', text: `Product usage up ${m.usageTrend}% in ${R.USAGE_WINDOW_DAYS} days` });
  if (m.sentimentLabel === 'Positive') flags.push({ key: 'sentiment', text: `Positive sentiment (score ${m.sentimentScore})` });
  if (m.engagement >= R.ENGAGEMENT_HIGH) flags.push({ key: 'engagement', text: `High engagement (score ${m.engagement}/100)` });
  if (m.openOpportunities > 0) flags.push({ key: 'pipeline', text: `${inr(m.pipeline)} open pipeline in ${plural(m.openOpportunities, 'opportunity', 'opportunities')}` });
  return flags;
}

function churnModel(m, lost) {
  const R = RULES;
  const factors = [{ key: 'baseline', label: 'Baseline', points: R.CHURN_BASELINE, detail: 'Starting risk for every customer' }];
  const add = (key, label, points, detail) => {
    if (points) factors.push({ key, label, points: Math.round(points), detail });
  };

  if (lost) {
    add('contract', 'Contract cancelled', 87, 'Customer cancelled and has not purchased since');
  } else {
    if (m.overdue > 0) {
      add('payments', 'Payment delays', 15 + (m.overdue >= 100000 ? 5 : 0) + Math.min(6, m.pastDelays * 3),
        `${inr(m.overdue)} overdue${m.pastDelays ? `, ${plural(m.pastDelays, 'earlier late payment')}` : ''}`);
    } else if (m.pastDelays) {
      add('payments', 'Payment delays', Math.min(6, m.pastDelays * 3), `${plural(m.pastDelays, 'late payment')} in the last ${R.DELAY_WINDOW_DAYS} days`);
    }
    if (m.openComplaints || m.complaints90 >= 3) {
      add('complaints', 'Complaint frequency', Math.min(16, m.openComplaints * 8) + (m.complaints90 >= 3 ? 5 : 0),
        `${m.openComplaints} open, ${m.complaints90} raised in 90 days`);
    }
    if (m.sentimentScore < 0) add('sentiment', 'Negative sentiment', Math.min(20, Math.round(-m.sentimentScore / 4) + 5), `Sentiment score ${m.sentimentScore}`);
    if (m.usageTrend < 0) add('usage', 'Usage decline', Math.min(15, Math.round(-m.usageTrend * 0.6)), `Usage ${m.usageTrend}% over ${R.USAGE_WINDOW_DAYS} days`);
    if (m.engagement < 50) add('engagement', 'Low engagement', Math.min(15, Math.round((50 - m.engagement) * 0.3)), `Engagement ${m.engagement}/100`);
    if (m.lastPurchaseDays === null || m.lastPurchaseDays > R.PURCHASE_STALE_DAYS) {
      add('purchases', 'Purchase frequency', 8, m.lastPurchaseDays === null ? 'No purchases recorded' : `No purchase in ${m.lastPurchaseDays} days`);
    } else if (m.purchases90 >= R.PURCHASE_FREQUENT) {
      add('purchases', 'Frequent purchases', -5, `${m.purchases90} purchases in ${R.PURCHASE_WINDOW_DAYS} days`);
    }
    if (m.sentimentLabel === 'Positive') add('positive', 'Positive sentiment', -5, `Sentiment score ${m.sentimentScore}`);
    if (m.usageTrend >= R.USAGE_GROWTH_PCT) add('usage_growth', 'Usage growth', -4, `Usage +${m.usageTrend}%`);
  }

  const total = sum(factors, (f) => f.points);
  return {
    probability: lost ? 95 : clamp(total, 2, 97),
    factors: factors.sort((a, b) => b.points - a.points),
    model: 'Explainable rule-based score (simulated for demo)',
  };
}

function clvModel(m, churn, lost) {
  const years = RULES.CLV_YEARS;
  const retention = lost ? 0 : 1 - churn.probability / 100;
  const projected = Math.round(m.runRate * years * retention);
  return { historical: m.revenue, projected, total: m.revenue + projected, runRate: m.runRate, years, retention: Math.round(retention * 100) };
}

function recoveryReasons(atRiskFlags, currentFlags, m) {
  const reasons = [];
  const current = Object.fromEntries(currentFlags.map((f) => [f.key, f]));
  for (const f of atRiskFlags) {
    const cur = current[f.key];
    if (!cur) {
      const text = {
        overdue: `Overdue payment of ${inr(f.value)} cleared`,
        complaints: f.value === 1 ? 'Open complaint resolved' : `All ${f.value} open complaints resolved`,
        sentiment: `Sentiment improved to ${m.sentimentLabel} (score ${m.sentimentScore})`,
        usage: 'Product usage decline has stopped',
        engagement: `Engagement recovered to ${m.engagement}/100`,
      }[f.key];
      reasons.push({ kind: 'recovery', text });
    } else if (cur.points < f.points) {
      reasons.push({ kind: 'recovery', text: `Open complaints reduced from ${f.value} to ${cur.value}` });
    }
  }
  for (const f of currentFlags) reasons.push({ kind: 'watch', text: `Still watching: ${f.text}` });
  return reasons;
}

function decideState(acc, m, risk, growth, now) {
  const R = RULES;
  const prev = acc.state;
  const riskPoints = sum(risk, (f) => f.points);
  const lost = Boolean(acc.cancelledAt && !(acc.lastPurchaseAt > acc.cancelledAt));
  let state;
  let rule;
  let reasons;

  if (lost) {
    state = 'Lost';
    rule = 'Contract cancelled with no purchase since';
    reasons = [{ kind: 'risk', text: `Contract cancelled on ${fmtDate(acc.cancelledAt)}` }, ...risk.map((f) => ({ kind: 'risk', text: f.text }))];
  } else if (riskPoints >= R.AT_RISK_POINTS) {
    state = 'At Risk';
    rule = `Risk points ${riskPoints} ≥ ${R.AT_RISK_POINTS}`;
    reasons = risk.map((f) => ({ kind: 'risk', text: f.text, points: f.points }));
  } else if (prev === 'At Risk' || prev === 'Lost') {
    state = 'Recovering';
    if (prev === 'Lost') {
      rule = 'Win-back purchase after cancellation';
      reasons = [{ kind: 'recovery', text: 'New purchase recorded after the contract was cancelled' }, ...risk.map((f) => ({ kind: 'watch', text: `Still watching: ${f.text}` }))];
    } else {
      rule = `Risk points fell to ${riskPoints}, below ${R.AT_RISK_POINTS}, after being At Risk`;
      reasons = recoveryReasons(acc.atRiskFlags, risk, m);
    }
  } else if (prev === 'Recovering' && (riskPoints > 0 || (now - acc.recoveringSince) / DAY < R.RECOVERY_SETTLE_DAYS)) {
    state = 'Recovering';
    const daysClean = Math.floor((now - acc.recoveringSince) / DAY);
    rule = `Stays Recovering until ${R.RECOVERY_SETTLE_DAYS} days with zero risk points`;
    reasons = [
      ...acc.recoveryReasons.filter((r) => r.kind === 'recovery'),
      ...risk.map((f) => ({ kind: 'watch', text: `Still watching: ${f.text}` })),
      { kind: 'info', text: riskPoints > 0 ? 'Settling period restarts once remaining risks clear' : `${daysClean} of ${R.RECOVERY_SETTLE_DAYS} settling days completed` },
    ];
  } else if (riskPoints === 0 && growth.length >= R.GROWING_POINTS) {
    state = 'Growing';
    rule = `${growth.length} growth signals (≥ ${R.GROWING_POINTS}) and no risk signals`;
    reasons = growth.map((f) => ({ kind: 'growth', text: f.text }));
  } else {
    state = 'Stable';
    rule = riskPoints ? `Risk points ${riskPoints}, below ${R.AT_RISK_POINTS}` : `No risk signals, ${growth.length} of ${R.GROWING_POINTS} growth signals`;
    reasons = [
      ...(risk.length ? risk.map((f) => ({ kind: 'watch', text: `Watch: ${f.text}` })) : [{ kind: 'info', text: 'No active risk signals' }]),
      ...growth.map((f) => ({ kind: 'growth', text: f.text })),
    ];
  }

  // Remember the context later transitions need
  if (state === 'At Risk') acc.atRiskFlags = risk.map((f) => ({ ...f }));
  if (state === 'Recovering' && prev !== 'Recovering') {
    acc.recoveringSince = now;
    acc.recoveryReasons = reasons;
  }
  if (state === 'Recovering' && prev === 'Recovering' && riskPoints > 0) acc.recoveringSince = now;
  if (state !== prev) {
    acc.previousState = prev;
    acc.stateSince = now;
  }
  acc.state = state;
  return { state, rule, reasons, riskPoints, lost };
}

function evaluate(acc, now) {
  const m = computeMetrics(acc, now);
  const risk = riskFlags(m);
  const growth = growthFlags(m);
  const decision = decideState(acc, m, risk, growth, now);
  const churn = churnModel(m, decision.lost);
  const clv = clvModel(m, churn, decision.lost);
  return {
    state: decision.state,
    previousState: acc.previousState,
    stateChangedAt: acc.stateSince ? new Date(acc.stateSince) : null,
    stateRule: decision.rule,
    stateReasons: decision.reasons,
    riskPoints: decision.riskPoints,
    riskFlags: risk,
    growthFlags: growth,
    sentiment: { label: m.sentimentLabel, score: m.sentimentScore },
    engagement: m.engagement,
    churn,
    clv,
    metrics: m,
    opportunities: acc.opportunities.map((o) => ({ ...o })),
    evaluatedAt: new Date(now),
  };
}

function eventLabel(ev) {
  const meta = EVENT_TYPES[ev.type];
  const extra = ev.amount ? ` — ${inr(ev.amount)}` : ev.percent ? ` — ${ev.percent}%` : '';
  return `${meta ? meta.label : ev.type}${extra}`;
}

function buildImpact(ev, stateBefore, prev, snap) {
  const churnDelta = prev ? snap.churn.probability - prev.churn.probability : 0;
  const highlights = [];
  if (stateBefore !== snap.state) highlights.push(`${stateBefore} → ${snap.state}`);
  if (Math.abs(churnDelta) >= 1) highlights.push(`Churn ${churnDelta > 0 ? '+' : ''}${churnDelta} pts`);
  if (prev && prev.sentiment.label !== snap.sentiment.label) highlights.push(`Sentiment now ${snap.sentiment.label}`);
  if (ev.type === 'PURCHASE_MADE') highlights.push(`Revenue +${inr(ev.amount)}`);
  if (ev.type === 'PAYMENT_OVERDUE') highlights.push(`${inr(snap.metrics.overdue)} overdue`);
  if (ev.type === 'PAYMENT_RECEIVED' && prev && prev.metrics.overdue > snap.metrics.overdue) highlights.push(`${inr(prev.metrics.overdue - snap.metrics.overdue)} overdue cleared`);
  if (ev.type === 'COMPLAINT_RAISED' || ev.type === 'TICKET_RESOLVED') highlights.push(`${plural(snap.metrics.openComplaints, 'open complaint')}`);
  if (ev.type.startsWith('USAGE')) highlights.push(`Usage index ${snap.metrics.usageIndex}`);

  let direction = 'neutral';
  if (churnDelta >= 1) direction = 'negative';
  else if (churnDelta <= -1) direction = 'positive';
  else if (ev.sentiment && ev.sentiment.label !== 'Neutral') direction = ev.sentiment.label === 'Positive' ? 'positive' : 'negative';
  else if (EVENT_TYPES[ev.type]) direction = { 1: 'positive', '-1': 'negative', 0: 'neutral' }[EVENT_TYPES[ev.type].polarity];

  return {
    direction,
    stateBefore,
    stateAfter: snap.state,
    stateChanged: stateBefore !== snap.state,
    churnBefore: prev ? prev.churn.probability : null,
    churnAfter: snap.churn.probability,
    churnDelta,
    sentimentAfter: snap.sentiment.score,
    sentimentLabel: snap.sentiment.label,
    engagementAfter: snap.engagement,
    clvAfter: snap.clv.total,
    highlights,
  };
}

function sortEvents(events) {
  return [...events].sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt) || (String(a._id) < String(b._id) ? -1 : 1));
}

function replay(customer, events) {
  const acc = createAccumulator(customer);
  const perEvent = [];
  const transitions = [];
  let prev = null;

  for (const ev of sortEvents(events)) {
    const t = new Date(ev.occurredAt).getTime();
    const stateBefore = acc.state;
    applyEvent(acc, ev);
    const snap = evaluate(acc, t);
    perEvent.push({ id: String(ev._id), impact: buildImpact(ev, stateBefore, prev, snap) });
    if (snap.state !== stateBefore) {
      transitions.push({
        from: stateBefore,
        to: snap.state,
        at: new Date(t),
        rule: snap.stateRule,
        reasons: snap.stateReasons,
        event: ev._id,
        trigger: eventLabel(ev),
        churnBefore: prev ? prev.churn.probability : null,
        churnAfter: snap.churn.probability,
      });
    }
    prev = snap;
  }

  if (!prev) prev = evaluate(acc, Date.now());
  return { snapshot: prev, perEvent, transitions, statuses: acc.statuses };
}

module.exports = { replay, eventLabel, sortEvents };
