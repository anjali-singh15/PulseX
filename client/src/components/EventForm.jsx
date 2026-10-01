import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { iconFor } from '../lib/events';
import { inr, fmtDate } from '../lib/format';
import { Spinner, StateBadge } from './ui';

const TONE = {
  negative: 'hover:border-atrisk/50 data-[on=true]:border-atrisk data-[on=true]:bg-atrisk-soft',
  positive: 'hover:border-growing/50 data-[on=true]:border-growing data-[on=true]:bg-growing-soft',
  neutral: 'hover:border-brand/50 data-[on=true]:border-brand data-[on=true]:bg-brand-soft',
};
const ICON_TONE = { negative: 'text-atrisk', positive: 'text-growing', neutral: 'text-brand' };

const blank = { title: '', description: '', text: '', amount: '', percent: '', severity: 'Medium', stage: 'Qualification', resolves: '' };

/**
 * Event entry form. Pick a preset (or any event type), adjust fields, submit.
 * The API saves the event, replays the customer's history and returns what changed.
 */
export default function EventForm({ customers = [], customerId: fixedCustomerId, initialPreset, onResult, onCancel, submitLabel = 'Add event' }) {
  const { meta, recordResult, toast } = useApp();
  const presets = meta?.presets || [];
  const types = meta?.eventTypes || {};
  const [customerId, setCustomerId] = useState(fixedCustomerId || '');
  const [presetKey, setPresetKey] = useState(initialPreset || presets[0]?.key || '');
  const [type, setType] = useState('');
  const [fields, setFields] = useState(blank);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [openItems, setOpenItems] = useState([]);
  const [loadingOpen, setLoadingOpen] = useState(false);

  useEffect(() => { if (fixedCustomerId) setCustomerId(fixedCustomerId); }, [fixedCustomerId]);
  useEffect(() => { if (!customerId && customers.length) setCustomerId((customers.find((c) => c.flagship) || customers[0])._id); }, [customers, customerId]);

  useEffect(() => { if (!presetKey && presets.length) setPresetKey(presets[0].key); }, [presetKey, presets]);

  // Apply a preset's defaults
  useEffect(() => {
    const p = presets.find((x) => x.key === presetKey);
    if (!p) return;
    setType(p.type);
    setFields({ ...blank, ...Object.fromEntries(Object.entries(p.defaults || {}).map(([k, v]) => [k, String(v)])) });
    setErrors([]);
  }, [presetKey, presets]);

  // For "ticket resolved", offer the customer's open complaints and tickets
  useEffect(() => {
    if (type !== 'TICKET_RESOLVED' || !customerId) { setOpenItems([]); return; }
    let alive = true;
    setLoadingOpen(true);
    api.customer(customerId)
      .then((d) => {
        if (!alive) return;
        const items = d.events.filter((e) => ['COMPLAINT_RAISED', 'TICKET_OPENED'].includes(e.type) && e.status === 'open');
        setOpenItems(items);
        setFields((f) => ({ ...f, resolves: items[items.length - 1]?._id || '' }));
      })
      .catch(() => alive && setOpenItems([]))
      .finally(() => alive && setLoadingOpen(false));
    return () => { alive = false; };
  }, [type, customerId]);

  const t = types[type] || {};
  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));
  const selectedCustomer = useMemo(() => customers.find((c) => c._id === customerId), [customers, customerId]);

  const submit = async (e) => {
    e.preventDefault();
    const errs = [];
    if (!customerId) errs.push('Choose a customer');
    if (t.amount && type !== 'OPPORTUNITY_CREATED' && !(Number(fields.amount) > 0)) errs.push('Enter an amount greater than zero');
    if (t.percent && !(Number(fields.percent) > 0 && Number(fields.percent) <= 100)) errs.push('Enter a percentage between 1 and 100');
    if (t.communication && !fields.text.trim()) errs.push('Enter the message text');
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setBusy(true);
    const body = { customerId, type };
    if (fields.title) body.title = fields.title;
    if (fields.description) body.description = fields.description;
    if (t.text || t.communication) body.text = fields.text;
    if (t.amount && fields.amount !== '') body.amount = Number(fields.amount);
    if (t.percent) body.percent = Number(fields.percent);
    if (type === 'COMPLAINT_RAISED') body.severity = fields.severity;
    if (type.startsWith('OPPORTUNITY')) body.stage = fields.stage;
    if (type === 'TICKET_RESOLVED' && fields.resolves) body.resolves = fields.resolves;
    try {
      const result = await api.addEvent(body);
      recordResult(result);
      toast(result.stateChanged
        ? { tone: result.after.state === 'At Risk' || result.after.state === 'Lost' ? 'bad' : 'good', title: `${result.customer.name}: ${result.before.state} → ${result.after.state}`, body: result.transition?.reasons?.[0]?.text || result.label }
        : { tone: 'info', title: `${result.label} recorded`, body: `${result.customer.name} stays ${result.after.state}. Churn ${result.before.churn}% → ${result.after.churn}%.` });
      onResult?.(result);
    } catch (err) {
      setErrors(err.details?.length ? err.details : [err.message]);
      toast({ tone: 'bad', title: 'Event not saved', body: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (!meta) return <div className="py-8 flex justify-center"><Spinner /></div>;

  return (
    <form onSubmit={submit} className="space-y-4">
      {!fixedCustomerId && (
        <div>
          <label className="label" htmlFor="ef-customer">Customer</label>
          <div className="flex items-center gap-2">
            <select id="ef-customer" className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}{c.flagship ? ' (demo account)' : ''}</option>)}
            </select>
            {selectedCustomer && <StateBadge state={selectedCustomer.state} />}
          </div>
        </div>
      )}

      <div>
        <span className="label">Event</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {presets.map((p) => {
            const Icon = iconFor(p.type);
            return (
              <button type="button" key={p.key} data-on={presetKey === p.key} onClick={() => setPresetKey(p.key)}
                className={`flex items-center gap-2 text-left rounded-md border border-line bg-white px-2.5 py-2 text-[13px] font-medium transition-colors ${TONE[p.tone] || TONE.neutral}`}>
                <Icon size={15} className={`shrink-0 ${ICON_TONE[p.tone] || 'text-brand'}`} />
                <span className="leading-tight">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {(type === 'COMPLAINT_RAISED' || type === 'EMAIL' || type.startsWith('OPPORTUNITY') || type === 'TICKET_OPENED') && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ef-title">{type === 'EMAIL' ? 'Subject' : type.startsWith('OPPORTUNITY') ? 'Opportunity name' : 'Summary'}</label>
            <input id="ef-title" className="input" value={fields.title} onChange={set('title')} maxLength={200} />
          </div>
        )}
        {t.amount && (
          <div>
            <label className="label" htmlFor="ef-amount">Amount (₹){type === 'OPPORTUNITY_CREATED' ? ', optional' : ''}</label>
            <input id="ef-amount" className="input num" type="number" min="0" step="1000" value={fields.amount} onChange={set('amount')} />
            {Number(fields.amount) > 0 && <p className="text-[12px] text-muted mt-1 num">{inr(Number(fields.amount))}</p>}
          </div>
        )}
        {t.percent && (
          <div>
            <label className="label" htmlFor="ef-percent">Change in active usage (%)</label>
            <input id="ef-percent" className="input num" type="number" min="1" max="100" value={fields.percent} onChange={set('percent')} />
          </div>
        )}
        {type === 'COMPLAINT_RAISED' && (
          <div>
            <label className="label" htmlFor="ef-sev">Severity</label>
            <select id="ef-sev" className="input" value={fields.severity} onChange={set('severity')}>
              {['Low', 'Medium', 'High'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        {type.startsWith('OPPORTUNITY') && (
          <div>
            <label className="label" htmlFor="ef-stage">Stage</label>
            <select id="ef-stage" className="input" value={fields.stage} onChange={set('stage')}>
              {(meta.stages || []).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        {type === 'TICKET_RESOLVED' && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ef-resolves">Resolves</label>
            {loadingOpen ? <div className="h-9 flex items-center"><Spinner /></div> : openItems.length ? (
              <select id="ef-resolves" className="input" value={fields.resolves} onChange={set('resolves')}>
                {openItems.map((i) => <option key={i._id} value={i._id}>{i.title || 'Complaint'} · raised {fmtDate(i.occurredAt)}</option>)}
              </select>
            ) : <p className="text-[13px] text-muted">No open complaints or tickets. The resolution will still be recorded as a positive support interaction.</p>}
          </div>
        )}
        {(t.text || t.communication) && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ef-text">{t.communication ? 'Message' : 'Details'}</label>
            <textarea id="ef-text" className="textarea" value={fields.text} onChange={set('text')} maxLength={2000} />
            {t.communication && <p className="text-[12px] text-muted mt-1">Sentiment is scored from this text with a keyword lexicon.</p>}
          </div>
        )}
        {!t.communication && !t.text && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ef-desc">Note (optional)</label>
            <input id="ef-desc" className="input" value={fields.description} onChange={set('description')} maxLength={300} />
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-atrisk/30 bg-atrisk-soft px-3 py-2 text-[13px] text-atrisk" role="alert">
          {errors.map((er) => <div key={er}>{er}</div>)}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn-primary" disabled={busy}>{busy && <Spinner className="text-white" />}{submitLabel}</button>
      </div>
    </form>
  );
}
