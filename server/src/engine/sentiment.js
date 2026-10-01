// Transparent lexicon-based sentiment. No ML: every score lists the words that produced it.

const POSITIVE = {
  thanks: 1, thank: 1, great: 1, happy: 1, excellent: 2, appreciate: 1, appreciated: 1, smooth: 1,
  satisfied: 1, impressed: 1, love: 1, good: 1, quick: 1, helpful: 1, pleased: 1, delighted: 2,
  recommend: 1, fantastic: 2, perfect: 1, perfectly: 1, resolved: 1, resolution: 1, renew: 1,
  renewal: 1, expand: 1, expanding: 1, glad: 1, amazing: 2, reliable: 1, fixed: 1, works: 1, smoothly: 1,
};
const NEGATIVE = {
  disappointed: 2, disappointing: 2, unacceptable: 2, delay: 1, delays: 1, delayed: 1, frustrated: 2,
  frustrating: 2, poor: 1, issue: 1, issues: 1, problem: 1, problems: 1, broken: 1, cancel: 2,
  cancelling: 2, escalate: 1, escalating: 1, escalation: 1, angry: 2, worst: 2, slow: 1, failed: 1,
  failure: 1, failures: 1, refund: 1, unhappy: 2, bad: 1, terrible: 2, outage: 2, error: 1, errors: 1,
  penalty: 1, legal: 2, stopped: 1, down: 1, mismatch: 1, wrong: 1,
};
const PHRASES = [
  ['other vendors', -2], ['looking at alternatives', -2], ['not working', -2], ['no response', -2],
  ['switch vendor', -2], ['well done', 1], ['keep it up', 1], ['on track', 1],
];
const NEGATORS = new Set(['not', 'no', 'never', "isn't", "wasn't", "don't", "didn't", 'hardly']);

function classify(input) {
  const text = String(input || '').toLowerCase();
  let pos = 0;
  let neg = 0;
  const matched = [];
  let rest = text;

  for (const [phrase, weight] of PHRASES) {
    if (rest.includes(phrase)) {
      if (weight > 0) pos += weight; else neg += -weight;
      matched.push({ term: phrase, polarity: weight > 0 ? 1 : -1 });
      rest = rest.split(phrase).join(' ');
    }
  }

  const tokens = rest.replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean);
  tokens.forEach((tok, i) => {
    let polarity = 0;
    let weight = 0;
    if (POSITIVE[tok]) { polarity = 1; weight = POSITIVE[tok]; }
    else if (NEGATIVE[tok]) { polarity = -1; weight = NEGATIVE[tok]; }
    if (!polarity) return;
    const negated = i > 0 && NEGATORS.has(tokens[i - 1]);
    if (negated) polarity = -polarity;
    if (polarity > 0) pos += weight; else neg += weight;
    matched.push({ term: negated ? `${tokens[i - 1]} ${tok}` : tok, polarity });
  });

  const total = pos + neg;
  const raw = total ? (pos - neg) / total : 0;
  const confidence = Math.min(1, 0.5 + total / 6); // more evidence, stronger score
  const score = Math.round(raw * confidence * 100);
  const label = score >= 20 ? 'Positive' : score <= -20 ? 'Negative' : 'Neutral';

  const seen = new Set();
  return {
    label,
    score,
    matched: matched.filter((m) => (seen.has(m.term) ? false : seen.add(m.term))).slice(0, 8),
  };
}

// Sentiment attached to an event when it is created
function sentimentForEvent(type, { title, text, description } = {}) {
  if (type === 'EMAIL' || type === 'WHATSAPP') return classify(`${title || ''} ${text || ''}`);
  if (type === 'COMPLAINT_RAISED') {
    const base = classify(`${title || ''} ${text || description || ''}`);
    return { label: 'Negative', score: Math.min(base.score, -60), matched: base.matched.length ? base.matched : [{ term: 'complaint', polarity: -1 }] };
  }
  if (type === 'TICKET_RESOLVED') return { label: 'Positive', score: 40, matched: [{ term: 'issue resolved', polarity: 1 }] };
  return null;
}

module.exports = { classify, sentimentForEvent };
