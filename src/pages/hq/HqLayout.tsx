import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, Link } from 'react-router';
import { Icon } from '@iconify/react';
import type { IconifyIcon } from '@iconify/react';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/hooks/useAuth';
import { AuthLayoutSkeleton } from '@/components/AuthLayoutSkeleton';

type NavItem = { to: string; label: string; icon: IconifyIcon; end?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: icons.chart2, end: true },
  { to: '/admin/clients', label: 'Clients', icon: icons.usersGroupRounded },
  { to: '/admin/reports', label: 'Reports', icon: icons.documentText },
  { to: '/admin/settings', label: 'Settings', icon: icons.settings },
];

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'HQ Dashboard',
  '/admin/clients': 'Clients',
  '/admin/reports': 'Reports & Email',
  '/admin/settings': 'HQ Settings',
};

/**
 * HQ admin shell (client-management-plan.md §6). Same visual language as
 * PortalLayout — dark navy sidebar, paper canvas — gated to staff
 * (OWNER_UNION_ID). Non-staff are redirected to /app with no HQ trace.
 */
export default function HqLayout() {
  const { user, isLoading: authLoading } = useAuth();
  const access = trpc.hq.access.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isStaff = access.data?.staff === true;
  const loading = authLoading || (Boolean(user) && access.isLoading);

  useEffect(() => {
    if (!loading && (!user || !isStaff)) {
      navigate('/app', { replace: true });
    }
  }, [loading, user, isStaff, navigate]);

  if (loading) return <AuthLayoutSkeleton />;
  if (!user || !isStaff) return null;

  const pageTitle =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith('/admin/clients/') ? 'Client detail' : 'HQ');

  return (
    <div className="flex min-h-[100dvh] bg-ares-pageBg">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden bg-ares-tertiary transition-[width] duration-200 lg:block',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className="flex h-full flex-col">
          <Link
            to="/admin"
            className={cn(
              'flex h-14 items-center gap-2.5 border-b border-white/10',
              collapsed ? 'justify-center px-0' : 'px-5'
            )}
          >
            <Icon icon={icons.radar2} width={20} height={20} className="shrink-0 text-ares-primary" />
            {!collapsed && (
              <span className="text-[13px] font-light tracking-[0.02em] text-white">
                AI Search IQ <span className="text-white/40">· HQ</span>
              </span>
            )}
          </Link>

          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-0.5 px-2">
              {NAV_ITEMS.map((item) => (
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
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-white/10 p-2">
            <NavLink
              to="/app"
              title={collapsed ? 'Client portal' : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-ares px-3 py-2 text-[12px] font-light text-white/55 transition-colors duration-150 hover:text-white',
                collapsed && 'justify-center px-0'
              )}
            >
              <Icon icon={icons.arrowRightUp} width={18} height={18} className="shrink-0" />
              {!collapsed && <span>Client portal</span>}
            </NavLink>
            <div
              className={cn(
                'mt-2 flex items-center gap-3 rounded-ares px-3 py-2',
                collapsed && 'justify-center px-0'
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ares-primary text-[10px] font-normal tracking-[0.05em] text-white">
                {(user.name ?? 'S').slice(0, 2).toUpperCase()}
              </span>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-light text-white">{user.name ?? 'Staff'}</p>
                  <p className="text-[10px] font-light text-white/40">HQ staff</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div
        className={cn(
          'flex min-h-[100dvh] flex-1 flex-col transition-[margin] duration-200',
          collapsed ? 'lg:ml-16' : 'lg:ml-60'
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ares-border bg-ares-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
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
            <span className="badge-pill hidden text-ares-muted md:inline-flex">HQ · staff only</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ares-tertiary text-[10px] font-normal tracking-[0.05em] text-white">
              {(user.name ?? 'S').slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-[1200px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
