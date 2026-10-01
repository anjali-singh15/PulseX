/**
 * Seeded demo portfolio. Each customer has a scripted story (days ago → event) so the
 * dashboard, charts and state transitions tell a meaningful story. The engine, not this
 * file, decides the resulting states.
 */
const T = require('./templates');

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const roundK = (n) => Math.round(n / 1000) * 1000;

function commerce(b, r, { from, to = 1, every, amount, payDelay = 18, unpaid = [] }) {
  const purchases = [];
  for (let d = from; d >= to; d -= every) {
    const amt = roundK(amount * (0.85 + r() * 0.3));
    purchases.push({ d, amt });
    b.add(d, 'PURCHASE_MADE', { amount: amt, description: pick(r, T.purchases) });
    const payDay = d - payDelay;
    if (payDay >= 1 && !unpaid.includes(d)) b.add(payDay, 'PAYMENT_RECEIVED', { amount: amt, description: 'Payment received against invoice' });
  }
  return purchases;
}

function comms(b, r, { from, to = 1, every, tone }) {
  let i = 0;
  for (let d = from; d >= to; d -= every) {
    let t = tone;
    if (tone === 'positive') t = r() < 0.3 ? 'neutral' : 'positive';
    if (tone === 'mixed') t = r() < 0.5 ? 'neutral' : 'positive';
    const channel = i % 3 === 2 ? 'WHATSAPP' : 'EMAIL';
    const text = pick(r, channel === 'EMAIL' ? T.email[t] : T.whatsapp[t]);
    b.add(d, channel, { text, title: channel === 'EMAIL' ? (t === 'negative' ? 'Escalation' : t === 'positive' ? 'Feedback' : 'Account update') : undefined });
    i += 1;
  }
}

function web(b, r, { from, to = 1, every }) {
  for (let d = from; d >= to; d -= every) b.add(d, 'WEBSITE_VISIT', { description: pick(r, T.web) });
}

function complaint(b, r, d, idx) {
  const [title, text] = idx === undefined ? pick(r, T.complaints) : T.complaints[idx];
  b.add(d, 'COMPLAINT_RAISED', { title, text, severity: r() < 0.5 ? 'High' : 'Medium' });
}
const resolve = (b, d, description = 'Resolved and confirmed by customer') => b.add(d, 'TICKET_RESOLVED', { description });
const usage = (b, list) => list.forEach(([d, pct]) => b.add(d, pct > 0 ? 'USAGE_INCREASED' : 'USAGE_DECREASED', {
  percent: Math.abs(pct),
  description: pct > 0 ? 'Weekly active seats increased' : 'Weekly active seats declined',
}));
const say = (b, d, channel, tone, text) => b.add(d, channel, { text, title: channel === 'EMAIL' ? (tone === 'negative' ? 'Escalation' : 'Feedback') : undefined });

const PRODUCTS = {
  core: (seats, active) => ({ name: 'Core Platform', plan: 'Enterprise', seats, activeSeats: active }),
  analytics: (seats, active) => ({ name: 'Analytics Add-on', plan: 'Pro', seats, activeSeats: active }),
  iot: (seats, active) => ({ name: 'IoT Connect', plan: 'Gateways', seats, activeSeats: active }),
  support: () => ({ name: 'Premium Support', plan: '24×7', seats: 1, activeSeats: 1 }),
};

