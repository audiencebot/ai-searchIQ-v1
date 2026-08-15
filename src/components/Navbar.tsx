import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { to: '/platform', label: 'Platform' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/sample-report', label: 'Sample Report' },
  { to: '/#faq', label: 'FAQ' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 backdrop-blur-[8px] transition-all duration-200',
        scrolled
          ? 'border-b border-ares-border bg-ares-pageBg/95'
          : 'border-b border-transparent bg-ares-pageBg/90'
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <Link to="/" className="flex items-center gap-2.5">
            <Icon icon={icons.radar2} width={20} height={20} className="text-ares-primary" />
            <span className="text-[13px] font-light tracking-[0.02em] text-ares-tertiary">
              AI Search IQ
            </span>
          </Link>
        </motion.div>

        {/* Desktop links */}
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link, i) => (
            <motion.div
              key={link.to}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08 + i * 0.04 }}
            >
              {link.to.startsWith('/#') ? (
                <a
                  href={link.to}
                  className="text-[12px] font-light uppercase tracking-[0.04em] text-ares-secondarytext transition-colors duration-200 hover:text-ares-primary"
                >
                  {link.label}
                </a>
              ) : (
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'text-[12px] font-light uppercase tracking-[0.04em] transition-colors duration-200 hover:text-ares-primary',
                      isActive ? 'text-ares-primary' : 'text-ares-secondarytext'
                    )
                  }
                >
                  {link.label}
                </NavLink>
              )}
            </motion.div>
          ))}
        </nav>

        {/* Right actions */}
        <div className="hidden items-center gap-3 lg:flex">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.28 }}
          >
            {/* AUTH-SLOT: rewired to useAuth() in Phase 5 */}
            <Link
              to="/login"
              className="btn-secondary !px-4 !py-2 text-[11px]"
            >
              Sign in
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.34 }}
          >
            <Link to="/login?intent=report" className="btn-primary !px-4 !py-2 text-[11px]">
              Request your report
            </Link>
          </motion.div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-ares text-ares-tertiary lg:hidden"
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          <Icon icon={drawerOpen ? icons.closeCircle : icons.hamburgerMenu} width={22} height={22} />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-16 z-40 bg-ares-tertiary lg:hidden"
          >
            <nav className="flex flex-col gap-2 p-8">
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                >
                  {link.to.startsWith('/#') ? (
                    <a
                      href={link.to}
                      className="block py-3 text-[15px] font-light uppercase tracking-[0.06em] text-white/70 hover:text-white"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <NavLink
                      to={link.to}
                      className="block py-3 text-[15px] font-light uppercase tracking-[0.06em] text-white/70 hover:text-white"
                    >
                      {link.label}
                    </NavLink>
                  )}
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: NAV_LINKS.length * 0.06 }}
                className="mt-6 flex flex-col gap-3"
              >
                {/* AUTH-SLOT: rewired to useAuth() in Phase 5 */}
                <Link to="/login" className="btn-secondary-dark justify-center">
                  Sign in
                </Link>
                <Link to="/login?intent=report" className="btn-primary justify-center">
                  Request your report
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
