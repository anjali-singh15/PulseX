// Every threshold used by the intelligence engine lives here, and the same numbers
// generate the human-readable rulebook shown on the Risk & Insights page.

const RULES = {
  AT_RISK_POINTS: 2,
  GROWING_POINTS: 3,
  RECOVERY_SETTLE_DAYS: 30,

  SENTIMENT_LOOKBACK: 6,
  SENTIMENT_POSITIVE: 20,
  SENTIMENT_NEGATIVE: -10,

  ENGAGEMENT_WINDOW_DAYS: 30,
  ENGAGEMENT_USAGE_WEIGHT: 0.3,
  ENGAGEMENT_ACTIVITY_CAP: 70,
  ENGAGEMENT_LOW: 35,
  ENGAGEMENT_HIGH: 75,

  USAGE_WINDOW_DAYS: 45,
  USAGE_DECLINE_PCT: -10,
  USAGE_GROWTH_PCT: 10,

  PURCHASE_WINDOW_DAYS: 90,
  PURCHASE_FREQUENT: 3,
  PURCHASE_STALE_DAYS: 120,
  DELAY_WINDOW_DAYS: 180,

  CHURN_BASELINE: 8,
  HIGH_CHURN: 60,
  CLV_YEARS: 3,
  IDENTITY_MERGE_THRESHOLD: 0.6,
};

// Engagement points each interaction adds inside the 30-day window
const ACTIVITY_POINTS = {
  PURCHASE_MADE: 12, OPPORTUNITY_CREATED: 10, EMAIL: 8, WHATSAPP: 7, USAGE_INCREASED: 8,
  OPPORTUNITY_UPDATED: 6, WEBSITE_VISIT: 5, PAYMENT_RECEIVED: 4, TICKET_RESOLVED: 3,
  TICKET_OPENED: 3, COMPLAINT_RAISED: 2,
};

function ruleBook() {
  const R = RULES;
  return {
    stateRules: [
      { to: 'Lost', when: 'A contract cancellation is recorded and no purchase has followed it.' },
      { to: 'At Risk', when: `Risk points reach ${R.AT_RISK_POINTS} or more, from any state.` },
      { to: 'Recovering', when: `The customer was At Risk or Lost and risk points fall below ${R.AT_RISK_POINTS}. Leaving Lost also needs a new purchase.` },
      { to: 'Stable or Growing', when: `A Recovering customer has had zero risk points for ${R.RECOVERY_SETTLE_DAYS} days.` },
      { to: 'Growing', when: `Zero risk points and at least ${R.GROWING_POINTS} growth signals.` },
      { to: 'Stable', when: 'Everything else: at most one minor risk point and too few growth signals.' },
    ],
    riskSignals: [
      { key: 'overdue', label: 'Overdue payment', points: '2', when: 'Any invoice amount is past due' },
      { key: 'complaints', label: 'Unresolved complaints', points: '1 for one, 2 for two or more', when: 'Complaints not yet resolved' },
      { key: 'sentiment', label: 'Negative sentiment', points: '1', when: `Weighted sentiment score at or below ${R.SENTIMENT_NEGATIVE}` },
      { key: 'usage', label: 'Usage decline', points: '1', when: `Usage change over ${R.USAGE_WINDOW_DAYS} days at or below ${R.USAGE_DECLINE_PCT}%` },
      { key: 'engagement', label: 'Low engagement', points: '1', when: `Engagement score below ${R.ENGAGEMENT_LOW}` },
    ],
    growthSignals: [
      { key: 'purchases', label: 'Frequent purchases', when: `${R.PURCHASE_FREQUENT} or more purchases in ${R.PURCHASE_WINDOW_DAYS} days` },
      { key: 'usage', label: 'Usage growth', when: `Usage up ${R.USAGE_GROWTH_PCT}% or more over ${R.USAGE_WINDOW_DAYS} days` },
      { key: 'sentiment', label: 'Positive sentiment', when: `Sentiment score at or above ${R.SENTIMENT_POSITIVE}` },
      { key: 'engagement', label: 'High engagement', when: `Engagement score at or above ${R.ENGAGEMENT_HIGH}` },
      { key: 'pipeline', label: 'Open pipeline', when: 'At least one open opportunity' },
    ],
    churnModel: [
      { factor: 'Baseline', points: `+${R.CHURN_BASELINE}`, detail: 'Every customer starts here' },
      { factor: 'Payment delays', points: '+15 if overdue now (+5 more at ₹1,00,000 or above), +3 per earlier late payment in 180 days (max +6)', detail: 'Payments ledger' },
      { factor: 'Complaint frequency', points: '+8 per open complaint (max +16), +5 if 3 or more raised in 90 days', detail: 'Support desk' },
      { factor: 'Negative sentiment', points: '+5 plus a quarter of the negative score (max +20)', detail: 'Emails, WhatsApp, complaints' },
      { factor: 'Usage decline', points: '0.6 × % decline over 45 days (max +15)', detail: 'Product telemetry' },
      { factor: 'Low engagement', points: '0.3 × points below 50 (max +15)', detail: 'All interactions in 30 days' },
      { factor: 'Purchase frequency', points: `+8 if no purchase in ${R.PURCHASE_STALE_DAYS} days, −5 if purchasing frequently`, detail: 'Invoicing' },
      { factor: 'Protective signals', points: '−5 positive sentiment, −4 usage growth', detail: 'Reduce risk' },
    ],
    formulas: {
      churn: 'Churn probability = baseline + contributing factors, clamped to 2–97%. A cancelled contract sets it to 95%.',
      clv: `CLV = historical revenue + projected value. Projected value = revenue in the last 12 months × ${R.CLV_YEARS} years × (1 − churn probability).`,
      sentiment: `Each message is scored with a keyword lexicon (positive and negative words, negations and phrases). The customer score is a recency-weighted average of the last ${R.SENTIMENT_LOOKBACK} messages, complaints and resolutions. ${R.SENTIMENT_POSITIVE} or above is Positive; ${R.SENTIMENT_NEGATIVE} or below is Negative.`,
      engagement: `Engagement = ${R.ENGAGEMENT_USAGE_WEIGHT} × product usage index + interaction points from the last ${R.ENGAGEMENT_WINDOW_DAYS} days (capped at ${R.ENGAGEMENT_ACTIVITY_CAP}).`,
      identity: `Records merge at ${Math.round(R.IDENTITY_MERGE_THRESHOLD * 100)}% confidence: name similarity × 0.4, email domain +0.3, phone +0.3, company ID +0.5. A conflicting company ID subtracts 0.3.`,
    },
    activityPoints: ACTIVITY_POINTS,
  };
}

module.exports = { RULES, ACTIVITY_POINTS, ruleBook };
