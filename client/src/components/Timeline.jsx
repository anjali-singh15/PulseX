import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { iconFor, DIRECTION_STYLE, eventHeadline } from '../lib/events';
import { fmtDateTime, fmtDate } from '../lib/format';
import { SourceBadge, SentimentBadge, EmptyState } from './ui';
import { StateChange } from './StateViz';

export function CategoryFilter({ categories = [], value, onChange, counts = {} }) {
  const all = value.length === 0;
  const toggle = (c) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <div className="flex flex-wrap gap-1.5">
      <button className={all ? 'chip-on' : 'chip-off'} onClick={() => onChange([])}>All</button>
      {categories.map((c) => (
        <button key={c} className={value.includes(c) ? 'chip-on' : 'chip-off'} onClick={() => toggle(c)}>
          {c}{counts[c] !== undefined && <span className="opacity-60 num">{counts[c]}</span>}
        </button>
      ))}
    </div>
  );
}

/** Multi-source relationship timeline. Events arrive newest first. */
export default function Timeline({ events = [], showCustomer = false, highlightId, limit }) {
  const [shown, setShown] = useState(limit || 60);
  const groups = useMemo(() => {
    const out = [];
    for (const e of events.slice(0, shown)) {
      const key = new Date(e.occurredAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      if (!out.length || out[out.length - 1].key !== key) out.push({ key, items: [] });
      out[out.length - 1].items.push(e);
    }
    return out;
  }, [events, shown]);

  if (!events.length) return <EmptyState title="No events match">Try another filter, or add an event to see it appear here.</EmptyState>;

  return (
    <div>
      {groups.map((g) => (
        <section key={g.key} className="mb-2">
          <h3 className="text-[12.5px] font-medium text-muted px-1 py-2">{g.key}</h3>
          <ol className="relative border-l border-line ml-4">
            {g.items.map((e) => {
              const Icon = iconFor(e.type);
              const dir = DIRECTION_STYLE[e.impact?.direction] || DIRECTION_STYLE.neutral;
              const hl = highlightId && String(e._id) === String(highlightId);
              return (
                <li key={e._id} className={`relative pl-7 pr-2 py-3 rounded-md ${hl ? 'animate-flash' : ''}`}>
                  <span className={`absolute -left-[15px] top-3 h-[30px] w-[30px] rounded-full flex items-center justify-center ring-4 ring-white ${dir.ring}`}>
                    <Icon size={14} />
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-[13.5px]">{eventHeadline(e)}</span>
                    <SourceBadge source={e.source} />
                    {e.status && ['open', 'overdue'].includes(e.status) && <span className="text-[11.5px] font-medium text-atrisk">{e.status}</span>}
                    {e.status && ['resolved', 'cleared'].includes(e.status) && <span className="text-[11.5px] font-medium text-growing">{e.status}</span>}
                    {e.origin === 'simulator' && <span className="text-[11.5px] text-brand font-medium">simulated</span>}
                    {e.origin === 'sync' && <span className="text-[11.5px] text-brand font-medium">synced</span>}
                  </div>
                  <div className="text-[12px] text-muted mt-0.5 flex flex-wrap gap-x-3">
                    <span>{fmtDateTime(e.occurredAt)}</span>
                    <span className="num">{e.sourceRef}</span>
                    {showCustomer && e.customer?.name && <Link className="link" to={`/customers/${e.customer._id}`}>{e.customer.name}</Link>}
                    {e.resolvedAt && <span>resolved {fmtDate(e.resolvedAt)}</span>}
                  </div>
                  {(e.text || e.description) && <p className="text-[13px] text-ink/80 mt-1.5 max-w-2xl">{e.text || e.description}</p>}
                  {e.impact && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                      <span className={`font-medium ${dir.text}`}>{dir.label}</span>
                      {e.sentiment && e.sentiment.label !== 'Neutral' && <SentimentBadge sentiment={e.sentiment} showScore />}
                      {(e.impact.highlights || []).map((h) => <span key={h} className="px-1.5 py-0.5 rounded bg-canvas text-muted">{h}</span>)}
                      {e.impact.stateChanged && <StateChange from={e.impact.stateBefore} to={e.impact.stateAfter} size="sm" />}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {events.length > shown && (
        <div className="text-center pt-2"><button className="btn-secondary btn-sm" onClick={() => setShown((s) => s + 60)}>Show older events ({events.length - shown} more)</button></div>
      )}
    </div>
  );
}
