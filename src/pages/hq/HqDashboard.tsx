import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import type { IconifyIcon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import PageHeader from '@/components/portal/alerts/PageHeader';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';

function KpiCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: IconifyIcon;
  hint?: string;
}) {
  return (
    <div className="rounded-ares border border-ares-border bg-ares-card p-5">
      <div className="flex items-center justify-between">
        <p className="font-label text-ares-muted">{label}</p>
        <Icon icon={icon} width={18} height={18} className="text-ares-primary" />
      </div>
      <p className="font-display-num mt-3 text-[28px] text-ares-text">{value}</p>
      {hint && <p className="mt-1 text-[11px] font-light text-ares-muted">{hint}</p>}
    </div>
  );
}

export default function HqDashboard() {
  const overview = trpc.hq.overview.useQuery();

  if (overview.isLoading) return <LoadingBlock rows={5} />;
  if (overview.error || !overview.data) {
    return (
      <ErrorBlock
        message={overview.error?.message}
        onRetry={() => overview.refetch()}
      />
    );
  }
  const d = overview.data;
  const totalClients = Object.values(d.byStatus).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader eyebrow="HQ · Overview" title="Client operations at a glance" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Clients"
          value={String(totalClients)}
          icon={icons.usersGroupRounded}
          hint={`${d.byStatus.onboarding ?? 0} onboarding · ${d.byStatus.active ?? 0} active · ${d.byStatus.paused ?? 0} paused · ${d.byStatus.churned ?? 0} churned`}
        />
        <KpiCard
          label="Audits pending kickoff"
          value={String(d.auditsPendingKickoff)}
          icon={icons.target}
          hint="Onboarding clients with no completed initial audit"
        />
        <KpiCard
          label="Reports this month"
          value={String(d.reportsThisMonth)}
          icon={icons.documentText}
        />
        <KpiCard
          label="MRR"
          value={`$${d.mrr.toLocaleString()}`}
          icon={icons.handMoney}
          hint="Growth tenants × $1,000"
        />
        <KpiCard
          label="DataForSEO spend"
          value={d.dataForSeoSpend === null ? '—' : `$${Number(d.dataForSeoSpend).toFixed(2)}`}
          icon={icons.globalLinear}
          hint={d.dataForSeoSpend === null ? 'No billed API tasks yet' : 'Sum of billed task costs (cached)'}
        />
        <div className="rounded-ares border border-ares-border bg-ares-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-label text-ares-muted">Failed emails</p>
            <Icon icon={icons.letter} width={18} height={18} className="text-ares-primary" />
          </div>
          <p className="font-display-num mt-3 text-[28px] text-ares-text">{d.failedEmails}</p>
          {d.failedEmails > 0 && (
            <Link
              to="/admin/reports"
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-light text-ares-primary hover:underline"
            >
              Review in Reports
              <Icon icon={icons.arrowRight} width={12} height={12} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
