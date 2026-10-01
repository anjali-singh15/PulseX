import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Database, Mail, MessageCircle, FileText, IndianRupee, LifeBuoy, Globe, Activity, DownloadCloud, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { PageSkeleton, ErrorState, CardHeader, Modal, Spinner, StateBadge, SourceBadge, Kpi } from '../components/ui';
import { StateChange } from '../components/StateViz';
import { SignalList, UnmatchedTable } from '../components/Insight';
import { timeAgo } from '../lib/format';

const ICONS = { CRM: Database, Email: Mail, WhatsApp: MessageCircle, Invoices: FileText, Payments: IndianRupee, Support: LifeBuoy, Website: Globe, Product: Activity };
const STATUS = { Connected: 'text-growing', Syncing: 'text-brand', Error: 'text-atrisk' };

export default function DataSources() {
  const { toast } = useApp();
  const sources = useApi(() => api.sources(), []);
  const identity = useApi(() => api.identity(), []);
  const [syncing, setSyncing] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState('');

  const sync = async (key) => {
    setSyncing(key);
    try {
      const r = await api.syncSource(key);
      setSyncResult(r);
      const moved = r.results.filter((x) => x.stateChanged);
      toast({ tone: r.imported ? 'good' : 'info', title: r.imported ? `${key}: ${r.imported} new ${r.imported === 1 ? 'record' : 'records'} imported` : `${key} is up to date`, body: moved.length ? moved.map((x) => `${x.matchedTo}: ${x.from} → ${x.to}`).join(' · ') : undefined });
    } catch (e) {
      toast({ tone: 'bad', title: `${key} sync failed`, body: e.message });
    } finally {
      setSyncing(null);
    }
  };

  const importDemo = async () => {
    setImporting(true);
    try {
      const r = await api.importDemo();
      setSyncResult(null);
      toast({ tone: 'good', title: 'Demo dataset imported', body: `${r.customers} customers, ${r.events} events and ${r.sourceRecords} source records in ${r.ms} ms.` });
    } catch (e) {
      toast({ tone: 'bad', title: 'Import failed', body: e.message });
    } finally {
      setImporting(false);
      setConfirm(false);
    }
  };

  if (sources.initialLoading) return <PageSkeleton />;
  if (sources.error && !sources.data) return <ErrorState error={sources.error} onRetry={sources.reload} />;
  const list = sources.data?.sources || [];
  const totals = identity.data?.totals;
  const pendingTotal = list.reduce((s, x) => s + x.pending, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Data sources</h1>
          <p className="page-sub">Eight systems feed the digital twin. Each sync pulls new records, resolves them to a customer and runs every event through the live pipeline.</p>
        </div>
        <button className="btn-secondary" onClick={() => setConfirm(true)}><DownloadCloud size={15} />Import demo data</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Connected sources" value={list.filter((s) => s.status !== 'Error').length} hint={`of ${list.length}`} />
        <Kpi label="Source records" value={totals?.records ?? '—'} hint="Across all systems" />
        <Kpi label="Merged into customers" value={totals?.merged ?? '—'} hint={totals ? `${Math.round((totals.merged / Math.max(1, totals.records)) * 100)}% resolved` : ''} />
        <Kpi label="Waiting to sync" value={pendingTotal} hint={pendingTotal ? 'New records available' : 'Everything is up to date'} tone={pendingTotal ? 'text-brand' : ''} />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {list.map((s) => {
          const Icon = ICONS[s.key] || Database;
          return (
            <div key={s.key} className="card p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-md bg-brand-soft flex items-center justify-center"><Icon size={17} className="text-brand" /></div>
                  <div>
                    <p className="font-semibold text-[14px]">{s.name}</p>
                    <p className={`text-[12px] font-medium ${STATUS[s.status] || 'text-muted'}`}>● {s.status}</p>
                  </div>
                </div>
                {s.pending > 0 && <span className="text-[11.5px] font-medium bg-brand text-white rounded-full px-2 py-0.5 num">{s.pending} new</span>}
              </div>
              <p className="text-[12.5px] text-muted mt-2">{s.description}</p>
              <dl className="grid grid-cols-3 gap-2 mt-3 text-[12.5px]">
                <div><dt className="text-muted">Records</dt><dd className="font-semibold num">{s.records}</dd></div>
                <div><dt className="text-muted">Events</dt><dd className="font-semibold num">{s.events}</dd></div>
                <div><dt className="text-muted">Unmatched</dt><dd className={`font-semibold num ${s.unmatched ? 'text-warn' : ''}`}>{s.unmatched}</dd></div>
              </dl>
              <p className="text-[12px] text-muted mt-2">Last sync {timeAgo(s.lastSyncAt)}</p>
              <div className="flex-1" />
              <button className={`${s.pending ? 'btn-primary' : 'btn-secondary'} btn-sm mt-3 w-full`} onClick={() => sync(s.key)} disabled={syncing !== null}>
                {syncing === s.key ? <Spinner className="text-current" /> : s.pending ? <RefreshCw size={14} /> : <CheckCircle2 size={14} />}
                {syncing === s.key ? 'Syncing…' : s.pending ? `Sync ${s.pending} new ${s.pending === 1 ? 'record' : 'records'}` : 'Up to date · sync again'}
              </button>
            </div>
          );
        })}
      </div>

      {syncResult && (
        <div className="card animate-rise">
          <CardHeader title={`Last sync: ${syncResult.source}`} sub={syncResult.imported ? `${syncResult.imported} records processed, ${syncResult.eventsImported} events applied` : 'No new records were waiting'} action={<button className="btn-ghost btn-sm" onClick={() => setSyncResult(null)}>Dismiss</button>} />
          {syncResult.results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead><tr><th className="th">Incoming record</th><th className="th">Resolved to</th><th className="th">Event</th><th className="th">Effect</th></tr></thead>
                <tbody>
                  {syncResult.results.map((r) => (
                    <tr key={r.sourceId}>
                      <td className="td"><div className="font-medium">{r.rawName}</div><div className="text-[12px] text-muted num">{r.sourceId}</div></td>
                      <td className="td text-[13px]">{r.matchedTo ? <><span className="font-medium">{r.matchedTo}</span><div className="text-[12px] text-muted">{r.explanation}</div></> : <span className="text-warn">{r.explanation}</span>}</td>
                      <td className="td text-[13px]">{r.event || <span className="text-muted">Held for review</span>}</td>
                      <td className="td">{r.stateChanged ? <StateChange from={r.from} to={r.to} size="sm" /> : r.event ? <span className="text-[12.5px] text-muted">State held at {r.to}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <CardHeader title="Identity resolution" sub="The same company appears under different names in each system. PulseX links them to one golden customer and keeps every original reference." />
        {identity.initialLoading ? <div className="p-6 flex justify-center"><Spinner /></div> : identity.error ? <div className="px-5 pb-5"><ErrorState error={identity.error} onRetry={identity.reload} /></div> : (
          <div className="divide-y divide-line border-t border-line">
            {identity.data.clusters.map((c) => {
              const isOpen = open === c._id;
              const names = [...new Set(c.records.map((r) => r.rawName))];
              return (
                <div key={c._id}>
                  <button className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-[#F8FAF9]" onClick={() => setOpen(isOpen ? '' : c._id)} aria-expanded={isOpen}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="font-medium">{c.name}</span><StateBadge state={c.state} size="sm" /></div>
                      <p className="text-[12px] text-muted truncate">Known as: {names.slice(0, 4).join(' · ')}{names.length > 4 ? ` +${names.length - 4} more` : ''}</p>
                    </div>
                    <span className="text-[12.5px] text-muted whitespace-nowrap num">{c.records.length} records {isOpen ? '▴' : '▾'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 overflow-x-auto">
                      <table className="w-full min-w-[640px]">
                        <thead><tr><th className="th">Source</th><th className="th">Name as recorded</th><th className="th">Confidence</th><th className="th">Matched on</th></tr></thead>
                        <tbody>
                          {c.records.map((r) => (
                            <tr key={r._id}>
                              <td className="td"><SourceBadge source={r.system} /><div className="text-[11.5px] text-muted num mt-0.5">{r.sourceId}</div></td>
                              <td className="td font-medium">{r.rawName}</td>
                              <td className="td num">{r.resolution?.status === 'golden' ? <span className="text-brand font-medium">Golden</span> : `${Math.round((r.resolution?.confidence || 0) * 100)}%`}</td>
                              <td className="td">{r.resolution?.status === 'golden' ? <span className="text-[12.5px] text-muted">System of record</span> : <SignalList signals={(r.resolution?.signals || []).filter((x) => x.matched)} />}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Link className="link text-[13px] inline-block mt-3" to={`/customers/${c._id}`}>Open {c.name} profile</Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <CardHeader title="Kept separate" sub="Records that look similar to a customer but did not reach the 60% match threshold. They are not merged." />
        {identity.data && <UnmatchedTable records={identity.data.unmatched} />}
      </div>

      <Modal open={confirm} onClose={() => !importing && setConfirm(false)} title="Import demo data?" width="max-w-md"
        footer={<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setConfirm(false)} disabled={importing}>Cancel</button><button className="btn-primary" onClick={importDemo} disabled={importing}>{importing && <Spinner className="text-white" />}Import demo data</button></div>}>
        <p className="text-[13.5px]">This replaces the current dataset with the 17 seeded customers, their event histories, source records and queued incremental records. Simulated events are removed.</p>
      </Modal>
    </div>
  );
}
