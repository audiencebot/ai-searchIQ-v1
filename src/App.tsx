import { Routes, Route } from 'react-router';
import Layout from '@/components/Layout';
import AuthLayout from '@/components/AuthLayout';
import PortalLayout from '@/components/portal/PortalLayout';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import StubPage from '@/pages/StubPage';

export default function App() {
  return (
    <Routes>
      {/* Marketing site */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/platform" element={<StubPage title="Platform" />} />
        <Route path="/pricing" element={<StubPage title="Pricing" />} />
        <Route path="/sample-report" element={<StubPage title="Sample Report" />} />
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Member portal — gated by the graft's AuthLayout (sign-in wall +
          session handling); PortalLayout keeps its own nav inside it. */}
      <Route
        path="/app"
        element={
          <AuthLayout>
            <PortalLayout />
          </AuthLayout>
        }
      >
        <Route index element={<StubPage title="Dashboard" />} />
        <Route path="monitoring" element={<StubPage title="Prompt Monitoring" />} />
        <Route path="competitors" element={<StubPage title="Competitors" />} />
        <Route path="citations" element={<StubPage title="Citations & Sources" />} />
        <Route path="alerts" element={<StubPage title="Alerts" />} />
        <Route path="action-plan" element={<StubPage title="Action Plan" />} />
        <Route path="ask" element={<StubPage title="Ask AI Search IQ" />} />
        <Route path="report" element={<StubPage title="Monthly Report" />} />
        <Route path="settings" element={<StubPage title="Settings" />} />
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
