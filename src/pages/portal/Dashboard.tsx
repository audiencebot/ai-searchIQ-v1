import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { PageIntro, fmtMonthYear } from '@/components/portal/dashboard/shared';
import { KpiEvidenceDrawer, KpiTileGrid, useKpiDrawer, type Kpi } from '@/components/portal/dashboard/KpiTiles';
import { ScoreByEngine, ScoreComponents } from '@/components/portal/dashboard/ScorePanels';
import { TrendChart } from '@/components/portal/dashboard/TrendChart';
import { BottomRow } from '@/components/portal/dashboard/BottomRow';
import { CopilotTeaser } from '@/components/portal/dashboard/CopilotTeaser';

const WINDOWS = [
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '180D', days: 180 },
  { label: 'ALL', days: 365 },
] as const;

/**
 * Portal Dashboard — /app (dashboard.md). Six KPI tiles, score-by-engine bars,
 * score components table, visibility trend, bottom row, copilot teaser.
 */
export default function Dashboard() {
  const [days, setDays] = useState<number>(90);
  const kpis = trpc.dashboard.kpis.useQuery();
  const bootstrap = trpc.bootstrap.status.useQuery();
  const byEngine = trpc.dashboard.scoreByEngine.useQuery();
  const components = trpc.dashboard.components.useQuery();
  const trend = trpc.dashboard.trend.useQuery({ days });
  const drawer = useKpiDrawer();

  const tenantName = bootstrap.data?.tenant?.name ?? 'Northwind Advisory';
  const monthLabel = kpis.data?.scanDate ? fmtMonthYear(kpis.data.scanDate) : '';
  const title = monthLabel ? `${tenantName} — ${monthLabel}.` : `${tenantName}.`;

  return (
    <div className="space-y-6">
      {/* S1 — page header */}
      <PageIntro eyebrow="AI Visibility Intelligence" title={title}>
        <div className="flex rounded-ares border border-ares-border">
          {WINDOWS.map((w) => (
            <button
              key={w.label}
              type="button"
              onClick={() => setDays(w.days)}
              className={cn(
                'px-3 py-1.5 text-[10px] font-light uppercase tracking-[0.08em] transition-colors duration-200',
                days === w.days
                  ? 'bg-ares-primary/[0.06] text-ares-primary'
                  : 'text-ares-muted hover:text-ares-secondarytext'
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
        <Link to="/app/report" className="btn-secondary !px-3 !py-1.5 text-[10px]">
          <Icon icon={icons.downloadMinimalistic} width={13} height={13} />
          Download report
        </Link>
      </PageIntro>

      {/* S2 — KPI tiles */}
      <KpiTileGrid
        data={kpis.data}
        isLoading={kpis.isLoading}
        isError={kpis.isError}
        onRetry={() => kpis.refetch()}
        onSelect={(kpi: Kpi) => drawer.open(kpi)}
      />

      {/* S3 — score by engine + score components */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ScoreByEngine
            data={byEngine.data}
            isLoading={byEngine.isLoading}
            isError={byEngine.isError}
            onRetry={() => byEngine.refetch()}
          />
        </div>
        <div className="lg:col-span-5">
          <ScoreComponents
            data={components.data}
            isLoading={components.isLoading}
            isError={components.isError}
            onRetry={() => components.refetch()}
          />
        </div>
      </div>

      {/* S4 — visibility trend */}
      <TrendChart
        days={days}
        data={trend.data}
        isLoading={trend.isLoading}
        isError={trend.isError}
        onRetry={() => trend.refetch()}
      />

      {/* S5 — bottom row */}
      <BottomRow />

      {/* S6 — copilot teaser */}
      <CopilotTeaser />

      {/* KPI drill-down drawer */}
      <KpiEvidenceDrawer kpi={drawer.kpi} onClose={drawer.close} />
    </div>
  );
}
