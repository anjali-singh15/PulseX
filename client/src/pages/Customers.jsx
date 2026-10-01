import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, Search } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { inr, inrCompact } from '../lib/format';
import { STATE_ORDER, STATE_BLURB, stateStyle } from '../lib/states';
import { PageSkeleton, ErrorState, SentimentBadge, ChurnMeter, EmptyState } from '../components/ui';
import { CustomerTable } from './Dashboard';

function PortfolioCard({ c }) {
  const st = stateStyle(c.state);
  return (
    <Link to={`/customers/${c._id}`} className="block bg-white border border-line rounded-md p-3 hover:border-brand/40 transition-colors" style={{ borderLeft: `3px solid ${st.hex}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-[13.5px] truncate">{c.name}</p>
          <p className="text-[12px] text-muted truncate">{c.industry}</p>
        </div>
        <SentimentBadge sentiment={c.sentiment} />
      </div>
      <div className="mt-2.5"><ChurnMeter value={c.churn} compact /></div>
      <dl className="grid grid-cols-3 gap-1 mt-2.5 text-[12px]">
        <div><dt className="text-muted">CLV</dt><dd className="font-semibold num">{inrCompact(c.clv)}</dd></div>
        <div><dt className="text-muted">Complaints</dt><dd className={`font-semibold num ${c.openComplaints ? 'text-atrisk' : ''}`}>{c.openComplaints}</dd></div>
        <div><dt className="text-muted">Outstanding</dt><dd className={`font-semibold num ${c.overdue ? 'text-atrisk' : ''}`}>{c.outstanding ? inrCompact(c.outstanding) : '—'}</dd></div>
      </dl>
    </Link>
  );
}

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'portfolio';
  const state = params.get('state') || '';
  const sort = params.get('sort') || 'churn';
  const [search, setSearch] = useState('');
  const update = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  const { data, error, initialLoading, reload } = useApi(() => api.customers({ search, state: view === 'table' ? state : '', sort }), [search, state, sort, view]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const list = data?.customers || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-sub">Portfolio grouped by relationship state. Each card is a live digital twin.</p>
        </div>
        <div className="inline-flex rounded-md border border-line bg-white p-0.5">
          <button className={`btn btn-sm ${view === 'portfolio' ? 'bg-ink text-white' : 'text-muted'}`} onClick={() => update('view', 'portfolio')}><LayoutGrid size={14} />Portfolio</button>
          <button className={`btn btn-sm ${view === 'table' ? 'bg-ink text-white' : 'text-muted'}`} onClick={() => update('view', 'table')}><List size={14} />Table</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-8" placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search customers" />
        </div>
        <select className="input w-auto" value={state} onChange={(e) => update('state', e.target.value)} aria-label="Filter by state">
          <option value="">All states</option>
          {STATE_ORDER.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input w-auto" value={sort} onChange={(e) => update('sort', e.target.value)} aria-label="Sort by">
          <option value="churn">Highest churn risk</option>
          <option value="clv">Highest CLV</option>
          <option value="outstanding">Most outstanding</option>
          <option value="engagement">Lowest engagement</option>
          <option value="name">Name</option>
        </select>
        <span className="text-[12.5px] text-muted ml-auto num">{list.length} customers</span>
      </div>

      {initialLoading ? <PageSkeleton /> : view === 'table' ? (
        <div className="card overflow-hidden"><CustomerTable customers={list} /></div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3 items-start">
          {STATE_ORDER.filter((s) => !state || s === state).map((s) => {
            const items = list.filter((c) => c.state === s);
            const st = stateStyle(s);
            return (
              <section key={s} className="rounded-lg bg-white/60 border border-line p-2.5">
                <header className="px-1 pb-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-[14px] font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />{s}</h2>
                    <span className="text-[13px] num text-muted">{items.length}</span>
                  </div>
                  <p className="text-[12px] text-muted mt-0.5">{STATE_BLURB[s]}</p>
                  <p className="text-[12px] text-muted num">{inr(items.reduce((a, c) => a + c.clv, 0))} CLV</p>
                </header>
                <div className="space-y-2">
                  {items.length ? items.map((c) => <PortfolioCard key={c._id} c={c} />) : <p className="text-[12.5px] text-muted px-1 py-4 text-center">No customers</p>}
                </div>
              </section>
            );
          })}
          {!list.length && <div className="md:col-span-2 xl:col-span-5"><EmptyState title="No customers match">Clear the search to see the full portfolio.</EmptyState></div>}
        </div>
      )}
    </div>
  );
}
