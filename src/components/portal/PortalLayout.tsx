import { useState } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router';
import { Icon } from '@iconify/react';
import type { IconifyIcon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { trpc } from '@/providers/trpc';
import { PLAN_LABELS, type PlanTier } from '@contracts/constants';
import CopilotDrawer from '@/components/portal/CopilotDrawer';

type NavItem = { to: string; label: string; icon: IconifyIcon; badge?: number; end?: boolean };
type NavSection = { title: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/app', label: 'Dashboard', icon: icons.chart2, end: true },
      { to: '/app/report', label: 'Monthly Report', icon: icons.documentText },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { to: '/app/monitoring', label: 'Prompt Monitoring', icon: icons.eye },
      { to: '/app/ai-channel', label: 'AI Channel', icon: icons.pulse2 },
      { to: '/app/competitors', label: 'Competitors', icon: icons.usersGroupRounded },
      { to: '/app/citations', label: 'Citations & Sources', icon: icons.linkLinear },
      { to: '/app/alerts', label: 'Alerts', icon: icons.dangerTriangle, badge: 3 },
    ],
  },
  {
    title: 'Action',
    items: [
      { to: '/app/action-plan', label: 'Action Plan', icon: icons.target },
      { to: '/app/ask', label: 'Ask AI Search IQ', icon: icons.chatRoundDots },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/monitoring': 'Prompt Monitoring',
  '/app/ai-channel': 'AI Channel Analytics',
  '/app/competitors': 'Competitors',
  '/app/citations': 'Citations & Sources',
  '/app/alerts': 'Alerts',
  '/app/action-plan': 'Action Plan',
  '/app/ask': 'Ask AI Search IQ',
  '/app/report': 'Monthly Report',
  '/app/settings': 'Settings',
};

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  // HQ nav section is visible to staff only (client-management-plan.md §1).
  const access = trpc.hq.access.useQuery(undefined, { retry: false });
  const isStaff = access.data?.staff === true;
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <Link
        to="/app"
        className={cn(
          'flex h-14 items-center gap-2.5 border-b border-white/10',
          collapsed ? 'justify-center px-0' : 'px-5'
        )}
      >
        <Icon icon={icons.radar2} width={20} height={20} className="shrink-0 text-ares-primary" />
        {!collapsed && (
          <span className="text-[13px] font-light tracking-[0.02em] text-white">AI Search IQ</span>
        )}
      </Link>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-4">
        {isStaff && (
          <div className="mb-5">
            {!collapsed && <p className="font-label px-5 pb-2 text-white/40">HQ</p>}
            <ul className="space-y-0.5 px-2">
              <li>
                <NavLink
                  to="/admin"
                  title={collapsed ? 'HQ admin' : undefined}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-3 rounded-ares px-3 py-2 text-[12px] font-light transition-colors duration-150',
                      collapsed && 'justify-center px-0',
                      isActive ? 'bg-ares-primary/[0.12] text-white' : 'text-white/55 hover:text-white'
                    )
                  }
                >
                  <Icon icon={icons.shieldCheck} width={18} height={18} className="shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">HQ admin</span>}
                </NavLink>
              </li>
            </ul>
          </div>
        )}
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            {!collapsed && (
              <p className="font-label px-5 pb-2 text-white/40">{section.title}</p>
            )}
            <ul className="space-y-0.5 px-2">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'relative flex items-center gap-3 rounded-ares px-3 py-2 text-[12px] font-light transition-colors duration-150',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-ares-primary/[0.12] text-white'
                          : 'text-white/55 hover:text-white'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-ares bg-ares-primary" />
                        )}
                        <Icon icon={item.icon} width={18} height={18} className="shrink-0" />
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!collapsed && item.badge !== undefined && (
                          <span className="rounded-ares bg-ares-primary px-1.5 py-0.5 text-[9px] font-normal leading-none text-white">
                            {item.badge}
                          </span>
                        )}
                        {collapsed && item.badge !== undefined && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-ares-primary" />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom: settings + user card */}
      <div className="border-t border-white/10 p-2">
        <NavLink
          to="/app/settings"
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-3 rounded-ares px-3 py-2 text-[12px] font-light transition-colors duration-150',
              collapsed && 'justify-center px-0',
              isActive ? 'bg-ares-primary/[0.12] text-white' : 'text-white/55 hover:text-white'
            )
          }
        >
          <Icon icon={icons.settings} width={18} height={18} className="shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <div
          className={cn(
            'mt-2 flex items-center gap-3 rounded-ares px-3 py-2',
            collapsed && 'justify-center px-0'
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ares-primary text-[10px] font-normal tracking-[0.05em] text-white">
            NA
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[12px] font-light text-white">Northwind Advisory</p>
              <p className="text-[10px] font-light text-white/40">Admin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Portal shell (nested-route pattern — renders <Outlet/>).
 * 240px dark sidebar (collapsible to 64px icon rail), 56px topbar,
 * content canvas on pageBg, and the global CopilotDrawer.
 */
export default function PortalLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Dashboard';
  const bootstrap = trpc.bootstrap.status.useQuery();
  const tenant = bootstrap.data?.tenant;
  const tenantChip = tenant
    ? `${tenant.name} · ${tenant.industry} · ${PLAN_LABELS[tenant.plan as PlanTier]}`
    : 'Northwind Advisory · Professional Services';

  return (
    <div className="flex min-h-[100dvh] bg-ares-pageBg">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden bg-ares-tertiary transition-[width] duration-200 lg:block',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile off-canvas sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-ares-tertiary/60 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-60 bg-ares-tertiary lg:hidden"
            >
              <SidebarContent collapsed={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div
        className={cn(
          'flex min-h-[100dvh] flex-1 flex-col transition-[margin] duration-200',
          collapsed ? 'lg:ml-16' : 'lg:ml-60'
        )}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ares-border bg-ares-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-ares text-ares-secondarytext hover:text-ares-primary lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Icon icon={icons.hamburgerMenu} width={20} height={20} />
            </button>
            <button
              className="hidden h-9 w-9 items-center justify-center rounded-ares text-ares-secondarytext hover:text-ares-primary lg:flex"
              onClick={() => setCollapsed((v) => !v)}
              aria-label="Collapse sidebar"
            >
              <Icon
                icon={icons.altArrowLeft}
                width={18}
                height={18}
                className={cn('transition-transform duration-200', collapsed && 'rotate-180')}
              />
            </button>
            <h1 className="font-display text-[18px]">{pageTitle}</h1>
            <span className="badge-pill hidden text-ares-muted md:inline-flex">{tenantChip}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge-pill hidden text-ares-muted sm:inline-flex">
              <Icon icon={icons.refresh} width={12} height={12} className="text-ares-primary" />
              Last scan: Today 06:00 · Complete
            </span>
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-ares border border-ares-border text-ares-secondarytext transition-colors duration-200 hover:text-ares-primary"
              aria-label="Notifications"
            >
              <Icon icon={icons.bell} width={17} height={17} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-ares-primary" />
            </button>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ares-tertiary text-[10px] font-normal tracking-[0.05em] text-white">
              NA
            </span>
          </div>
        </header>

        {/* Content canvas */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-[1200px]">
            <Outlet />
          </div>
        </main>
      </div>

      <CopilotDrawer />
    </div>
  );
}
