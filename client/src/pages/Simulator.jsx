import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, RotateCcw, CheckCircle2, Circle } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { PageSkeleton, ErrorState, StateBadge, CardHeader, Modal, Spinner, ChurnMeter, SentimentBadge, EmptyState } from '../components/ui';
import { StateRail, StateChange } from '../components/StateViz';
import EventForm from '../components/EventForm';
import EventResult from '../components/EventResult';
import { inrCompact, fmtTime } from '../lib/format';

const DEMO = [
  { preset: 'complaint', label: 'Customer raises a complaint', expect: 'Stays Stable, one risk point' },
  { preset: 'payment_overdue', label: 'Invoice of ₹1,20,000 goes overdue', expect: 'Moves to At Risk' },
  { preset: 'negative_email', label: 'Negative email arrives', expect: 'Sentiment turns negative' },
  { preset: 'payment_received', label: 'Overdue payment is received', expect: 'Still At Risk: complaint + sentiment' },
  { preset: 'ticket_resolved', label: 'Complaint is resolved', expect: 'Moves to Recovering' },
];

export default function Simulator() {
  const { meta, recordResult, toast, lastResult } = useApp();
  const customers = useApi(() => api.customers({ sort: 'name' }), []);
  const list = customers.data?.customers || [];
  const flagship = list.find((c) => c.flagship);
  const [customerId, setCustomerId] = useState('');
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);
  const [demoDone, setDemoDone] = useState([]);
  const [running, setRunning] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => { if (!customerId && list.length) setCustomerId((flagship || list[0])._id); }, [list, customerId, flagship]);
  const current = useMemo(() => list.find((c) => c._id === customerId), [list, customerId]);

  const onResult = (r) => {
    setResult(r);
    setLog((l) => [{ ...r, at: Date.now() }, ...l].slice(0, 12));
  };

  const runDemoStep = async (i) => {
    if (!flagship || !meta) return;
    const step = DEMO[i];
    const p = meta.presets.find((x) => x.key === step.preset);
    setRunning(i);
    setCustomerId(flagship._id);
    try {
      const r = await api.addEvent({ customerId: flagship._id, type: p.type, ...p.defaults });
      recordResult(r);
      onResult(r);
      setDemoDone((d) => [...new Set([...d, i])]);
      toast(r.stateChanged ? { tone: ['At Risk', 'Lost'].includes(r.after.state) ? 'bad' : 'good', title: `${r.customer.name}: ${r.before.state} → ${r.after.state}`, body: r.transition?.reasons?.[0]?.text } : { tone: 'info', title: `${r.label} recorded`, body: `Stays ${r.after.state}. Churn ${r.before.churn}% → ${r.after.churn}%.` });
    } catch (e) {
      toast({ tone: 'bad', title: 'Step failed', body: e.message });
    } finally {
      setRunning(null);
    }
  };

  const reset = async () => {
    setResetting(true);
    try {
      await api.importDemo();
      setDemoDone([]); setLog([]); setResult(null);
      toast({ tone: 'good', title: 'Demo data reloaded', body: 'All customers are back to their starting stories.' });
      customers.reload();
    } catch (e) {
      toast({ tone: 'bad', title: 'Reset failed', body: e.message });
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  if (customers.initialLoading) return <PageSkeleton />;
  if (customers.error && !customers.data) return <ErrorState error={customers.error} onRetry={customers.reload} />;
  const nextStep = DEMO.findIndex((_, i) => !demoDone.includes(i));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Event simulator</h1>
          <p className="page-sub">Send an event as if it arrived from a source system. It is saved, the customer’s full history is replayed through the rule engine, and every view updates without a refresh.</p>
        </div>
        <button className="btn-secondary" onClick={() => setConfirmReset(true)}><RotateCcw size={15} />Reset demo data</button>
      </div>

      <div className="grid xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 space-y-4">
          <div className="card">
            <CardHeader title="Compose an event" sub="Pick a customer and an event preset, adjust the details, then add it." />
            <div className="px-5 pb-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="label" htmlFor="sim-customer">Customer</label>
                  <select id="sim-customer" className="input" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setResult(null); }}>
                    {list.map((c) => <option key={c._id} value={c._id}>{c.name}{c.flagship ? ' (demo account)' : ''}</option>)}
                  </select>
                </div>
                {current && (
                  <div className="flex items-center gap-3 text-[13px]">
                    <StateBadge state={current.state} />
                    <ChurnMeter value={current.churn} compact />
                    <SentimentBadge sentiment={current.sentiment} />
                  </div>
                )}
              </div>
              {current && <div className="rounded-md border border-line p-4"><StateRail state={current.state} previous={current.previousState} /></div>}
              {customerId && <EventForm key={customerId} customers={list} customerId={customerId} onResult={onResult} />}
            </div>
          </div>

          <div className="card">
            <CardHeader title="Result" sub="What the engine changed and why" />
            <div className="px-5 pb-5">
              {result ? <EventResult result={result} /> : <EmptyState title="No event sent yet">Add an event above or run the guided demo to see the state change explained.</EmptyState>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <CardHeader title="Guided demo" sub={flagship ? `${flagship.name}: from Stable to At Risk and back` : 'Demo account not found'} />
            <ol className="px-5 pb-5 space-y-2">
              {DEMO.map((s, i) => {
                const done = demoDone.includes(i);
                const isNext = i === nextStep;
                return (
                  <li key={s.preset} className={`rounded-md border p-3 ${isNext ? 'border-brand/40 bg-brand-soft/40' : 'border-line'}`}>
                    <div className="flex items-start gap-2.5">
                      {done ? <CheckCircle2 size={17} className="text-growing mt-0.5 shrink-0" /> : <Circle size={17} className="text-line mt-0.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium">{i + 1}. {s.label}</p>
                        <p className="text-[12px] text-muted">Expected: {s.expect}</p>
                      </div>
                      <button className={isNext ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} disabled={!flagship || running !== null} onClick={() => runDemoStep(i)} aria-label={`Run step ${i + 1}`}>
                        {running === i ? <Spinner className="text-current" /> : <Play size={13} />}{done ? 'Again' : 'Run'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            {flagship && <p className="px-5 pb-4 -mt-2 text-[12.5px]"><Link className="link" to={`/customers/${flagship._id}`}>Open {flagship.name} profile</Link> in another tab to watch it update live.</p>}
          </div>

          <div className="card">
            <CardHeader title="This session" sub="Events you sent" />
            <ul className="px-5 pb-4 divide-y divide-line">
              {log.length ? log.map((r) => (
                <li key={r.event._id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-medium truncate">{r.label}</span>
                    <span className="text-[12px] text-muted">{fmtTime(r.at)}</span>
                  </div>
                  <div className="text-[12px] text-muted mt-1 flex items-center gap-2 flex-wrap">
                    {r.customer.name} · {r.stateChanged ? <StateChange from={r.before.state} to={r.after.state} size="sm" /> : <>stays <StateBadge state={r.after.state} size="sm" /></>} · churn {r.before.churn}% → {r.after.churn}% · CLV {inrCompact(r.after.clv)}
                  </div>
                </li>
              )) : <li className="py-3 text-[13px] text-muted">Nothing sent yet.</li>}
            </ul>
            {lastResult && !log.length && <p className="px-5 pb-4 text-[12px] text-muted">An event was added elsewhere in the app; it’s reflected in the state above.</p>}
          </div>
        </div>
      </div>

      <Modal open={confirmReset} onClose={() => !resetting && setConfirmReset(false)} title="Reset demo data?" width="max-w-md"
        footer={<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setConfirmReset(false)} disabled={resetting}>Cancel</button><button className="btn-danger" onClick={reset} disabled={resetting}>{resetting && <Spinner className="text-white" />}Reset demo data</button></div>}>
        <p className="text-[13.5px]">This deletes every simulated and synced event and rebuilds all 17 customers from their seeded stories. It takes a second.</p>
      </Modal>
    </div>
  );
}
