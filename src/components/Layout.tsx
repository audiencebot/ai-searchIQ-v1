import { Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

/**
 * Marketing site layout (nested-route pattern — renders <Outlet/>).
 * Navbar is `sticky top-0` in normal document flow, so pages need no
 * nav-height offset. Full-bleed heroes opt out inside the page itself.
 */
export default function Layout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ares-pageBg">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
