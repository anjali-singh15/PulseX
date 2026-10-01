import { ArrowRight, CircleAlert, CircleCheck, Eye, Info, TrendingUp, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { RAIL_ORDER, stateStyle } from '../lib/states';
import { fmtDateTime } from '../lib/format';
import { StateBadge } from './ui';

/**
 * The relationship state rail: five states from Lost to Growing. The marker slides
 * when the state changes, and the previous position stays visible as a hollow ring.
 */
export function StateRail({ state, previous, compact = false }) {
  const idx = Math.max(0, RAIL_ORDER.indexOf(state));
  const prevIdx = previous && previous !== state ? RAIL_ORDER.indexOf(previous) : -1;
  const pos = (i) => `${(i + 0.5) * (100 / RAIL_ORDER.length)}%`;
  const cur = stateStyle(state);
  return (
    <div className={compact ? '' : 'pt-1'}>
      <div className="relative">
        <div className="grid grid-cols-5 gap-1">
          {RAIL_ORDER.map((s, i) => {
            const st = stateStyle(s);
            return <div key={s} className={`h-2 rounded-full transition-colors duration-500 ${i === idx ? st.dot : 'bg-line'}`} />;
          })}
        </div>
        {prevIdx >= 0 && (
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 border-dashed bg-white"
            style={{ left: pos(prevIdx), borderColor: stateStyle(previous).hex }} title={`Previously ${previous}`} />
        )}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(21,34,48,0.15)] transition-[left,background-color] duration-700 ease-out"
          style={{ left: pos(idx), backgroundColor: cur.hex }} />
      </div>
      <div className="grid grid-cols-5 gap-1 mt-2">
        {RAIL_ORDER.map((s, i) => (
          <div key={s} className={`text-center text-[12px] ${i === idx ? `${stateStyle(s).text} font-semibold` : 'text-muted'} ${compact ? 'hidden sm:block' : ''}`}>{s}</div>
        ))}
      </div>
    </div>
  );
}

const KIND = {
  risk: { icon: CircleAlert, cls: 'text-atrisk' },
  recovery: { icon: CircleCheck, cls: 'text-recovering' },
  watch: { icon: Eye, cls: 'text-warn' },
  growth: { icon: TrendingUp, cls: 'text-growing' },
  info: { icon: Info, cls: 'text-muted' },
};

export function ReasonList({ reasons = [], dense = false }) {
  if (!reasons.length) return <p className="text-[13px] text-muted">No reasons recorded.</p>;
  return (
    <ul className={dense ? 'space-y-1' : 'space-y-1.5'}>
      {reasons.map((r, i) => {
        const k = KIND[r.kind] || KIND.info;
        const Icon = k.icon;
        return (
          <li key={`${r.text}-${i}`} className="flex items-start gap-2 text-[13.5px]">
            <Icon size={15} className={`${k.cls} mt-[3px] shrink-0`} />
            <span className="text-ink">{r.text}{r.points ? <span className="text-muted num"> · {r.points} {r.points === 1 ? 'pt' : 'pts'}</span> : null}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function StateChange({ from, to, size = 'md' }) {
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <StateBadge state={from} size={size} />
      <ArrowRight size={size === 'lg' ? 18 : 14} className="text-muted" />
      <StateBadge state={to} size={size} />
    </span>
  );
}

/** "What changed" list: before → after for every metric the event moved. */
export function ChangeList({ changes = [] }) {
  const rows = changes.filter((c) => c.key !== 'state');
  if (!rows.length) return <p className="text-[13px] text-muted">No metric moved for this event.</p>;
  return (
    <div className="divide-y divide-line border border-line rounded-md">
      {rows.map((c) => {
        const Icon = c.delta > 0 ? ArrowUpRight : ArrowDownRight;
        return (
          <div key={c.key} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
            <span className="text-muted">{c.label}</span>
            <span className="flex items-center gap-2 num text-right">
              <span className="text-muted line-through decoration-line">{c.before}</span>
              <Icon size={14} className={c.tone === 'good' ? 'text-growing' : 'text-atrisk'} />
              <span className={`font-semibold ${c.tone === 'good' ? 'text-growing' : 'text-atrisk'}`}>{c.after}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** A recorded state transition with its rule and reasons. */
export function TransitionCard({ t, highlight = false }) {
  const to = stateStyle(t.to);
  return (
    <div className={`rounded-md border ${highlight ? `${to.border} ${to.soft}` : 'border-line bg-white'} p-3.5`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <StateChange from={t.from} to={t.to} size="sm" />
        <span className="text-[12px] text-muted">{fmtDateTime(t.at)}</span>
      </div>
      {t.trigger && <p className="text-[12.5px] text-muted mt-2">Triggered by <span className="text-ink font-medium">{t.trigger}</span>{t.rule ? ` · rule: ${t.rule}` : ''}</p>}
      {t.reasons?.length ? <div className="mt-2"><ReasonList reasons={t.reasons} dense /></div> : null}
      {typeof t.churnBefore === 'number' && typeof t.churnAfter === 'number' && (
        <p className="text-[12px] text-muted mt-2 num">Churn {t.churnBefore}% → {t.churnAfter}%</p>
      )}
    </div>
  );
}
