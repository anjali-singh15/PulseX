import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, AreaChart, Area, Legend, Cell } from 'recharts';
import { Users, Wallet, IndianRupee, AlertOctagon, Clock, Flame, Search } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { inr, inrCompact, timeAgo, plural } from '../lib/format';
import { STATE_ORDER, stateStyle } from '../lib/states';
import { Kpi, CardHeader, PageSkeleton, ErrorState, StateBadge, ChurnMeter, SentimentBadge, EmptyState } from '../components/ui';
import { StateChange } from '../components/StateViz';

const axis = { fontSize: 12, fill: '#5B6B7A' };
const grid = <CartesianGrid stroke="#E6EBE9" vertical={false} />;
const tip = { contentStyle: { borderRadius: 8, border: '1px solid #DDE3E1', fontSize: 12.5 }, cursor: { fill: 'rgba(14,77,100,0.05)' } };

function ChartCard({ title, sub, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      <CardHeader title={title} sub={sub} />
      <div className="h-60 px-2 pb-3">{children}</div>
    </div>
  );
}

export function CustomerTable({ customers, empty }) {
  const navigate = useNavigate();
  if (!customers.length) return empty || <EmptyState title="No customers match">Clear the search or pick another state.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr>
            <th className="th">Customer</th><th className="th">State</th><th className="th text-right">CLV</th><th className="th">Churn</th>
            <th className="th">Sentiment</th><th className="th text-right">Engagement</th><th className="th text-right">Open complaints</th><th className="th text-right">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c._id} className="hover:bg-[#F8FAF9] cursor-pointer" onClick={() => navigate(`/customers/${c._id}`)}>
              <td className="td">
                <Link to={`/customers/${c._id}`} className="font-medium hover:text-brand" onClick={(e) => e.stopPropagation()}>{c.name}</Link>
                <div className="text-[12px] text-muted">{c.industry} · {c.city}</div>
              </td>
              <td className="td"><StateBadge state={c.state} /></td>
              <td className="td text-right num">{inrCompact(c.clv)}</td>
              <td className="td"><ChurnMeter value={c.churn} compact /></td>
              <td className="td"><SentimentBadge sentiment={c.sentiment} /></td>
              <td className="td text-right num">{c.engagement}</td>
              <td className={`td text-right num ${c.openComplaints ? 'text-atrisk font-medium' : 'text-muted'}`}>{c.openComplaints}</td>
              <td className={`td text-right num ${c.overdue ? 'text-atrisk font-medium' : ''}`}>{c.outstanding ? inr(c.outstanding) : <span className="text-muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const { data, error, initialLoading, reload } = useApi(() => api.dashboard(), []);
  const [q, setQ] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data.customers.filter((c) => (!s || c.name.toLowerCase().includes(s) || c.industry.toLowerCase().includes(s)) && (!stateFilter || c.state === stateFilter));
  }, [data, q, stateFilter]);

  if (initialLoading) return <PageSkeleton />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const { kpis, stateDistribution, trends, transitions } = data;
  const total = kpis.totalCustomers || 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Portfolio dashboard</h1>
        <p className="page-sub">Every number here is recalculated from the event history of each customer. Add an event and it updates live.</p>
      </div>

      {/* State distribution strip: the portfolio at a glance, clickable to filter the list below */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="card-title">Relationship states</h2>
          {stateFilter && <button className="btn-ghost btn-sm" onClick={() => setStateFilter('')}>Clear filter</button>}
        </div>
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5 bg-canvas">
          {STATE_ORDER.map((s) => {
            const d = stateDistribution.find((x) => x.state === s);
            return d?.count ? <div key={s} className="h-full transition-all duration-700" style={{ width: `${(d.count / total) * 100}%`, background: stateStyle(s).hex }} title={`${s}: ${d.count}`} /> : null;
          })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
          {STATE_ORDER.map((s) => {
            const d = stateDistribution.find((x) => x.state === s) || { count: 0, clv: 0 };
            const on = stateFilter === s;
            return (
              <button key={s} onClick={() => setStateFilter(on ? '' : s)}
                className={`text-left rounded-md border px-3 py-2 transition-colors ${on ? `${stateStyle(s).border} ${stateStyle(s).soft}` : 'border-line hover:bg-canvas'}`}>
                <div className="flex items-center gap-1.5 text-[12.5px] text-muted"><span className={`h-2 w-2 rounded-full ${stateStyle(s).dot}`} />{s}</div>
                <div className="text-[20px] font-semibold num leading-tight mt-0.5">{d.count}</div>
                <div className="text-[12px] text-muted num">{inrCompact(d.clv)} CLV</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Total customers" value={kpis.totalCustomers} icon={Users} hint={`${kpis.byState['At Risk'] || 0} at risk`} />
        <Kpi label="Total CLV" value={inrCompact(kpis.totalClv)} icon={Wallet} hint="Incl. 3-year projection" />
        <Kpi label="Total revenue" value={inrCompact(kpis.totalRevenue)} icon={IndianRupee} hint={`${inrCompact(kpis.pipeline)} open pipeline`} />
        <Kpi label="Open complaints" value={kpis.openComplaints} icon={AlertOctagon} tone={kpis.openComplaints ? 'text-atrisk' : ''} hint="Unresolved across portfolio" />
        <Kpi label="Overdue payments" value={inrCompact(kpis.overdueAmount)} icon={Clock} tone={kpis.overdueAmount ? 'text-atrisk' : ''} hint={plural(kpis.overdueCustomers, 'customer')} />
        <Kpi label="High churn risk" value={kpis.highChurn} icon={Flame} tone={kpis.highChurn ? 'text-atrisk' : ''} hint={`Churn ≥ ${kpis.highChurnThreshold}% · avg ${kpis.avgChurn}%`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title="Customers by state" sub="Current portfolio">
          <ResponsiveContainer>
            <BarChart data={STATE_ORDER.map((s) => ({ state: s, count: stateDistribution.find((d) => d.state === s)?.count || 0 }))} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              {grid}<XAxis dataKey="state" tick={axis} tickLine={false} axisLine={false} interval={0} /><YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
              <Tooltip {...tip} />
              <Bar dataKey="count" name="Customers" radius={[4, 4, 0, 0]}>{STATE_ORDER.map((s) => <Cell key={s} fill={stateStyle(s).hex} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Revenue trend" sub="Invoiced vs collected, last 6 months" className="lg:col-span-2">
          <ResponsiveContainer>
            <AreaChart data={trends} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              {grid}<XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} /><YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={inrCompact} width={64} />
              <Tooltip {...tip} formatter={(v) => inr(v)} /><Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="revenue" name="Invoiced" stroke="#0E4D64" fill="#0E4D64" fillOpacity={0.12} strokeWidth={2} />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="#1E7F4F" fill="#1E7F4F" fillOpacity={0.08} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Complaint trend" sub="Raised vs resolved">
          <ResponsiveContainer>
            <BarChart data={trends} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              {grid}<XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
              <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="complaints" name="Raised" fill="#C23A2B" radius={[3, 3, 0, 0]} />
              <Bar dataKey="resolved" name="Resolved" fill="#0F8B8D" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Payments and overdue" sub="Collected vs newly overdue">
          <ResponsiveContainer>
            <BarChart data={trends} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              {grid}<XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} /><YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={inrCompact} width={60} />
              <Tooltip {...tip} formatter={(v) => inr(v)} /><Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="collected" name="Collected" fill="#2F5E9E" radius={[3, 3, 0, 0]} />
              <Bar dataKey="overdue" name="Overdue" fill="#B7791F" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Engagement trend" sub="Average engagement and interactions">
          <ResponsiveContainer>
            <LineChart data={trends} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              {grid}<XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} /><YAxis tick={axis} tickLine={false} axisLine={false} />
              <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Line type="monotone" dataKey="engagement" name="Avg engagement" stroke="#0E4D64" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="interactions" name="Interactions" stroke="#0F8B8D" strokeWidth={2} dot={false} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="card">
        <CardHeader title="Recent state changes" sub="Newest first. Each change links to the customer and its reason." />
        {transitions.length ? (
          <ul className="px-5 pb-5 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {transitions.map((t) => (
              <li key={t._id} className="rounded-md border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/customers/${t.customerId}`} className="font-medium text-[13.5px] hover:text-brand truncate">{t.customerName}</Link>
                  <span className="text-[12px] text-muted whitespace-nowrap">{timeAgo(t.at)}</span>
                </div>
                <div className="mt-1.5"><StateChange from={t.from} to={t.to} size="sm" /></div>
                <p className="text-[12.5px] text-muted mt-1.5">{t.reason || t.trigger}</p>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No state changes yet" />}
      </div>

      <div className="card overflow-hidden">
        <CardHeader title="Customers" sub={stateFilter ? `Showing ${stateFilter} · sorted by churn risk` : 'Sorted by churn risk'}
          action={<div className="relative w-56"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><input className="input pl-8 h-8" placeholder="Search name or industry" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" /></div>} />
        <CustomerTable customers={filtered} />
      </div>
    </div>
  );
}
