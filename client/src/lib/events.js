import {
  ShoppingCart, IndianRupee, AlertTriangle, AlertOctagon, LifeBuoy, CheckCircle2, Mail, MessageCircle,
  Globe, TrendingUp, TrendingDown, Target, Briefcase, XCircle, Activity,
} from 'lucide-react';

export const TYPE_ICON = {
  PURCHASE_MADE: ShoppingCart,
  PAYMENT_RECEIVED: IndianRupee,
  PAYMENT_OVERDUE: AlertTriangle,
  COMPLAINT_RAISED: AlertOctagon,
  TICKET_OPENED: LifeBuoy,
  TICKET_RESOLVED: CheckCircle2,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  WEBSITE_VISIT: Globe,
  USAGE_INCREASED: TrendingUp,
  USAGE_DECREASED: TrendingDown,
  OPPORTUNITY_CREATED: Target,
  OPPORTUNITY_UPDATED: Briefcase,
  CONTRACT_CANCELLED: XCircle,
};
export const iconFor = (type) => TYPE_ICON[type] || Activity;

export const DIRECTION_STYLE = {
  positive: { ring: 'bg-growing-soft text-growing', text: 'text-growing', label: 'Positive impact' },
  negative: { ring: 'bg-atrisk-soft text-atrisk', text: 'text-atrisk', label: 'Negative impact' },
  neutral: { ring: 'bg-canvas text-muted', text: 'text-muted', label: 'Neutral' },
};

export const SOURCE_STYLE = {
  CRM: 'bg-[#E6EDF7] text-[#2F5E9E]',
  Email: 'bg-[#EFEAF6] text-[#5B4B8A]',
  WhatsApp: 'bg-[#E4F2EA] text-[#1E7F4F]',
  Invoices: 'bg-[#FBF1DF] text-[#8A5A12]',
  Payments: 'bg-[#E0F2F2] text-[#0F6E70]',
  Support: 'bg-[#FBE9E6] text-[#A33224]',
  Website: 'bg-[#ECEEF0] text-[#4A5561]',
  Product: 'bg-[#E3EEF1] text-[#0E4D64]',
};

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function eventHeadline(e) {
  switch (e.type) {
    case 'PURCHASE_MADE': return `Purchase — ${money.format(e.amount || 0)}`;
    case 'PAYMENT_RECEIVED': return `Payment received — ${money.format(e.amount || 0)}`;
    case 'PAYMENT_OVERDUE': return `Payment overdue — ${money.format(e.amount || 0)}`;
    case 'COMPLAINT_RAISED': return e.title ? `Complaint: ${e.title}` : 'Complaint raised';
    case 'TICKET_OPENED': return e.title || 'Support ticket opened';
    case 'TICKET_RESOLVED': return e.title || 'Support ticket resolved';
    case 'EMAIL': return e.title ? `Email: ${e.title}` : 'Email';
    case 'WHATSAPP': return 'WhatsApp message';
    case 'WEBSITE_VISIT': return 'Website activity';
    case 'USAGE_INCREASED': return `Product usage up ${e.percent}%`;
    case 'USAGE_DECREASED': return `Product usage down ${e.percent}%`;
    case 'OPPORTUNITY_CREATED': return e.title ? `New opportunity: ${e.title}` : 'Opportunity created';
    case 'OPPORTUNITY_UPDATED': return e.title ? `${e.title} moved to ${e.stage || 'next stage'}` : 'Opportunity updated';
    case 'CONTRACT_CANCELLED': return 'Contract cancelled';
    default: return e.type;
  }
}
