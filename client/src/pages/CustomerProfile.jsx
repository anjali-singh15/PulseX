import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Building2, MapPin, UserRound, CalendarDays, Mail, Phone, X } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { inr, inrCompact, fmtDate, fmtDateTime, signed, timeAgo } from '../lib/format';
import { eventHeadline } from '../lib/events';
import { stateStyle, churnTone } from '../lib/states';
import { PageSkeleton, ErrorState, StateBadge, SentimentBadge, CardHeader, Tabs, Stat, EmptyState, SourceBadge } from '../components/ui';
import { StateRail, ReasonList, TransitionCard, ChangeList, StateChange } from '../components/StateViz';
import { ChurnFactors, IdentityPanel } from '../components/Insight';
import Timeline, { CategoryFilter } from '../components/Timeline';

function Meter({ label, value, max = 100, tone, suffix = '', note, display }) {
  return (
    <div>
      <div className="flex items-baseline justify-between"><span className="text-[12.5px] text-muted">{label}</span><span className={`font-semibold num ${tone || ''}`}>{display ?? value}{suffix}</span></div>
      <div className="h-1.5 bg-canvas rounded-full mt-1.5 overflow-hidden"><div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div>
      {note && <p className="text-[12px] text-muted mt-1">{note}</p>}
    </div>
  );
}

