// Deterministic identity resolution: explains exactly which signals linked a source record to a customer.
const { RULES } = require('./rules');

const LEGAL_SUFFIXES = new Set(['pvt', 'private', 'ltd', 'limited', 'llp', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'plc', 'the']);
const FREE_MAIL = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'rediffmail.com']);

const normalizeName = (name) => String(name || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter((t) => t && !LEGAL_SUFFIXES.has(t));

function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

// "inds" abbreviates "industries": same first letter and letters appear in order
function isAbbreviation(t, full) {
  if (t === full) return true;
  if (t[0] !== full[0] || t.length < 2 || t.length >= full.length) return false;
  let j = 0;
  for (const ch of full) if (ch === t[j]) j += 1;
  return j === t.length;
}

function nameSimilarity(recordName, goldenName) {
  const a = normalizeName(recordName);
  const b = normalizeName(goldenName);
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((t) => B.has(t)).length;
  const jaccard = inter / new Set([...A, ...B]).size;
  const containment = inter / B.size; // how much of the golden name appears in the record
  const s1 = a.join(' ');
  const s2 = b.join(' ');
  const edit = 1 - levenshtein(s1, s2) / Math.max(s1.length, s2.length);
  // abbreviations such as "inds" for "industries"
  const abbrev = a.length === b.length && a.every((t, i) => isAbbreviation(t, b[i])) ? 0.9 : 0;
  return Math.max(jaccard, containment * (A.size <= B.size + 2 ? 1 : 0.85), edit, abbrev);
}

const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const domainOf = (email) => String(email || '').split('@')[1]?.toLowerCase() || '';

function scoreCandidate(record, c) {
  const signals = [];
  let score = 0;

  if (record.rawName) {
    // chat handles look like "Rahul - Apex Inds": also compare the part after the dash
    const parts = String(record.rawName).split(/\s+[-–|]\s+/);
    const sim = Math.max(...[record.rawName, parts[parts.length - 1]].map((n) => nameSimilarity(n, c.name)));
    score += 0.4 * sim;
    signals.push({ key: 'name', label: 'Name similarity', matched: sim >= 0.75, value: `${Math.round(sim * 100)}%`, detail: `"${record.rawName}" vs "${c.name}"` });
  }
  if (record.email) {
    const d = domainOf(record.email);
    const contactEmails = (c.contacts || []).map((x) => x.email?.toLowerCase());
    const matched = (!FREE_MAIL.has(d) && d === c.domain) || contactEmails.includes(record.email.toLowerCase());
    if (matched) score += 0.3;
    signals.push({ key: 'email', label: 'Email domain', matched, value: `@${d}`, detail: matched ? `@${d} belongs to ${c.name}` : `@${d} is not linked to ${c.name}` });
  }
  if (record.phone) {
    const p = digits(record.phone);
    const phones = [c.phone, ...(c.contacts || []).map((x) => x.phone)].map(digits);
    const matched = phones.includes(p);
    if (matched) score += 0.3;
    signals.push({ key: 'phone', label: 'Phone', matched, value: record.phone, detail: matched ? 'Matches a known contact number' : 'No known contact uses this number' });
  }
  if (record.companyId) {
    const matched = record.companyId === c.companyId;
    score += matched ? 0.5 : -0.3;
    signals.push({ key: 'companyId', label: 'Company ID (CIN)', matched, value: record.companyId, detail: matched ? 'Exact registry match' : 'Different legal entity' });
  }
  return { score: Math.max(0, Math.min(0.99, score)), signals };
}

function resolveIdentity(record, customers) {
  let best = null;
  for (const c of customers) {
    const r = scoreCandidate(record, c);
    if (!best || r.score > best.score) best = { ...r, customer: c };
  }
  if (!best) return { status: 'unmatched', confidence: 0, signals: [], explanation: 'No customers to match against', customer: null };

  const confidence = Math.round(best.score * 100) / 100;
  const merged = best.score >= RULES.IDENTITY_MERGE_THRESHOLD;
  const matchedLabels = best.signals.filter((s) => s.matched).map((s) => s.label.toLowerCase());
  return {
    status: merged ? 'merged' : 'unmatched',
    confidence,
    signals: best.signals,
    customer: merged ? best.customer : null,
    candidate: best.customer.name,
    explanation: merged
      ? `Linked to ${best.customer.name} on ${matchedLabels.join(', ')} (${Math.round(confidence * 100)}% confidence)`
      : `Kept separate: closest candidate ${best.customer.name} scored ${Math.round(confidence * 100)}%, below the ${Math.round(RULES.IDENTITY_MERGE_THRESHOLD * 100)}% threshold`,
  };
}

module.exports = { resolveIdentity, nameSimilarity, normalizeName };
