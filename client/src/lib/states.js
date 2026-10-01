// Visual order on the state rail: worst on the left, best on the right.
export const RAIL_ORDER = ['Lost', 'At Risk', 'Recovering', 'Stable', 'Growing'];
export const STATE_ORDER = ['Growing', 'Stable', 'Recovering', 'At Risk', 'Lost'];

export const STATE_STYLE = {
  Growing: { hex: '#1E7F4F', badge: 'bg-growing-soft text-growing border-growing/25', dot: 'bg-growing', text: 'text-growing', soft: 'bg-growing-soft', border: 'border-growing' },
  Stable: { hex: '#2F5E9E', badge: 'bg-stable-soft text-stable border-stable/25', dot: 'bg-stable', text: 'text-stable', soft: 'bg-stable-soft', border: 'border-stable' },
  Recovering: { hex: '#0F8B8D', badge: 'bg-recovering-soft text-recovering border-recovering/25', dot: 'bg-recovering', text: 'text-recovering', soft: 'bg-recovering-soft', border: 'border-recovering' },
  'At Risk': { hex: '#C23A2B', badge: 'bg-atrisk-soft text-atrisk border-atrisk/25', dot: 'bg-atrisk', text: 'text-atrisk', soft: 'bg-atrisk-soft', border: 'border-atrisk' },
  Lost: { hex: '#6B7480', badge: 'bg-lost-soft text-lost border-lost/25', dot: 'bg-lost', text: 'text-lost', soft: 'bg-lost-soft', border: 'border-lost' },
};

export const stateStyle = (s) => STATE_STYLE[s] || STATE_STYLE.Stable;

export const STATE_BLURB = {
  Growing: 'No risk signals and three or more growth signals',
  Stable: 'Healthy with no significant risk',
  Recovering: 'Back from risk, settling for 30 days',
  'At Risk': 'Two or more risk points active',
  Lost: 'Contract cancelled with no purchase since',
};

export const SENTIMENT_STYLE = {
  Positive: 'bg-growing-soft text-growing',
  Neutral: 'bg-lost-soft text-muted',
  Negative: 'bg-atrisk-soft text-atrisk',
};

export const churnTone = (p) => (p >= 60 ? 'text-atrisk' : p >= 30 ? 'text-warn' : 'text-growing');
export const churnBar = (p) => (p >= 60 ? 'bg-atrisk' : p >= 30 ? 'bg-warn' : 'bg-growing');
