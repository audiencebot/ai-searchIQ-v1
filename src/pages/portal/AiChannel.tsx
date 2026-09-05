import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { PageIntro } from '@/components/portal/dashboard/shared';
import { cn } from '@/lib/utils';
import { KpiCards } from '@/components/portal/ai-channel/KpiCards';
import { ChannelChart } from '@/components/portal/ai-channel/ChannelChart';
import { TopBots, TopPages } from '@/components/portal/ai-channel/TopPanels';
import { VisitsTable } from '@/components/portal/ai-channel/VisitsTable';
import { EmptyState } from '@/components/portal/ai-channel/EmptyState';
import type { BotClass } from '@/components/portal/ai-channel/shared';

const DAY_OPTIONS = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
] as const;

type Days = (typeof DAY_OPTIONS)[number]['days'];

/**
 * AI Channel Analytics — /app/ai-channel (PRD §4.7). Server-side measurement
 * of the AI channel: training crawls, citation fetches, and AI referrals
 * captured from the tenant's log drain. "Measured, not estimated."
 */
export default function AiChannel() {
  const [days, setDays] = useState<Days>(30);
  const [classFilter, setClassFilter] = useState<BotClass | ''>('');
  const [page, setPage] = useState(1);

  const summary = trpc.analytics.aiChannelSummary.useQuery({ days });
  const timeseries = trpc.analytics.aiChannelTimeseries.useQuery({ days });
  const topPages = trpc.analytics.aiChannelTopPages.useQuery({ days, limit: 10 });
  const visits = trpc.analytics.aiChannelVisits.useQuery({
    days,
    page,
    pageSize: 15,
    ...(classFilter ? { botClass: classFilter } : {}),
  });
  const connection = trpc.analytics.ingestConnection.useQuery();

  const hasData = (summary.data?.total ?? 0) > 0;

  const selectClass = (c: BotClass) => {
    setClassFilter(c);
    setPage(1);
    document.getElementById('ai-channel-visits')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Monitoring · measured, not estimated" title="The AI channel, from your own server logs.">
        <div className="flex gap-1.5">
          {DAY_OPTIONS.map((o) => (
            <button
              key={o.days}
              type="button"
              onClick={() => {
                setDays(o.days);
                setPage(1);
              }}
              className={cn(
                'badge-pill transition-colors duration-200',
                days === o.days
                  ? 'border-ares-primary bg-ares-primary/[0.06] text-ares-primary'
                  : 'text-ares-muted hover:text-ares-secondarytext'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </PageIntro>

      {summary.data && !hasData ? (
        <EmptyState connection={connection.data} />
      ) : (
        <>
          <KpiCards data={summary.data} isLoading={summary.isLoading} onSelect={selectClass} />
          <ChannelChart
            days={days}
            data={timeseries.data}
            isLoading={timeseries.isLoading}
            isError={timeseries.isError}
            onRetry={() => timeseries.refetch()}
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopBots data={summary.data} isLoading={summary.isLoading} />
            <TopPages data={topPages.data} isLoading={topPages.isLoading} />
          </div>
          <div id="ai-channel-visits">
            <VisitsTable
              data={visits.data}
              isLoading={visits.isLoading}
              filter={classFilter}
              onFilter={(f) => {
                setClassFilter(f);
                setPage(1);
              }}
              page={page}
              onPage={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
