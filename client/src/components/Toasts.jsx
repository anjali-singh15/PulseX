import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

const TONES = {
  good: { icon: CheckCircle2, cls: 'text-growing', bar: 'bg-growing' },
  bad: { icon: AlertTriangle, cls: 'text-atrisk', bar: 'bg-atrisk' },
  info: { icon: Info, cls: 'text-brand', bar: 'bg-brand' },
};

export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))]" aria-live="polite">
      {toasts.map((t) => {
        const tone = TONES[t.tone] || TONES.info;
        const Icon = tone.icon;
        return (
          <div key={t.id} className="relative overflow-hidden bg-white border border-line rounded-lg shadow-pop pl-4 pr-9 py-3 animate-rise">
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${tone.bar}`} />
            <div className="flex gap-2.5">
              <Icon size={16} className={`${tone.cls} mt-0.5 shrink-0`} />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-ink">{t.title}</p>
                {t.body && <p className="text-[12.5px] text-muted mt-0.5">{t.body}</p>}
              </div>
            </div>
            <button onClick={() => dismissToast(t.id)} className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center text-muted hover:text-ink rounded" aria-label="Dismiss"><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
