import { Check, Minus, GitMerge, Link2Off } from 'lucide-react';
import { churnTone } from '../lib/states';
import { SourceBadge } from './ui';
import { fmtDateTime } from '../lib/format';

/** Additive churn breakdown: "Payment delays +20", "Protective −5". */
export function ChurnFactors({ churn }) {
  if (!churn) return null;
  const factors = [...(churn.factors || [])].sort((a, b) => b.points - a.points);
  const max = Math.max(...factors.map((f) => Math.abs(f.points)), 1);
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className={`text-[28px] font-semibold num ${churnTone(churn.probability)}`}>{churn.probability}%</span>
        <span className="text-[13px] text-muted">simulated churn probability</span>
      </div>
      <ul className="mt-3 space-y-2">
        {factors.map((f) => (
          <li key={f.key}>
            <div className="flex items-center justify-between text-[13px] gap-2">
              <span className="text-ink">{f.label}</span>
              <span className={`num font-semibold ${f.points > 0 ? (f.key === 'baseline' ? 'text-muted' : 'text-atrisk') : 'text-growing'}`}>{f.points > 0 ? '+' : '−'}{Math.abs(f.points)}</span>
            </div>
            <div className="h-1 rounded-full bg-canvas mt-1 overflow-hidden">
              <div className={`h-full rounded-full ${f.points > 0 ? (f.key === 'baseline' ? 'bg-lost/50' : 'bg-atrisk/70') : 'bg-growing/70'}`} style={{ width: `${(Math.abs(f.points) / max) * 100}%` }} />
            </div>
            {f.detail && <p className="text-[12px] text-muted mt-0.5">{f.detail}</p>}
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-muted mt-3">{(churn.model || 'Explainable rule-based score').replace(/\.$/, '')}. Points add up from a baseline and are clamped to 2–97%.</p>
    </div>
  );
}

export function SignalList({ signals = [] }) {
  if (!signals.length) return null;
  return (
    <ul className="space-y-1">
      {signals.map((s) => (
        <li key={s.key} className="flex items-start gap-2 text-[12.5px]">
          {s.matched ? <Check size={14} className="text-growing mt-0.5 shrink-0" /> : <Minus size={14} className="text-muted mt-0.5 shrink-0" />}
          <span><span className="font-medium">{s.label}</span> <span className="text-muted">{s.value} · {s.detail}</span></span>
        </li>
      ))}
    </ul>
  );
}

/** Every source record merged into one golden customer, with the matching evidence. */
export function IdentityPanel({ customer, records = [] }) {
  return (
    <div>
      <div className="flex items-start gap-3 rounded-md bg-brand-soft/60 border border-brand/15 p-3.5">
        <GitMerge size={18} className="text-brand mt-0.5 shrink-0" />
        <div className="text-[13px]">
          <p className="font-medium text-ink">{records.length} source records resolved to one customer</p>
          <p className="text-muted mt-0.5">Golden record: <span className="text-ink">{customer.name}</span> · CIN <span className="num">{customer.companyId}</span> · @{customer.domain}. Records are linked on name similarity, email domain, phone and company ID; every original record is kept with its source reference.</p>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr><th className="th">Source</th><th className="th">Name as recorded</th><th className="th">Reference</th><th className="th">Confidence</th><th className="th">Evidence</th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r._id}>
                <td className="td"><SourceBadge source={r.system} /></td>
                <td className="td font-medium">{r.rawName}<div className="text-[12px] text-muted font-normal">{r.email || r.phone || ''}</div></td>
                <td className="td num text-[12.5px] text-muted">{r.sourceId}</td>
                <td className="td num">{r.resolution?.status === 'golden' ? <span className="text-brand font-medium">Golden</span> : `${Math.round((r.resolution?.confidence || 0) * 100)}%`}</td>
                <td className="td text-[12.5px]">{r.resolution?.status === 'golden' ? <span className="text-muted">System of record</span> : <SignalList signals={(r.resolution?.signals || []).filter((s) => s.matched)} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UnmatchedTable({ records = [] }) {
  if (!records.length) return <p className="text-[13px] text-muted px-5 pb-5">Every incoming record was linked to a customer.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead><tr><th className="th">Source</th><th className="th">Name as recorded</th><th className="th">Closest candidate</th><th className="th">Why it was kept separate</th><th className="th">Received</th></tr></thead>
        <tbody>
          {records.map((r) => (
            <tr key={r._id}>
              <td className="td"><SourceBadge source={r.system} /></td>
              <td className="td font-medium"><span className="inline-flex items-center gap-1.5"><Link2Off size={13} className="text-muted" />{r.rawName}</span></td>
              <td className="td">{r.resolution?.candidate || '—'} <span className="text-muted num text-[12px]">{Math.round((r.resolution?.confidence || 0) * 100)}%</span></td>
              <td className="td text-[12.5px] text-muted max-w-sm">{r.resolution?.explanation}</td>
              <td className="td text-[12.5px] text-muted whitespace-nowrap">{fmtDateTime(r.ingestedAt || r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
