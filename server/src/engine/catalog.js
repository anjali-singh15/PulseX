// Single source of truth for event types, source systems, relationship states and simulator presets.
// The frontend reads all of this from GET /api/meta so nothing is duplicated in the UI.

const STATES = ['Growing', 'Stable', 'Recovering', 'At Risk', 'Lost'];

const SOURCES = {
  CRM: { name: 'CRM', description: 'Accounts, contacts and opportunities', prefix: 'CRM' },
  Email: { name: 'Email', description: 'Customer email threads', prefix: 'EML' },
  WhatsApp: { name: 'WhatsApp Business', description: 'Chats with customer contacts', prefix: 'WA' },
  Invoices: { name: 'Invoicing (ERP)', description: 'Orders and invoices raised', prefix: 'INV' },
  Payments: { name: 'Payments', description: 'Collections and overdue ledger', prefix: 'PAY' },
  Support: { name: 'Support desk', description: 'Complaints and support tickets', prefix: 'TKT' },
  Website: { name: 'Website', description: 'Visits, form fills and downloads', prefix: 'WEB' },
  Product: { name: 'Product telemetry', description: 'Seat and feature usage', prefix: 'USG' },
};

// polarity: default direction of impact before the engine measures the real change
const EVENT_TYPES = {
  PURCHASE_MADE: { label: 'Purchase made', category: 'Purchase', source: 'Invoices', amount: true, polarity: 1 },
  PAYMENT_RECEIVED: { label: 'Payment received', category: 'Payment', source: 'Payments', amount: true, polarity: 1 },
  PAYMENT_OVERDUE: { label: 'Payment overdue', category: 'Payment', source: 'Payments', amount: true, polarity: -1 },
  COMPLAINT_RAISED: { label: 'Complaint raised', category: 'Complaint', source: 'Support', text: true, polarity: -1 },
  TICKET_OPENED: { label: 'Support ticket opened', category: 'Support ticket', source: 'Support', polarity: 0 },
  TICKET_RESOLVED: { label: 'Support ticket resolved', category: 'Support ticket', source: 'Support', polarity: 1 },
  EMAIL: { label: 'Email', category: 'Email', source: 'Email', text: true, communication: true, polarity: 0 },
  WHATSAPP: { label: 'WhatsApp message', category: 'WhatsApp', source: 'WhatsApp', text: true, communication: true, polarity: 0 },
  WEBSITE_VISIT: { label: 'Website activity', category: 'Website', source: 'Website', polarity: 0 },
  USAGE_INCREASED: { label: 'Product usage increased', category: 'Product usage', source: 'Product', percent: true, polarity: 1 },
  USAGE_DECREASED: { label: 'Product usage decreased', category: 'Product usage', source: 'Product', percent: true, polarity: -1 },
  OPPORTUNITY_CREATED: { label: 'Opportunity created', category: 'Opportunity', source: 'CRM', amount: true, polarity: 1 },
  OPPORTUNITY_UPDATED: { label: 'Opportunity updated', category: 'Opportunity', source: 'CRM', polarity: 0 },
  CONTRACT_CANCELLED: { label: 'Contract cancelled', category: 'Contract', source: 'CRM', polarity: -1 },
};

const CATEGORIES = [...new Set(Object.values(EVENT_TYPES).map((t) => t.category))];

const OPPORTUNITY_STAGES = ['Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

// Buttons in the "Add customer event" modal and the Event Simulator
const PRESETS = [
  { key: 'complaint', label: 'Complaint raised', type: 'COMPLAINT_RAISED', tone: 'negative',
    defaults: { title: 'Repeated delays in spare-part deliveries', text: 'Production line stopped twice this week because replacement sensors were delayed. This is unacceptable.', severity: 'High' } },
  { key: 'payment_overdue', label: 'Payment overdue', type: 'PAYMENT_OVERDUE', tone: 'negative',
    defaults: { amount: 120000, description: 'Invoice 30 days past due date' } },
  { key: 'negative_email', label: 'Negative email', type: 'EMAIL', tone: 'negative',
    defaults: { title: 'Re: Service escalation', text: 'We are very disappointed with the repeated delays and poor response. We are considering other vendors.' } },
  { key: 'payment_received', label: 'Payment received', type: 'PAYMENT_RECEIVED', tone: 'positive',
    defaults: { amount: 120000, description: 'Payment received against overdue invoice' } },
  { key: 'ticket_resolved', label: 'Support ticket resolved', type: 'TICKET_RESOLVED', tone: 'positive',
    defaults: { description: 'Issue fixed and closed with customer confirmation' } },
  { key: 'positive_email', label: 'Positive email', type: 'EMAIL', tone: 'positive',
    defaults: { title: 'Thank you', text: 'Thanks for the quick resolution, the team is really happy with the support. Great work!' } },
  { key: 'purchase', label: 'Purchase made', type: 'PURCHASE_MADE', tone: 'positive',
    defaults: { amount: 450000, description: 'Order for 20 additional Core Platform seats' } },
  { key: 'usage_up', label: 'Product usage increased', type: 'USAGE_INCREASED', tone: 'positive',
    defaults: { percent: 15, description: 'Weekly active seats up after onboarding session' } },
  { key: 'usage_down', label: 'Product usage decreased', type: 'USAGE_DECREASED', tone: 'negative',
    defaults: { percent: 18, description: 'Weekly active seats dropped across two plants' } },
  { key: 'opportunity', label: 'Opportunity created', type: 'OPPORTUNITY_CREATED', tone: 'positive',
    defaults: { title: 'Expansion to Chakan plant', amount: 800000, stage: 'Qualification' } },
  { key: 'whatsapp', label: 'WhatsApp message', type: 'WHATSAPP', tone: 'neutral',
    defaults: { text: 'Can we schedule a call tomorrow at 11 to review the rollout plan?' } },
  { key: 'cancel', label: 'Contract cancelled', type: 'CONTRACT_CANCELLED', tone: 'negative',
    defaults: { description: 'Customer served termination notice' } },
];

module.exports = { STATES, SOURCES, EVENT_TYPES, CATEGORIES, OPPORTUNITY_STAGES, PRESETS };
