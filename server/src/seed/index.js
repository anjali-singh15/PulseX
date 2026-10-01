const { Customer, Event, StateTransition, SourceRecord, DataSource, PendingRecord } = require('../models');
const { SOURCES, EVENT_TYPES } = require('../engine/catalog');
const { sentimentForEvent } = require('../engine/sentiment');
const { resolveIdentity } = require('../engine/identity');
const { recomputeCustomer } = require('../services/customerService');
const T = require('./templates');
const STORIES = require('./customers');

const DAY = 86400000;
const HOUR = 3600000;

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const SHORT = { corporation: 'Corp', industries: 'Inds', services: 'Svcs', technologies: 'Tech', healthcare: 'Health', semiconductors: 'Semicon', financial: 'Fin', projects: 'Proj' };
const shortName = (name) => name.split(' ').map((w) => SHORT[w.toLowerCase()] || w).join(' ');
const mobile = (r) => `+91 9${Math.floor(100000000 + r() * 899999999)}`;
const cin = (r, i) => `U${72000 + i * 37}MH${2005 + (i % 15)}PLC${String(100000 + Math.floor(r() * 899999))}`;

function buildCustomer(story, i) {
  const r = rng(1000 + i * 97);
  const contacts = [0, 1, 2].map((k) => {
    const first = T.firstNames[(i * 3 + k * 7) % T.firstNames.length];
    const last = T.lastNames[(i * 5 + k * 3) % T.lastNames.length];
    return { name: `${first} ${last}`, role: T.roles[(i + k * 2) % T.roles.length], email: `${first.toLowerCase()}.${last.toLowerCase()}@${story.domain}`, phone: mobile(r), primary: k === 0 };
  });
  return {
    name: story.name,
    slug: slugify(story.name),
    companyId: cin(r, i),
    industry: story.industry,
    segment: story.segment,
    city: story.city,
    domain: story.domain,
    phone: `+91 ${20 + (i % 60)} ${Math.floor(20000000 + r() * 79999999)}`,
    accountOwner: T.owners[i % T.owners.length],
    customerSince: new Date(`${story.since}-0${1 + (i % 9)}-15`),
    contacts,
    products: story.products,
    baseUsage: story.baseUsage,
    scenario: story.scenario,
    flagship: Boolean(story.flagship),
  };
}

// The same company as it appears in each source system — deliberately inconsistent
function sourceVariants(c, i) {
  const [primary, second, third] = c.contacts;
  const first = primary.name.split(' ')[0];
  const n = (k) => String(1000 + i * 13 + k);
  return [
    { system: 'CRM', sourceId: `CRM-ACC-${n(1)}`, rawName: c.name, companyId: c.companyId, email: primary.email, phone: primary.phone },
    { system: 'Support', sourceId: `ZD-ORG-${n(2)}`, rawName: shortName(c.name), email: second.email },
    { system: 'Payments', sourceId: `PAY-CUST-${n(3)}`, rawName: `${c.name.toUpperCase()} LTD`, companyId: c.companyId },
    { system: 'Invoices', sourceId: `ERP-${n(4)}`, rawName: `${c.name} Pvt. Ltd.`, companyId: c.companyId, email: `accounts@${c.domain}` },
    { system: 'Email', sourceId: `EML-${n(5)}`, rawName: `${third.name} (${c.name})`, email: third.email },
    { system: 'WhatsApp', sourceId: `WA-${n(6)}`, rawName: `${first} - ${shortName(c.name)}`, phone: primary.phone },
    { system: 'Website', sourceId: `WEB-LEAD-${n(7)}`, rawName: c.name.toLowerCase(), email: `info@${c.domain}` },
    { system: 'Product', sourceId: `WS-${slugify(c.name)}`, rawName: slugify(c.name), email: primary.email },
  ];
}