module.exports = [
  {
    name: 'Apex Industries', industry: 'Industrial manufacturing', segment: 'Enterprise', city: 'Pune', domain: 'apexindustries.in',
    since: 2019, baseUsage: 72, flagship: true,
    scenario: 'Flagship demo account: high-value, stable, one open opportunity, positive history',
    products: [PRODUCTS.core(180, 152), PRODUCTS.analytics(40, 34), PRODUCTS.iot(64, 60), PRODUCTS.support()],
    build(b, r) {
      commerce(b, r, { from: 200, every: 60, amount: 1150000 });
      comms(b, r, { from: 190, to: 35, every: 22, tone: 'positive' });
      web(b, r, { from: 180, every: 40 });
      usage(b, [[120, 5], [38, 3]]);
      complaint(b, r, 150, 4);
      resolve(b, 146);
      b.add(28, 'OPPORTUNITY_CREATED', { title: 'Line 3 expansion — IoT Connect', amount: 1400000, stage: 'Proposal' });
      b.add(10, 'OPPORTUNITY_UPDATED', { title: 'Line 3 expansion — IoT Connect', stage: 'Negotiation' });
      say(b, 3, 'EMAIL', 'positive', 'Thanks for the detailed proposal. The plant team is happy with the pilot results, let us finalise next week.');
    },
  },
  {
    name: 'Nimbus Retail', industry: 'Retail chain', segment: 'Enterprise', city: 'Bengaluru', domain: 'nimbusretail.in',
    since: 2021, baseUsage: 70, scenario: 'Healthy, growing account with rising usage and frequent orders',
    products: [PRODUCTS.core(240, 221), PRODUCTS.analytics(60, 58)],
    build(b, r) {
      commerce(b, r, { from: 200, every: 24, amount: 520000 });
      comms(b, r, { from: 195, to: 2, every: 9, tone: 'positive' });
      web(b, r, { from: 190, every: 10 });
      usage(b, [[90, 5], [38, 6], [22, 5], [6, 4]]);
      b.add(18, 'OPPORTUNITY_CREATED', { title: '40 new stores rollout', amount: 2200000, stage: 'Proposal' });
    },
  },
  {
    name: 'Kaveri Foods', industry: 'Food processing', segment: 'Mid-market', city: 'Mysuru', domain: 'kaverifoods.com',
    since: 2020, baseUsage: 64, scenario: 'Steady, stable customer',
    products: [PRODUCTS.core(60, 48), PRODUCTS.support()],
    build(b, r) {
      commerce(b, r, { from: 190, every: 55, amount: 380000 });
      comms(b, r, { from: 185, to: 3, every: 15, tone: 'mixed' });
      web(b, r, { from: 170, every: 30 });
    },
  },
  {
    name: 'Orion Logistics', industry: 'Logistics', segment: 'Enterprise', city: 'Mumbai', domain: 'orionlogistics.co.in',
    since: 2020, baseUsage: 66, scenario: 'Overdue payment plus declining usage',
    products: [PRODUCTS.core(120, 88), PRODUCTS.iot(200, 150)],
    build(b, r) {
      commerce(b, r, { from: 200, to: 38, every: 40, amount: 480000, unpaid: [40] });
      b.add(112, 'PAYMENT_OVERDUE', { amount: 150000, description: 'Invoice 21 days past due' });
      b.add(101, 'PAYMENT_RECEIVED', { amount: 150000, description: 'Late payment received' });
      comms(b, r, { from: 190, to: 4, every: 14, tone: 'neutral' });
      web(b, r, { from: 150, every: 35 });
      usage(b, [[30, -8], [14, -7]]);
      b.add(11, 'PAYMENT_OVERDUE', { amount: 240000, description: 'Invoice 30 days past due date' });
    },
  },
  {
    name: 'Zenith Healthcare', industry: 'Hospitals', segment: 'Enterprise', city: 'Hyderabad', domain: 'zenithhealth.in',
    since: 2018, baseUsage: 68, scenario: 'Multiple unresolved complaints',
    products: [PRODUCTS.core(300, 240), PRODUCTS.analytics(50, 31), PRODUCTS.support()],
    build(b, r) {
      commerce(b, r, { from: 195, every: 45, amount: 620000 });
      comms(b, r, { from: 190, to: 36, every: 13, tone: 'mixed' });
      web(b, r, { from: 180, every: 30 });
      complaint(b, r, 92, 1);
      resolve(b, 85);
      complaint(b, r, 30, 2);
      b.add(25, 'TICKET_OPENED', { title: 'How to export audit logs' });
      complaint(b, r, 18, 3);
      say(b, 14, 'EMAIL', 'neutral', 'Following up on the two open tickets. Please share an ETA.');
      complaint(b, r, 7, 0);
      say(b, 5, 'WHATSAPP', 'negative', 'Still no response on the ticket. Very frustrating.');
    },
  },
  {
    name: 'Sapphire Telecom', industry: 'Telecom', segment: 'Mid-market', city: 'Chennai', domain: 'sapphiretel.com',
    since: 2021, baseUsage: 45, scenario: 'Negative sentiment and low engagement',
    products: [PRODUCTS.core(90, 41)],
    build(b, r) {
      commerce(b, r, { from: 200, every: 70, amount: 350000 });
      comms(b, r, { from: 180, to: 75, every: 24, tone: 'neutral' });
      say(b, 41, 'EMAIL', 'negative', 'Poor response time again. We are looking at alternatives for next year.');
      say(b, 22, 'EMAIL', 'negative', 'The ERP integration is still not working and this is causing issues for our finance team.');
      say(b, 6, 'EMAIL', 'negative', 'Disappointed with the service this month. We are escalating this internally.');
    },
  },
  {
    name: 'Meridian Pharma', industry: 'Pharmaceuticals', segment: 'Enterprise', city: 'Ahmedabad', domain: 'meridianpharma.com',
    since: 2019, baseUsage: 70, scenario: 'Recovering after clearing overdue payment and resolving complaints',
    products: [PRODUCTS.core(150, 131), PRODUCTS.analytics(30, 27), PRODUCTS.support()],
    build(b, r) {
      commerce(b, r, { from: 200, every: 45, amount: 700000 });
      comms(b, r, { from: 195, to: 55, every: 14, tone: 'mixed' });
      web(b, r, { from: 190, every: 28 });
      b.add(50, 'PAYMENT_OVERDUE', { amount: 180000, description: 'Invoice 30 days past due date' });
      complaint(b, r, 46, 5);
      say(b, 44, 'EMAIL', 'negative', 'Invoices keep showing the wrong amounts. This is unacceptable.');
      complaint(b, r, 40, 1);
      b.add(16, 'PAYMENT_RECEIVED', { amount: 180000, description: 'Overdue invoice cleared' });
      resolve(b, 13, 'Configuration rolled back and verified on site');
      resolve(b, 10, 'Credit note issued for billing discrepancy');
      say(b, 8, 'EMAIL', 'positive', 'Thank you for resolving both issues quickly. Appreciate the support from your team.');
      say(b, 4, 'WHATSAPP', 'positive', 'Thanks, the fix works perfectly.');
    },
  },
  {
    name: 'Titan Infra Projects', industry: 'Infrastructure', segment: 'Enterprise', city: 'Delhi NCR', domain: 'titaninfra.in',
    since: 2017, baseUsage: 74, scenario: 'Highest-value account, now at risk',
    products: [PRODUCTS.core(420, 330), PRODUCTS.iot(500, 410), PRODUCTS.analytics(80, 55), PRODUCTS.support()],
    build(b, r) {
      commerce(b, r, { from: 200, every: 45, amount: 3200000, unpaid: [20] });
      comms(b, r, { from: 195, to: 30, every: 12, tone: 'mixed' });
      web(b, r, { from: 180, every: 22 });
      complaint(b, r, 24, 5);
      usage(b, [[20, -12]]);
      say(b, 15, 'EMAIL', 'negative', 'We are frustrated with the repeated delays in ticket responses.');
      complaint(b, r, 11, 3);
      b.add(8, 'PAYMENT_OVERDUE', { amount: 650000, description: 'Milestone invoice 45 days past due' });
      say(b, 5, 'EMAIL', 'negative', 'Disappointed with the service this month. We are escalating this internally.');
    },
  },
  {
    name: 'Lumen EduTech', industry: 'Education technology', segment: 'Mid-market', city: 'Kochi', domain: 'lumenedu.in',
    since: 2022, baseUsage: 70, scenario: 'Product usage declining month over month',
    products: [PRODUCTS.core(200, 96)],
    build(b, r) {
      commerce(b, r, { from: 190, every: 70, amount: 280000 });
      comms(b, r, { from: 180, to: 30, every: 25, tone: 'neutral' });
      web(b, r, { from: 170, to: 60, every: 30 });
      usage(b, [[80, -4], [42, -9], [26, -11], [9, -10]]);
    },
  },
  {
    name: 'Vertex Financial Services', industry: 'Financial services', segment: 'Enterprise', city: 'Mumbai', domain: 'vertexfin.com',
    since: 2020, baseUsage: 75, scenario: 'Growing: expanding seats and strong advocacy',
    products: [PRODUCTS.core(260, 244), PRODUCTS.analytics(90, 86), PRODUCTS.support()],
    build(b, r) {
      commerce(b, r, { from: 198, every: 26, amount: 450000 });
      comms(b, r, { from: 190, to: 2, every: 8, tone: 'positive' });
      web(b, r, { from: 185, every: 12 });
      usage(b, [[40, 5], [20, 8]]);
      b.add(15, 'OPPORTUNITY_CREATED', { title: 'Wealth division onboarding', amount: 1800000, stage: 'Qualification' });
    },
  },
  {
    name: 'Coral Hospitality', industry: 'Hotels & resorts', segment: 'Mid-market', city: 'Goa', domain: 'coralhotels.in',
    since: 2021, baseUsage: 62, scenario: 'Stable, seasonal buyer',
    products: [PRODUCTS.core(70, 55)],
    build(b, r) {
      commerce(b, r, { from: 195, every: 50, amount: 260000 });
      comms(b, r, { from: 190, to: 2, every: 13, tone: 'mixed' });
      web(b, r, { from: 180, every: 20 });
    },
  },
  {
    name: 'Horizon Motors', industry: 'Automotive dealership', segment: 'Mid-market', city: 'Jaipur', domain: 'horizonmotors.in',
    since: 2019, baseUsage: 60, scenario: 'Lost: cancelled after unresolved issues',
    products: [PRODUCTS.core(80, 12)],
    build(b, r) {
      commerce(b, r, { from: 200, to: 90, every: 45, amount: 300000 });
      comms(b, r, { from: 195, to: 115, every: 15, tone: 'neutral' });
      complaint(b, r, 110, 3);
      b.add(100, 'PAYMENT_OVERDUE', { amount: 310000, description: 'Invoice 30 days past due date' });
      complaint(b, r, 95, 2);
      say(b, 92, 'EMAIL', 'negative', 'Very unhappy with the delays. We are looking at alternatives for next year.');
      usage(b, [[85, -15], [60, -12]]);
      say(b, 70, 'EMAIL', 'negative', 'We will cancel the subscription at the end of this term.');
      b.add(52, 'PAYMENT_RECEIVED', { amount: 310000, description: 'Final settlement' });
      b.add(38, 'CONTRACT_CANCELLED', { description: 'Termination notice received from customer' });
    },
  },
  {
    name: 'Banyan Agritech', industry: 'Agritech', segment: 'SMB', city: 'Nagpur', domain: 'banyanagri.com',
    since: 2022, baseUsage: 66, scenario: 'Stable with one open complaint to watch',
    products: [PRODUCTS.core(40, 33), PRODUCTS.iot(30, 26)],
    build(b, r) {
      commerce(b, r, { from: 185, every: 50, amount: 210000 });
      comms(b, r, { from: 180, to: 12, every: 14, tone: 'positive' });
      web(b, r, { from: 170, every: 25 });
      complaint(b, r, 6, 0);
      say(b, 3, 'WHATSAPP', 'positive', 'Appreciate the quick call, all good from our side.');
    },
  },
  {
    name: 'Quartz Semiconductors', industry: 'Electronics', segment: 'Enterprise', city: 'Hyderabad', domain: 'quartzsemi.com',
    since: 2020, baseUsage: 78, scenario: 'Growing: large repeat orders',
    products: [PRODUCTS.core(320, 301), PRODUCTS.analytics(120, 112), PRODUCTS.iot(150, 144)],
    build(b, r) {
      commerce(b, r, { from: 200, every: 22, amount: 880000 });
      comms(b, r, { from: 195, to: 2, every: 9, tone: 'positive' });
      web(b, r, { from: 190, every: 14 });
      usage(b, [[35, 6], [15, 7]]);
      b.add(24, 'OPPORTUNITY_CREATED', { title: 'Fab 2 analytics rollout', amount: 3500000, stage: 'Negotiation' });
    },
  },
  {
    name: 'Indus Textiles', industry: 'Textiles', segment: 'Mid-market', city: 'Surat', domain: 'industextiles.in',
    since: 2018, baseUsage: 63, scenario: 'Recovering after complaints were resolved',
    products: [PRODUCTS.core(110, 82), PRODUCTS.support()],
    build(b, r) {
      commerce(b, r, { from: 195, every: 50, amount: 340000 });
      comms(b, r, { from: 190, to: 45, every: 15, tone: 'mixed' });
      web(b, r, { from: 180, every: 30 });
      complaint(b, r, 38, 2);
      say(b, 33, 'WHATSAPP', 'negative', 'Data sync failed again today, please escalate.');
      complaint(b, r, 31, 3);
      resolve(b, 9, 'Root cause fixed in sync connector');
      resolve(b, 6, 'Downtime credits applied');
      say(b, 4, 'EMAIL', 'positive', 'Thank you for the quick resolution. Glad the sync is reliable again.');
    },
  },
  {
    name: 'Acme Corporation', industry: 'Engineering services', segment: 'Mid-market', city: 'Coimbatore', domain: 'acmecorp.co.in',
    since: 2021, baseUsage: 65, scenario: 'Identity resolution showcase: same company, different names in every system',
    products: [PRODUCTS.core(75, 61), PRODUCTS.analytics(15, 12)],
    build(b, r) {
      commerce(b, r, { from: 190, every: 55, amount: 320000 });
      comms(b, r, { from: 185, to: 3, every: 14, tone: 'mixed' });
      web(b, r, { from: 175, every: 22 });
    },
  },
  {
    name: 'Peregrine Media', industry: 'Media & publishing', segment: 'SMB', city: 'Kolkata', domain: 'peregrinemedia.in',
    since: 2021, baseUsage: 58, scenario: 'Lost after long usage decline',
    products: [PRODUCTS.core(35, 4)],
    build(b, r) {
      commerce(b, r, { from: 200, to: 120, every: 40, amount: 180000 });
      comms(b, r, { from: 195, to: 90, every: 20, tone: 'neutral' });
      usage(b, [[140, -10], [110, -14], [85, -18]]);
      say(b, 75, 'EMAIL', 'negative', 'Budget cuts mean we will not renew. The tool is too slow for our team.');
      b.add(60, 'CONTRACT_CANCELLED', { description: 'Non-renewal confirmed by customer' });
    },
  },
];
