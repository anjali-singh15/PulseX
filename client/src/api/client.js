const BASE = import.meta.env.VITE_API_BASE || '/api';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the PulseX API. Start it with npm run dev.', 0);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.details);
  return data;
}

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const api = {
  meta: () => request('/meta'),
  dashboard: () => request('/dashboard'),
  customers: (params = {}) => request(`/customers${qs(params)}`),
  customer: (id) => request(`/customers/${id}`),
  events: (params = {}) => request(`/events${qs(params)}`),
  addEvent: (body) => request('/events', { method: 'POST', body }),
  sources: () => request('/sources'),
  identity: () => request('/sources/identity'),
  syncSource: (key) => request(`/sources/${key}/sync`, { method: 'POST' }),
  importDemo: () => request('/sources/import-demo', { method: 'POST' }),
  insights: () => request('/insights'),
  streamUrl: `${BASE}/stream`,
};
