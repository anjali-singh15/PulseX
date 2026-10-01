import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, History, Zap, Database, ShieldAlert, Menu, Plus, Search, X, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import AddEventModal from './AddEventModal';
import Toasts from './Toasts';
import { StateBadge } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/timeline', label: 'Relationship timeline', icon: History },
  { to: '/simulator', label: 'Event simulator', icon: Zap },
  { to: '/sources', label: 'Data sources', icon: Database },
  { to: '/insights', label: 'Risk & insights', icon: ShieldAlert },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#1B6A86" />
        <path d="M5 17h6l3-7 4 13 3-6h6" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="leading-tight">
        <div className="text-white font-semibold text-[16px]">PulseX</div>
        <div className="text-[11.5px] text-white/55">Customer 360° digital twin</div>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }) {
  const { live } = useApp();
  return (
    <div className="flex flex-col h-full bg-brand-dark">
      <Logo />
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 h-9 px-3 rounded-md text-[13.5px] transition-colors ${isActive ? 'bg-white/12 text-white font-medium' : 'text-white/65 hover:text-white hover:bg-white/5'}`}>
            <Icon size={16} />{label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-white/10">
        <div className="flex items-center gap-2 text-[12px] text-white/60">
          <span className={`h-2 w-2 rounded-full ${live ? 'bg-[#4CC38A]' : 'bg-white/30'}`} />
          {live ? 'Live updates on' : 'Reconnecting…'}
        </div>
        <p className="text-[11.5px] text-white/40 mt-2 leading-snug">One customer. One relationship. One live view.</p>
      </div>
    </div>
  );
}

function CustomerSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return undefined; }
    const t = setTimeout(() => api.customers({ search: q.trim(), sort: 'name' }).then((d) => { setResults(d.customers.slice(0, 7)); setActive(0); }).catch(() => setResults([])), 150);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (c) => { navigate(`/customers/${c._id}`); setQ(''); setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && results[active]) go(results[active]);
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="relative w-full max-w-sm" ref={box}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input className="input pl-9" placeholder="Find a customer" value={q} aria-label="Find a customer"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-11 bg-white border border-line rounded-lg shadow-pop py-1 z-40">
          {results.length ? results.map((c, i) => (
            <button key={c._id} onMouseDown={(e) => e.preventDefault()} onClick={() => go(c)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13.5px] ${i === active ? 'bg-canvas' : ''}`}>
              <span className="truncate">{c.name}<span className="text-muted text-[12px] ml-2">{c.industry}</span></span>
              <StateBadge state={c.state} size="sm" />
            </button>
          )) : <p className="px-3 py-2 text-[13px] text-muted">No customer matches “{q}”.</p>}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { openEventModal, metaError, loadMeta } = useApp();
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const profileId = location.pathname.match(/^\/customers\/([a-f0-9]{24})/)?.[1] || null;

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 z-30"><Sidebar /></aside>
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 animate-rise">
            <Sidebar onNavigate={() => setDrawer(false)} />
            <button className="absolute top-4 right-3 text-white/70 hover:text-white" onClick={() => setDrawer(false)} aria-label="Close menu"><X size={18} /></button>
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 bg-canvas/95 backdrop-blur border-b border-line">
        <div className="flex items-center gap-3 h-16 px-4 sm:px-6">
          <button className="lg:hidden btn-ghost h-9 w-9 px-0" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={18} /></button>
          <CustomerSearch />
          <div className="flex-1" />
          <button className="btn-primary" onClick={() => openEventModal(profileId)}>
            <Plus size={16} /><span className="hidden sm:inline">Add customer event</span><span className="sm:hidden">Event</span>
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 max-w-[1440px]">
        {metaError && (
          <div className="card card-pad mb-4 flex items-start gap-3 border-atrisk/30">
            <AlertCircle size={18} className="text-atrisk mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">The PulseX API is not reachable</p>
              <p className="text-[13px] text-muted">{metaError} Check that MongoDB is running and the server started without errors.</p>
            </div>
            <button className="btn-secondary btn-sm" onClick={loadMeta}>Retry</button>
          </div>
        )}
        <Outlet />
      </main>
      <AddEventModal />
      <Toasts />
    </div>
  );
}
