const { Customer, SourceRecord, DataSource, PendingRecord, Event } = require('../models');
const { resolveIdentity } = require('../engine/identity');
const { SOURCES } = require('../engine/catalog');
const { ApiError } = require('../middleware/errors');
const { addEvent } = require('./customerService');
const bus = require('../utils/bus');

const identityFields = { name: 1, companyId: 1, domain: 1, phone: 1, contacts: 1 };

async function listSources() {
  const [sources, records, events, pending] = await Promise.all([
    DataSource.find().lean(),
    SourceRecord.aggregate([{ $group: { _id: { system: '$system', status: '$resolution.status' }, n: { $sum: 1 } } }]),
    Event.aggregate([{ $group: { _id: '$source', n: { $sum: 1 }, last: { $max: '$occurredAt' } } }]),
    PendingRecord.aggregate([{ $match: { imported: false } }, { $group: { _id: '$source', n: { $sum: 1 } } }]),
  ]);
  const count = (arr, key) => arr.find((x) => x._id === key);
  return Object.keys(SOURCES).map((key) => {
    const src = sources.find((s) => s.key === key) || { key, ...SOURCES[key], status: 'Connected' };
    const recs = records.filter((r) => r._id.system === key);
    return {
      key,
      name: SOURCES[key].name,
      description: SOURCES[key].description,
      status: src.status,
      lastSyncAt: src.lastSyncAt,
      records: recs.reduce((s, r) => s + r.n, 0),
      merged: recs.filter((r) => r._id.status !== 'unmatched').reduce((s, r) => s + r.n, 0),
      unmatched: recs.filter((r) => r._id.status === 'unmatched').reduce((s, r) => s + r.n, 0),
      events: count(events, key)?.n || 0,
      lastEventAt: count(events, key)?.last || null,
      pending: count(pending, key)?.n || 0,
      syncHistory: (src.syncHistory || []).slice(-5).reverse(),
    };
  });
}

/** Pull queued incremental records from one source: resolve identity, then run each through the live pipeline. */
async function syncSource(key) {
  if (!SOURCES[key]) throw new ApiError(404, `Unknown source: ${key}`);
  await DataSource.updateOne({ key }, { $set: { status: 'Syncing' } }, { upsert: true });
  try {
    const items = await PendingRecord.find({ source: key, imported: false }).sort({ order: 1 }).limit(10);
    const customers = await Customer.find({}, identityFields).lean();
    const results = [];

    for (const item of items) {
      const resolution = resolveIdentity(item.record, customers);
      const { customer, ...decision } = resolution;
      await SourceRecord.updateOne(
        { system: key, sourceId: item.record.sourceId },
        { $set: { ...item.record, system: key, customer: customer?._id || null, resolution: decision, ingestedAt: new Date() } },
        { upsert: true },
      );
      let applied = null;
      if (customer) {
        applied = await addEvent({ ...item.event, customerId: String(customer._id), source: key, sourceRef: item.record.sourceId }, 'sync');
      }
      item.imported = true;
      await item.save();
      results.push({
        rawName: item.record.rawName,
        sourceId: item.record.sourceId,
        matchedTo: customer?.name || null,
        confidence: resolution.confidence,
        explanation: resolution.explanation,
        event: applied?.label || null,
        stateChanged: applied?.stateChanged || false,
        from: applied?.before?.state,
        to: applied?.after?.state,
      });
    }

    const eventsImported = results.filter((r) => r.event).length;
    await DataSource.updateOne({ key }, {
      $set: { status: 'Connected', lastSyncAt: new Date() },
      $inc: { recordsImported: results.length, eventsImported },
      $push: { syncHistory: { at: new Date(), records: results.length, events: eventsImported, note: results.length ? 'Incremental sync' : 'No new records' } },
    });
    bus.emit('change', { kind: 'sync', source: key });
    return { source: key, imported: results.length, eventsImported, results };
  } catch (err) {
    await DataSource.updateOne({ key }, { $set: { status: 'Error' } });
    throw err;
  }
}

async function identityOverview() {
  const [customers, records] = await Promise.all([
    Customer.find({}, { name: 1, companyId: 1, domain: 1, 'snapshot.state': 1 }).sort({ name: 1 }).lean(),
    SourceRecord.find().sort({ system: 1 }).lean(),
  ]);
  const clusters = customers.map((c) => ({
    _id: c._id,
    name: c.name,
    companyId: c.companyId,
    domain: c.domain,
    state: c.snapshot?.state,
    records: records.filter((r) => String(r.customer) === String(c._id)),
  }));
  const unmatched = records.filter((r) => !r.customer);
  const merged = records.length - unmatched.length;
  return { clusters, unmatched, totals: { records: records.length, merged, unmatched: unmatched.length, customers: customers.length } };
}

module.exports = { listSources, syncSource, identityOverview };