// Look-alike records that must NOT be merged
const DECOYS = [
  { system: 'Support', sourceId: 'ZD-ORG-9001', rawName: 'Apex Logistics Pvt Ltd', email: 'ops@apexlogistics.co.in', companyId: 'U63090MH2014PTC255512' },
  { system: 'Payments', sourceId: 'PAY-CUST-9002', rawName: 'ACME TOOLS & DIES', companyId: 'U29220TZ2011PTC017331' },
  { system: 'Website', sourceId: 'WEB-LEAD-9003', rawName: 'Orion Travels', email: 'info@oriontravels.com' },
  { system: 'WhatsApp', sourceId: 'WA-9004', rawName: 'Suresh', phone: '+91 9812300451' },
];

// Incremental records waiting in each source, pulled by "Sync now"
function pendingFeed(customers) {
  const by = (name) => customers.find((c) => c.name === name);
  const orion = by('Orion Logistics');
  const kaveri = by('Kaveri Foods');
  const nimbus = by('Nimbus Retail');
  const sapphire = by('Sapphire Telecom');
  const quartz = by('Quartz Semiconductors');
  const vertex = by('Vertex Financial Services');
  const coral = by('Coral Hospitality');
  const lumen = by('Lumen EduTech');
  const zenith = by('Zenith Healthcare');
  return [
    { source: 'Payments', record: { sourceId: 'PAY-TXN-77120', rawName: 'ORION LOGISTICS LIMITED', companyId: orion.companyId }, event: { type: 'PAYMENT_RECEIVED', amount: 240000, description: 'NEFT received against overdue invoice' } },
    { source: 'Support', record: { sourceId: 'ZD-TKT-55310', rawName: 'Kaveri Foods Pvt. Ltd.', email: kaveri.contacts[1].email }, event: { type: 'COMPLAINT_RAISED', title: 'Temperature alerts not triggering', text: 'Cold-room alerts failed overnight and stock was at risk. Please fix urgently.', severity: 'High' } },
    { source: 'Support', record: { sourceId: 'ZD-TKT-55311', rawName: 'Zenith Health', email: zenith.contacts[1].email }, event: { type: 'TICKET_RESOLVED', description: 'Sensor replacement delivered and installed' } },
    { source: 'Email', record: { sourceId: 'EML-88213', rawName: `${nimbus.contacts[2].name}`, email: nimbus.contacts[2].email }, event: { type: 'EMAIL', title: 'Rollout feedback', text: 'Fantastic rollout in the first 10 stores. Store managers are happy, please go ahead with the next wave.' } },
    { source: 'WhatsApp', record: { sourceId: 'WA-66102', rawName: 'Sapphire Tel', phone: sapphire.contacts[0].phone }, event: { type: 'WHATSAPP', text: 'Integration errors again today. Very frustrating, need a call.' } },
    { source: 'Website', record: { sourceId: 'WEB-LEAD-4410', rawName: 'Quartz Semiconductors', email: `procurement@${quartz.domain}` }, event: { type: 'WEBSITE_VISIT', description: 'Requested an enterprise quote for IoT Connect' } },
    { source: 'Invoices', record: { sourceId: 'ERP-INV-30551', rawName: 'Vertex Financial Svcs Ltd', companyId: vertex.companyId }, event: { type: 'PURCHASE_MADE', amount: 720000, description: 'Analytics Add-on — 30 additional licences' } },
    { source: 'CRM', record: { sourceId: 'CRM-OPP-7781', rawName: 'Coral Hospitality', companyId: coral.companyId }, event: { type: 'OPPORTUNITY_CREATED', title: 'Monsoon season upsell', amount: 500000, stage: 'Qualification' } },
    { source: 'Product', record: { sourceId: 'WS-lumen-edutech', rawName: 'lumen-edutech', email: lumen.contacts[0].email }, event: { type: 'USAGE_INCREASED', percent: 12, description: 'New semester onboarding lifted weekly active seats' } },
    { source: 'Payments', record: { sourceId: 'PAY-TXN-77121', rawName: 'Kaveri Foods & Beverages Distributors', email: 'accounts@kaveridistributors.in', companyId: 'U51909KA2014PTC074422' }, event: { type: 'PAYMENT_RECEIVED', amount: 90000, description: 'Payment from unknown payer' } },
  ];
}

