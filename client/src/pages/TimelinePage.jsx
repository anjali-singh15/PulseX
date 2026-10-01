import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { PageSkeleton, ErrorState, StateBadge, SentimentBadge } from '../components/ui';
import { StateRail } from '../components/StateViz';
import Timeline, { CategoryFilter } from '../components/Timeline';
import { inrCompact } from '../lib/format';

const ALL = 'all';

export default function TimelinePage() {
  const { meta, lastResult } = useApp();
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState([]);
  const customers = useApi(() => api.customers({ sort: 'name' }), []);
  const list = customers.data?.customers || [];
  const selected = params.get('customer') || '';

  useEffect(() => {
    if (!selected && list.length) setParams({ customer: (list.find((c) => c.flagship) || list[0])._id }, { replace: true });
  }, [selected, list, setParams]);

  const feed = useApi(
    () => api.events({ customerId: selected === ALL ? undefined : selected, category: cats.join(','), limit: selected === ALL ? 150 : 500 }),
    [selected, cats.join(',')],
    { enabled: Boolean(selected) },
  );
  const current = list.find((c) => c._id === selected);
  const events = feed.data?.events || [];
  const highlight = lastResult && Date.now() - lastResult.receivedAt < 10 * 60 * 1000 ? lastResult.event?._id : null;
  const categories = useMemo(() => meta?.categories || [], [meta]);

  if (customers.initialLoading) return <PageSkeleton />;
  if (customers.error && !customers.data) return <ErrorState error={customers.error} onRetry={customers.reload} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Relationship timeline</h1>
        <p className="page-sub">Every interaction from CRM, email, WhatsApp, invoices, payments, support, website and product, merged into one chronological history with its impact on the relationship.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="card p-4 space-y-4 lg:sticky lg:top-20">
          <div>
            <label className="label" htmlFor="tl-customer">Customer</label>
            <select id="tl-customer" className="input" value={selected} onChange={(e) => setParams({ customer: e.target.value })}>
              <option value={ALL}>All customers (latest activity)</option>
              {list.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          {current && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Link to={`/customers/${current._id}`} className="font-medium hover:text-brand">{current.name}</Link>
                <StateBadge state={current.state} />
              </div>
              <StateRail state={current.state} previous={current.previousState} compact />
              <dl className="grid grid-cols-3 gap-2 text-[12.5px]">
                <div><dt className="text-muted">Churn</dt><dd className="font-semibold num">{current.churn}%</dd></div>
                <div><dt className="text-muted">CLV</dt><dd className="font-semibold num">{inrCompact(current.clv)}</dd></div>
                <div><dt className="text-muted">Sentiment</dt><dd><SentimentBadge sentiment={current.sentiment} /></dd></div>
              </dl>
            </div>
          )}
          <div>
            <span className="label">Event types</span>
            <CategoryFilter categories={categories} value={cats} onChange={setCats} />
          </div>
        </div>

        <div className="card p-4 lg:col-span-2 min-h-[300px]">
          <div className="flex items-center justify-between mb-1 px-1">
            <h2 className="card-title">{current ? current.name : 'All customers'}</h2>
            <span className="text-[12.5px] text-muted num">{events.length} events</span>
          </div>
          {feed.error && !feed.data ? <ErrorState error={feed.error} onRetry={feed.reload} />
            : feed.initialLoading ? <div className="py-12"><PageSkeleton /></div>
              : <Timeline events={events} showCustomer={selected === ALL} highlightId={highlight} />}
        </div>
      </div>
    </div>
  );
}
