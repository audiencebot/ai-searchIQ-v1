import { Routes, Route } from 'react-router';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import PortalLayout from '@/components/portal/PortalLayout';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import DevLogin from '@/pages/DevLogin';
import Platform from '@/pages/Platform';
import Pricing from '@/pages/Pricing';
import SampleReport from '@/pages/SampleReport';
import Dashboard from '@/pages/portal/Dashboard';
import Monitoring from '@/pages/portal/Monitoring';
import AiChannel from '@/pages/portal/AiChannel';
import Competitors from '@/pages/portal/Competitors';
import Citations from '@/pages/portal/Citations';
import Alerts from '@/pages/portal/Alerts';
import ActionPlan from '@/pages/portal/ActionPlan';
import Ask from '@/pages/portal/Ask';
import Report from '@/pages/portal/Report';
import Settings from '@/pages/portal/Settings';
import Connect from '@/pages/Connect';
import HqLayout from '@/pages/hq/HqLayout';
import HqDashboard from '@/pages/hq/HqDashboard';
import HqClients from '@/pages/hq/HqClients';
import HqClientDetail from '@/pages/hq/HqClientDetail';
import HqReports from '@/pages/hq/HqReports';
import HqCosts from '@/pages/hq/HqCosts';
import HqSettings from '@/pages/hq/HqSettings';

export default function App() {
  return (
    <Routes>
      {/* Marketing site */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/platform" element={<Platform />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/sample-report" element={<SampleReport />} />
        <Route path="/login" element={<Login />} />
        {/* Local dev kit — env-gated dev login entry (see docs/LOCAL_DEV.md) */}
        <Route path="/dev-login" element={<DevLogin />} />
      </Route>

      {/* Member portal — gated by RequireAuth (useAuth + LOGIN_PATH contract);
          PortalLayout provides the portal's own sidebar shell. */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <PortalLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="monitoring" element={<Monitoring />} />
        <Route path="ai-channel" element={<AiChannel />} />
        <Route path="competitors" element={<Competitors />} />
        <Route path="citations" element={<Citations />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="action-plan" element={<ActionPlan />} />
        <Route path="ask" element={<Ask />} />
        <Route path="report" element={<Report />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Public client onboarding — tokenized Google connect (no login) */}
      <Route path="/connect/:inviteToken" element={<Connect />} />

      {/* HQ admin — staff-only (HqLayout gates via hq.access; non-staff are
          redirected to /app with no trace). */}
      <Route path="/admin" element={<HqLayout />}>
        <Route index element={<HqDashboard />} />
        <Route path="clients" element={<HqClients />} />
        <Route path="clients/:tenantId" element={<HqClientDetail />} />
        <Route path="reports" element={<HqReports />} />
        <Route path="costs" element={<HqCosts />} />
        <Route path="settings" element={<HqSettings />} />
      </Route>

      <Route path="*" element={<Layout404 />} />
    </Routes>
  );
}

function Layout404() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-ares-pageBg">
      <p className="font-label text-ares-primary">404</p>
      <h1 className="font-display mt-3 text-[32px]">Page not found.</h1>
      <a href="/" className="btn-secondary mt-6">
        Back to home
      </a>
    </div>
  );
}
