import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerProfile from './pages/CustomerProfile';
import TimelinePage from './pages/TimelinePage';
import Simulator from './pages/Simulator';
import DataSources from './pages/DataSources';
import RiskInsights from './pages/RiskInsights';
import { EmptyState } from './components/ui';

function NotFound() {
  return <EmptyState title="This page doesn’t exist" action={<Link className="btn-primary" to="/">Go to dashboard</Link>}>Check the address, or use the menu to find what you need.</EmptyState>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerProfile />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="simulator" element={<Simulator />} />
            <Route path="sources" element={<DataSources />} />
            <Route path="insights" element={<RiskInsights />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
