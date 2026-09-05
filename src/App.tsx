import { Routes, Route } from 'react-router';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import PortalLayout from '@/components/portal/PortalLayout';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
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
