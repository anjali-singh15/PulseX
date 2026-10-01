import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter, ZAxis, ReferenceLine, Cell } from 'recharts';
import { Info } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { inr, inrCompact, timeAgo } from '../lib/format';
import { stateStyle, STATE_ORDER } from '../lib/states';
import { PageSkeleton, ErrorState, CardHeader, Kpi, StateBadge, ChurnMeter, EmptyState } from '../components/ui';
import { StateChange } from '../components/StateViz';

const axis = { fontSize: 12, fill: '#5B6B7A' };
const tipStyle = { borderRadius: 8, border: '1px solid #DDE3E1', fontSize: 12.5 };

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-line rounded-md px-3 py-2 text-[12.5px] shadow-card">
      <p className="font-medium">{d.name}</p>
      <p className="text-muted num">Churn {d.churn}% · CLV {inr(d.clv)}</p>
      <p className="mt-1"><StateBadge state={d.state} size="sm" /></p>
    </div>
  );
}

export default function RiskInsights() {
  const navigate = useNavigate();
  const { data, error, initialLoading, reload } = useApi(() => api.insights(), []);
  if (initialLoading) return <PageSkeleton />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const { summary, drivers, leaderboard, riskMap, recentTransitions, rules, thresholds } = data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Risk & insights</h1>
        <p className="page-sub">Churn scores here are simulated with transparent, additive rules — not a trained model — so every point can be traced to an event.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="CLV at risk" value={inrCompact(summary.revenueAtRisk)} tone="text-atrisk" hint={`${summary.atRiskCount} At Risk customers`} />
        <Kpi label="High churn risk" value={summary.highChurn} tone={summary.highChurn ? 'text-atrisk' : ''} hint={`Churn ≥ ${thresholds.HIGH_CHURN}%`} />
        <Kpi label="Average churn" value={`${summary.avgChurn}%`} hint="Active customers" />
        <Kpi label="State changes" value={summary.transitions30d} hint="Last 30 days" />
        <Kpi label="Top driver" value={drivers[0]?.factor || '—'} hint={drivers[0] ? `${drivers[0].customers} customers affected` : 'No active drivers'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <CardHeader title="What drives churn across the portfolio" sub="Sum of churn points contributed by each factor, active customers" />
          <div className="h-64 px-2 pb-3">
            {drivers.length ? (
              <ResponsiveContainer>
                <BarChart data={drivers} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#E6EBE9" horizontal={false} />
                  <XAxis type="number" tick={axis} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="factor" tick={axis} tickLine={false} axisLine={false} width={140} />
                  <Tooltip contentStyle={tipStyle} cursor={{ fill: 'rgba(14,77,100,0.05)' }} formatter={(v, n, p) => [`${v} points across ${p.payload.customers} customers`, 'Contribution']} />
                  <Bar dataKey="points" fill="#C23A2B" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No churn drivers active" />}
          </div>
        </div>
        <div className="card">
          <CardHeader title="Churn vs lifetime value" sub="Top-right is where attention pays off most. Click a point to open the customer." />
          <div className="h-64 px-2 pb-3">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#E6EBE9" />
                <XAxis type="number" dataKey="churn" name="Churn" unit="%" domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="clv" name="CLV" tick={axis} tickLine={false} axisLine={false} tickFormatter={inrCompact} width={68} />
                <ZAxis range={[70, 70]} />
                <ReferenceLine x={thresholds.HIGH_CHURN} stroke="#C23A2B" strokeDasharray="4 3" />
                <Tooltip content={<ScatterTip />} />
                <Scatter data={riskMap} onClick={(d) => navigate(`/customers/${d._id}`)} cursor="pointer">
                  {riskMap.map((d) => <Cell key={d._id} fill={stateStyle(d.state).hex} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 px-5 pb-4 text-[12px] text-muted">
            {STATE_ORDER.map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${stateStyle(s).dot}`} />{s}</span>)}
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2 overflow-hidden">
          <CardHeader title="Churn watchlist" sub="Active customers by churn probability, with the factors behind each score" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr><th className="th">Customer</th><th className="th">State</th><th className="th">Churn</th><th className="th">Top contributors</th><th className="th text-right">CLV</th></tr></thead>
              <tbody>
                {leaderboard.map((c) => (
                  <tr key={c._id} className="hover:bg-[#F8FAF9]">
                    <td className="td"><Link to={`/customers/${c._id}`} className="font-medium hover:text-brand">{c.name}</Link><div className="text-[12px] text-muted">{c.industry}</div></td>
                    <td className="td"><StateBadge state={c.state} /></td>
                    <td className="td"><ChurnMeter value={c.churn} compact /></td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {(c.topFactors || []).filter((f) => f.key !== 'baseline').slice(0, 3).map((f) => (
                          <span key={f.key} className={`text-[12px] px-1.5 py-0.5 rounded ${f.points > 0 ? 'bg-atrisk-soft text-atrisk' : 'bg-growing-soft text-growing'}`}>{f.label} {f.points > 0 ? '+' : '−'}{Math.abs(f.points)}</span>
                        ))}
                        {!(c.topFactors || []).some((f) => f.key !== 'baseline') && <span className="text-[12px] text-muted">Baseline only</span>}
                      </div>
                    </td>
                    <td className="td text-right num">{inrCompact(c.clv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <CardHeader title="State changes, last 30 days" />
          <ul className="px-5 pb-4 divide-y divide-line max-h-[520px] overflow-y-auto">
            {recentTransitions.length ? recentTransitions.map((t) => (
              <li key={t._id} className="py-2.5">
                <div className="flex justify-between gap-2 text-[13px]"><Link to={`/customers/${t.customerId}`} className="font-medium hover:text-brand truncate">{t.customerName}</Link><span className="text-[12px] text-muted whitespace-nowrap">{timeAgo(t.at)}</span></div>
                <div className="mt-1"><StateChange from={t.from} to={t.to} size="sm" /></div>
                <p className="text-[12px] text-muted mt-1">{t.trigger} · {t.rule}</p>
              </li>
            )) : <EmptyState title="No changes in 30 days" />}
          </ul>
        </div>
      </div>

      <div className="card">
        <CardHeader title="How the engine decides" sub="The complete rulebook. Every state, score and reason in PulseX comes from these rules." />
        <div className="px-5 pb-5 grid lg:grid-cols-3 gap-6">
          <div>
            <h3 className="text-[13.5px] font-semibold mb-2">State rules, in priority order</h3>
            <ol className="space-y-2">
              {rules.stateRules.map((r, i) => (
                <li key={r.to} className="flex gap-2.5 text-[13px]"><span className="text-muted num w-4">{i + 1}.</span><div><StateBadge state={r.to} size="sm" /><p className="text-muted mt-0.5">{r.when}</p></div></li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-[13.5px] font-semibold mb-2">Risk points (At Risk at {thresholds.AT_RISK_POINTS})</h3>
            <ul className="space-y-1.5 text-[13px]">
              {rules.riskSignals.map((r) => <li key={r.key}><span className="font-medium">{r.label}</span> <span className="text-atrisk num">+{r.points}</span><p className="text-muted text-[12.5px]">{r.when}</p></li>)}
            </ul>
            <h3 className="text-[13.5px] font-semibold mt-4 mb-2">Growth signals (Growing at {thresholds.GROWING_POINTS})</h3>
            <ul className="space-y-1.5 text-[13px]">
              {rules.growthSignals.map((r) => <li key={r.key}><span className="font-medium">{r.label}</span><p className="text-muted text-[12.5px]">{r.when}</p></li>)}
            </ul>
          </div>
          <div>
            <h3 className="text-[13.5px] font-semibold mb-2">Churn model</h3>
            <ul className="space-y-1.5 text-[13px]">
              {rules.churnModel.map((f) => <li key={f.factor}><span className="font-medium">{f.factor}</span> <span className="text-muted">— {f.points}</span></li>)}
            </ul>
            <div className="mt-4 space-y-2">
              {Object.entries(rules.formulas).map(([k, v]) => (
                <p key={k} className="text-[12.5px] text-muted flex gap-2"><Info size={13} className="mt-0.5 shrink-0 text-brand" /><span><span className="text-ink font-medium capitalize">{k === 'clv' ? 'CLV' : k}:</span> {v}</span></p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