function JustChanged({ result, onClose }) {
  return (
    <div className={`card p-4 border-2 ${stateStyle(result.after.state).border} animate-rise`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-muted">Just now · {result.label}</p>
          <div className="mt-1.5">{result.stateChanged ? <StateChange from={result.before.state} to={result.after.state} /> : <span className="text-[14px] font-medium">State held at <StateBadge state={result.after.state} /></span>}</div>
        </div>
        <button className="btn-ghost h-8 w-8 px-0" onClick={onClose} aria-label="Dismiss"><X size={15} /></button>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-3">
        <ReasonList reasons={result.transition?.reasons || result.reasons} dense />
        <ChangeList changes={result.changes} />
      </div>
    </div>
  );
}

export default function CustomerProfile() {
  const { id } = useParams();
  const { openEventModal, lastResult, clearLastResult } = useApp();
  const { data, error, initialLoading, reload } = useApi(() => api.customer(id), [id]);
  const [tab, setTab] = useState('overview');
  const [cats, setCats] = useState([]);

  const events = data?.events || [];
  const filteredEvents = useMemo(() => (cats.length ? events.filter((e) => cats.includes(e.category)) : events), [events, cats]);
  const counts = useMemo(() => events.reduce((m, e) => ({ ...m, [e.category]: (m[e.category] || 0) + 1 }), {}), [events]);

  if (initialLoading) return <PageSkeleton />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { customer, transitions, sourceRecords } = data;
  const s = customer.snapshot;
  const m = s.metrics;
  const fresh = lastResult && String(lastResult.customer?._id) === String(customer._id) && Date.now() - lastResult.receivedAt < 10 * 60 * 1000 ? lastResult : null;
  const complaints = events.filter((e) => ['COMPLAINT_RAISED', 'TICKET_OPENED'].includes(e.type));
  const payments = events.filter((e) => ['PAYMENT_RECEIVED', 'PAYMENT_OVERDUE'].includes(e.type));
  const purchases = events.filter((e) => e.type === 'PURCHASE_MADE');
  const comms = events.filter((e) => ['EMAIL', 'WHATSAPP', 'WEBSITE_VISIT'].includes(e.type));
  const primary = customer.contacts?.find((c) => c.primary) || customer.contacts?.[0];

  return (
    <div className="space-y-5">
      <Link to="/customers" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} />Customers</Link>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="page-title">{customer.name}</h1>
              <StateBadge state={s.state} size="lg" />
              {customer.flagship && <span className="text-[12px] text-brand font-medium">Demo account</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{customer.industry} · {customer.segment}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{customer.city}</span>
              <span className="inline-flex items-center gap-1.5"><UserRound size={14} />Owner {customer.accountOwner}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />Customer since {new Date(customer.customerSince).getFullYear()}</span>
            </div>
          </div>
          <button className="btn-primary" onClick={() => openEventModal(customer._id)}><Plus size={16} />Add event</button>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 mt-6">
          <div className="lg:col-span-3">
            <h2 className="text-[13.5px] font-semibold mb-3">Relationship state</h2>
            <StateRail state={s.state} previous={s.previousState} />
            <p className="text-[12.5px] text-muted mt-3">
              {s.previousState && s.previousState !== s.state ? <>Moved from {s.previousState} {timeAgo(s.stateChangedAt)}. </> : null}
              Rule: {s.stateRule}. Risk points {s.riskPoints} (At Risk at 2).
            </p>
          </div>
          <div className="lg:col-span-2 rounded-md bg-[#F8FAF9] border border-line p-4">
            <h2 className="text-[13.5px] font-semibold mb-2">Why {s.state.toLowerCase()}</h2>
            <ReasonList reasons={s.stateReasons} />
          </div>
        </div>
      </div>

      {fresh && <JustChanged result={fresh} onClose={clearLastResult} />}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="card px-4 py-3.5"><div className="kpi-label">Customer lifetime value</div><div className="kpi-value num mt-1">{inrCompact(s.clv.total)}</div><div className="text-[12px] text-muted num">{inrCompact(s.clv.historical)} to date + {inrCompact(s.clv.projected)} projected</div></div>
        <div className="card px-4 py-3.5"><div className="kpi-label">Churn probability</div><div className={`kpi-value num mt-1 ${churnTone(s.churn.probability)}`}>{s.churn.probability}%</div><div className="text-[12px] text-muted">Simulated, rule-based</div></div>
        <div className="card px-4 py-3.5"><div className="kpi-label">Sentiment</div><div className="mt-1.5"><SentimentBadge sentiment={s.sentiment} showScore /></div><div className="text-[12px] text-muted mt-1">Recent messages weighted most</div></div>
        <div className="card px-4 py-3.5"><div className="kpi-label">Engagement</div><div className="kpi-value num mt-1">{s.engagement}<span className="text-[14px] text-muted font-normal">/100</span></div><div className="text-[12px] text-muted">Last 30 days of activity</div></div>
        <div className="card px-4 py-3.5"><div className="kpi-label">Outstanding</div><div className={`kpi-value num mt-1 ${m.overdue ? 'text-atrisk' : ''}`}>{m.outstanding ? inrCompact(m.outstanding) : '₹0'}</div><div className="text-[12px] text-muted num">{m.overdue ? `${inr(m.overdue)} overdue` : 'Nothing overdue'}</div></div>
        <div className="card px-4 py-3.5"><div className="kpi-label">Open complaints</div><div className={`kpi-value num mt-1 ${m.openComplaints ? 'text-atrisk' : ''}`}>{m.openComplaints}</div><div className="text-[12px] text-muted num">{m.complaints90} raised in 90 days</div></div>
      </div>

      <div className="card">
        <div className="px-5 pt-2">
          <Tabs value={tab} onChange={setTab} tabs={[
            { key: 'overview', label: 'Overview' },
            { key: 'timeline', label: 'Timeline', count: events.length },
            { key: 'commercial', label: 'Commercial' },
            { key: 'support', label: 'Support & communication' },
            { key: 'identity', label: 'Identity', count: sourceRecords.length },
          ]} />
        </div>
        <div className="p-5">
          {tab === 'overview' && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="space-y-5">
                <div>
                  <h3 className="text-[13.5px] font-semibold mb-3">Health signals</h3>
                  <div className="space-y-4">
                    <Meter label="Engagement" value={s.engagement} note={`${m.activityPoints} activity points in 30 days`} />
                    <Meter label="Product usage index" value={m.usageIndex} max={120} note={`Trend ${signed(m.usageTrend, '%')} over 45 days`} />
                    <Meter label="Sentiment" value={s.sentiment.score + 100} display={`${s.sentiment.score > 0 ? '+' : ''}${s.sentiment.score}`} max={200} note={`${s.sentiment.label}, score ${s.sentiment.score} on −100 to +100`} />
                  </div>
                </div>
                <div>
                  <h3 className="text-[13.5px] font-semibold mb-2">Company</h3>
                  <dl className="text-[13px] space-y-1">
                    <div className="flex justify-between gap-2"><dt className="text-muted">Company ID (CIN)</dt><dd className="num">{customer.companyId}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted">Domain</dt><dd>{customer.domain}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted">Main line</dt><dd className="num">{customer.phone}</dd></div>
                    {primary && <div className="flex justify-between gap-2"><dt className="text-muted">Primary contact</dt><dd>{primary.name}</dd></div>}
                  </dl>
                </div>
              </div>
              <div>
                <h3 className="text-[13.5px] font-semibold mb-3">Churn explanation</h3>
                <ChurnFactors churn={s.churn} />
              </div>
              <div>
                <h3 className="text-[13.5px] font-semibold mb-3">State history</h3>
                {transitions.length ? <div className="space-y-2.5">{transitions.map((t, i) => <TransitionCard key={t._id} t={t} highlight={i === 0} />)}</div> : <p className="text-[13px] text-muted">No state changes in the recorded history. The account has held {s.state} throughout.</p>}
              </div>
            </div>
          )}

          {tab === 'timeline' && (
            <div className="space-y-3">
              <CategoryFilter categories={Object.keys(counts)} value={cats} onChange={setCats} counts={counts} />
              <Timeline events={filteredEvents} highlightId={fresh?.event?._id} />
            </div>
          )}

          {tab === 'commercial' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Stat label="Historical revenue" value={inrCompact(m.revenue)} />
                  <Stat label="Run rate / year" value={inrCompact(m.runRate)} />
                  <Stat label="Purchases (90 days)" value={m.purchases90} />
                </div>
                <h3 className="text-[13.5px] font-semibold mb-2">Products</h3>
                <div className="border border-line rounded-md divide-y divide-line">
                  {(customer.products || []).map((p) => (
                    <div key={p.name} className="flex items-center justify-between px-3 py-2 text-[13px]">
                      <span><span className="font-medium">{p.name}</span> <span className="text-muted">· {p.plan}</span></span>
                      <span className="num text-muted">{p.activeSeats}/{p.seats} active</span>
                    </div>
                  ))}
                </div>
                <h3 className="text-[13.5px] font-semibold mt-5 mb-2">Opportunities</h3>
                {s.opportunities?.length ? (
                  <div className="border border-line rounded-md divide-y divide-line">
                    {s.opportunities.map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                        <span className="min-w-0 truncate"><span className="font-medium">{o.title}</span> <span className="text-muted">· {o.stage}</span></span>
                        <span className={`num font-medium ${o.status === 'open' ? '' : o.status === 'won' ? 'text-growing' : 'text-muted'}`}>{inrCompact(o.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[13px] text-muted">No opportunities recorded.</p>}
              </div>
              <div>
                <h3 className="text-[13.5px] font-semibold mb-2">Payments</h3>
                <EventTable rows={payments} empty="No payment events." />
                <h3 className="text-[13.5px] font-semibold mt-5 mb-2">Purchases</h3>
                <EventTable rows={purchases} empty="No purchases recorded." />
              </div>
            </div>
          )}

          {tab === 'support' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-[13.5px] font-semibold mb-2">Complaints and tickets</h3>
                <EventTable rows={complaints} empty="No complaints on record." />
                <h3 className="text-[13.5px] font-semibold mt-5 mb-2">Contacts</h3>
                <div className="border border-line rounded-md divide-y divide-line">
                  {(customer.contacts || []).map((c) => (
                    <div key={c.email} className="px-3 py-2 text-[13px]">
                      <div className="font-medium">{c.name} <span className="text-muted font-normal">· {c.role}</span>{c.primary && <span className="text-brand text-[12px] ml-1.5">primary</span>}</div>
                      <div className="text-[12px] text-muted flex flex-wrap gap-x-3"><span className="inline-flex items-center gap-1"><Mail size={12} />{c.email}</span><span className="inline-flex items-center gap-1 num"><Phone size={12} />{c.phone}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[13.5px] font-semibold mb-2">Communication</h3>
                {comms.length ? <Timeline events={comms} limit={20} /> : <EmptyState title="No communication yet" />}
              </div>
            </div>
          )}

          {tab === 'identity' && <IdentityPanel customer={customer} records={sourceRecords} />}
        </div>
      </div>
    </div>
  );
}

function EventTable({ rows, empty }) {
  if (!rows.length) return <p className="text-[13px] text-muted">{empty}</p>;
  return (
    <div className="border border-line rounded-md divide-y divide-line max-h-80 overflow-y-auto">
      {rows.map((e) => (
        <div key={e._id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
          <div className="min-w-0">
            <div className="truncate">{eventHeadline(e)}</div>
            <div className="text-[12px] text-muted flex items-center gap-2">{fmtDate(e.occurredAt)} <SourceBadge source={e.source} /> <span className="num">{e.sourceRef}</span></div>
          </div>
          {e.status && <span className={`text-[12px] font-medium whitespace-nowrap ${['open', 'overdue'].includes(e.status) ? 'text-atrisk' : ['resolved', 'cleared', 'received'].includes(e.status) ? 'text-growing' : 'text-muted'}`} title={e.resolvedAt ? `on ${fmtDateTime(e.resolvedAt)}` : ''}>{e.status}</span>}
        </div>
      ))}
    </div>
  );
}
