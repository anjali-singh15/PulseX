import { useEffect, useRef } from 'react';
import { AlertCircle, Inbox, Loader2, X } from 'lucide-react';
import { stateStyle, SENTIMENT_STYLE, churnBar, churnTone } from '../lib/states';
import { SOURCE_STYLE } from '../lib/events';

export function StateBadge({ state, size = 'md' }) {
  if (!state) return null;
  const s = stateStyle(state);
  const cls = size === 'lg' ? 'h-8 px-3 text-[14px]' : size === 'sm' ? 'h-5 px-1.5 text-[11.5px]' : 'h-6 px-2 text-[12.5px]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${s.badge} ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {state}
    </span>
  );
}

export function SentimentBadge({ sentiment, showScore = false }) {
  if (!sentiment) return null;
  const label = sentiment.label || sentiment;
  return (
    <span className={`inline-flex items-center h-6 px-2 rounded-md text-[12.5px] font-medium whitespace-nowrap ${SENTIMENT_STYLE[label] || SENTIMENT_STYLE.Neutral}`}>
      {label}{showScore && typeof sentiment.score === 'number' ? <span className="ml-1 opacity-70 num">{sentiment.score > 0 ? '+' : ''}{sentiment.score}</span> : null}
    </span>
  );
}

export function SourceBadge({ source }) {
  return <span className={`inline-flex items-center h-5 px-1.5 rounded text-[11.5px] font-medium whitespace-nowrap ${SOURCE_STYLE[source] || 'bg-canvas text-muted'}`}>{source}</span>;
}

export function ChurnMeter({ value, compact = false }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={`flex items-center gap-2 ${compact ? 'min-w-[88px]' : 'min-w-[120px]'}`}>
      <div className="h-1.5 flex-1 rounded-full bg-canvas overflow-hidden">
        <div className={`h-full rounded-full ${churnBar(v)} transition-all duration-500`} style={{ width: `${v}%` }} />
      </div>
      <span className={`num text-[13px] font-semibold w-9 text-right ${churnTone(v)}`}>{v}%</span>
    </div>
  );
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin text-muted ${className}`} size={16} />;
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-line/60 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      <div className="h-10 w-10 rounded-full bg-canvas flex items-center justify-center mb-3"><Icon size={18} className="text-muted" /></div>
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="text-[13px] text-muted mt-1 max-w-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card card-pad flex items-start gap-3 border-atrisk/30">
      <AlertCircle className="text-atrisk mt-0.5 shrink-0" size={18} />
      <div className="flex-1">
        <p className="font-medium">Couldn’t load this view</p>
        <p className="text-[13px] text-muted mt-0.5">{error?.message || String(error)}</p>
      </div>
      {onRetry && <button className="btn-secondary btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function CardHeader({ title, sub, action }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="card-title">{title}</h2>
        {sub && <p className="card-sub">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Kpi({ label, value, hint, tone, icon: Icon, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`card text-left px-4 py-3.5 ${onClick ? 'hover:border-brand/40 transition-colors' : ''} ${active ? 'ring-2 ring-brand/30 border-brand/40' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="kpi-label">{label}</span>
        {Icon && <Icon size={15} className="text-muted" />}
      </div>
      <div className={`kpi-value num mt-1 ${tone || ''}`}>{value}</div>
      {hint && <div className="text-[12px] text-muted mt-0.5 truncate">{hint}</div>}
    </Tag>
  );
}

export function Modal({ open, onClose, title, sub, children, width = 'max-w-2xl', footer }) {
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`relative w-full ${width} max-h-[92vh] flex flex-col bg-white rounded-xl shadow-pop animate-rise outline-none`}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
          <div>
            <h2 className="text-[16px] font-semibold">{title}</h2>
            {sub && <p className="text-[13px] text-muted mt-0.5">{sub}</p>}
          </div>
          <button className="btn-ghost h-8 w-8 px-0" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line bg-[#F8FAF9] rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-line overflow-x-auto" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={`px-3 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${value === t.key ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 text-[12px] text-muted num">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <div>
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`text-[15px] font-semibold num ${tone || 'text-ink'}`}>{value}</div>
    </div>
  );
}
