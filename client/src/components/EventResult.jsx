import { Link } from 'react-router-dom';
import { stateStyle } from '../lib/states';
import { ChangeList, ReasonList, StateChange, StateRail } from './StateViz';
import { StateBadge } from './ui';

/** Shows exactly what one event changed and why. Used by the modal, simulator and profile. */
export default function EventResult({ result, showCustomerLink = true, compact = false }) {
  if (!result) return null;
  const { before, after, stateChanged, transition, reasons, rule, changes, label, customer } = result;
  const st = stateStyle(after.state);
  return (
    <div className="space-y-4 animate-rise">
      <div className={`rounded-lg border p-4 ${stateChanged ? `${st.border} ${st.soft}` : 'border-line bg-[#F8FAF9]'}`}>
        <p className="text-[12.5px] text-muted">{label} · {customer?.name}</p>
        {stateChanged ? (
          <>
            <p className="text-[15px] font-semibold mt-1">Relationship state changed</p>
            <div className="mt-2"><StateChange from={before.state} to={after.state} size="lg" /></div>
          </>
        ) : (
          <>
            <p className="text-[15px] font-semibold mt-1">State held at <StateBadge state={after.state} /></p>
            <p className="text-[13px] text-muted mt-1">The event was recorded and every score recalculated; not enough changed to move the state.</p>
          </>
        )}
        {!compact && <div className="mt-4"><StateRail state={after.state} previous={stateChanged ? before.state : null} /></div>}
      </div>

      <div className={compact ? 'space-y-4' : 'grid md:grid-cols-2 gap-4'}>
        <div>
          <h3 className="text-[13.5px] font-semibold mb-1">Why</h3>
          <p className="text-[12.5px] text-muted mb-2">{transition?.rule || rule}</p>
          <ReasonList reasons={transition?.reasons || reasons} />
        </div>
        <div>
          <h3 className="text-[13.5px] font-semibold mb-2">What changed</h3>
          <ChangeList changes={changes} />
        </div>
      </div>
      {showCustomerLink && customer?._id && (
        <Link to={`/customers/${customer._id}`} className="link text-[13px]">Open {customer.name} profile</Link>
      )}
    </div>
  );
}