async function runSeed({ log = () => {} } = {}) {
  const started = Date.now();
  await Promise.all([Customer, Event, StateTransition, SourceRecord, DataSource, PendingRecord].map((M) => M.deleteMany({})));

  const now = Date.now();
  const customers = await Customer.insertMany(STORIES.map(buildCustomer));
  log(`  ${customers.length} customers`);

  // Source records + identity resolution against the CRM golden records
  const golden = customers.map((c) => c.toObject());
  const records = [];
  customers.forEach((c, i) => {
    for (const v of sourceVariants(c, i)) {
      if (v.system === 'CRM') {
        records.push({ ...v, customer: c._id, resolution: { status: 'golden', confidence: 1, signals: [], explanation: 'System of record: CRM golden record' } });
      } else {
        const { customer, ...decision } = resolveIdentity(v, golden);
        records.push({ ...v, customer: customer?._id || null, resolution: decision, ingestedAt: new Date(now - 200 * DAY) });
      }
    }
  });
  for (const d of DECOYS) {
    const { customer, ...decision } = resolveIdentity(d, golden);
    records.push({ ...d, customer: customer?._id || null, resolution: decision });
  }
  await SourceRecord.insertMany(records);
  log(`  ${records.length} source records (${records.filter((x) => !x.customer).length} kept separate)`);

  // Scripted event histories
  const docs = [];
  const counters = {};
  STORIES.forEach((story, i) => {
    const r = rng(5000 + i * 131);
    const list = [];
    story.build({ add: (daysAgo, type, fields = {}) => list.push({ daysAgo, type, ...fields }) }, r);
    for (const e of list) {
      const meta = EVENT_TYPES[e.type];
      const source = meta.source;
      counters[source] = (counters[source] || 20000) + 1 + Math.floor(r() * 7);
      const { daysAgo, ...fields } = e;
      docs.push({
        ...fields,
        customer: customers[i]._id,
        category: meta.category,
        source,
        sourceRef: `${SOURCES[source].prefix}-${counters[source]}`,
        occurredAt: new Date(now - daysAgo * DAY - Math.floor(r() * 9) * HOUR),
        sentiment: sentimentForEvent(e.type, e),
        origin: 'seed',
      });
    }
  });
  await Event.insertMany(docs);
  log(`  ${docs.length} events`);

  for (const c of customers) await recomputeCustomer(c._id);

  // Source status and incremental feed
  const eventsBySource = docs.reduce((m, d) => ({ ...m, [d.source]: (m[d.source] || 0) + 1 }), {});
  await DataSource.insertMany(Object.entries(SOURCES).map(([key, s]) => ({
    key, name: s.name, description: s.description, status: 'Connected', lastSyncAt: new Date(now - (2 + Object.keys(SOURCES).indexOf(key)) * HOUR),
    recordsImported: records.filter((x) => x.system === key).length, eventsImported: eventsBySource[key] || 0,
    syncHistory: [{ at: new Date(now - 3 * HOUR), records: records.filter((x) => x.system === key).length, events: eventsBySource[key] || 0, note: 'Initial import' }],
  })));
  await PendingRecord.insertMany(pendingFeed(golden).map((p, order) => ({ ...p, order })));

  const states = await Customer.aggregate([{ $group: { _id: '$snapshot.state', n: { $sum: 1 } } }]);
  const summary = {
    customers: customers.length,
    events: docs.length,
    sourceRecords: records.length,
    states: Object.fromEntries(states.map((s) => [s._id, s.n])),
    ms: Date.now() - started,
  };
  log(`  states: ${JSON.stringify(summary.states)}`);
  return summary;
}

async function ensureSeeded() {
  const count = await Customer.estimatedDocumentCount();
  if (count > 0) return false;
  console.log('[seed] empty database — loading demo dataset');
  await runSeed({ log: console.log });
  return true;
}

module.exports = { runSeed, ensureSeeded };
