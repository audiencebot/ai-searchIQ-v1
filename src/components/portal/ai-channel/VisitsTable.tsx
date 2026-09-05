import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { Reveal, Skeleton } from '@/components/portal/dashboard/shared';
import {
  CLASS_COLORS,
  CLASS_LABELS,
  type BotClass,
  type Visits,
} from './shared';

const FILTERS: { id: BotClass | ''; label: string }[] = [
  { id: '', label: 'All signals' },
  { id: 'training_crawl', label: CLASS_LABELS.training_crawl },
  { id: 'citation_fetch', label: CLASS_LABELS.citation_fetch },
  { id: 'referral_visit', label: CLASS_LABELS.referral_visit },
];

function fmtTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** S5 — drillable raw crawler_visits rows with bot-class filter + paging. */
export function VisitsTable({
  data,
  isLoading,
  filter,
  onFilter,
  page,
  onPage,
}: {
  data: Visits | undefined;
  isLoading: boolean;
  filter: BotClass | '';
  onFilter: (f: BotClass | '') => void;
  page: number;
  onPage: (p: number) => void;
}) {
  const rows = data?.rows ?? [];
  return (
    <Reveal delay={0.25} className="action-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-label text-ares-primary">Captured requests — drilldown</p>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id || 'all'}
                type="button"
                onClick={() => onFilter(f.id)}
                className={cn(
                  'badge-pill transition-colors duration-200',
                  on
                    ? 'border-ares-primary bg-ares-primary/[0.06] text-ares-primary'
                    : 'text-ares-muted hover:text-ares-secondarytext'
                )}
              >
                {f.id && (
                  <span
                    className="h-[6px] w-[6px] rounded-full"
                    style={{ background: CLASS_COLORS[f.id] }}
                  />
                )}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && <Skeleton className="mt-4 h-[280px] w-full" />}
      {!isLoading && data && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[12px] font-light">
              <thead>
                <tr className="border-b border-ares-border text-left font-label text-ares-muted">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Signal</th>
                  <th className="pb-2 pr-3">Bot / source</th>
                  <th className="pb-2 pr-3">Path</th>
                  <th className="pb-2 pr-3 text-right">Status</th>
                  <th className="pb-2 pr-3">IP</th>
                  <th className="pb-2 text-right">Verified</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="border-b border-ares-border2 last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 text-ares-muted">
                      {fmtTime(v.visitedAt)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5 text-ares-secondarytext">
                        <span
                          className="h-[6px] w-[6px] rounded-full"
                          style={{ background: CLASS_COLORS[v.botClass as BotClass] }}
                        />
                        {CLASS_LABELS[v.botClass as BotClass] ?? v.botClass}
                      </span>
                    </td>
                    <td className="max-w-[160px] truncate py-2 pr-3 text-ares-secondarytext">
                      {v.botName ?? v.referer ?? '—'}
                    </td>
                    <td className="max-w-[220px] truncate py-2 pr-3 text-ares-secondarytext">
                      {v.path}
                    </td>
                    <td className="py-2 pr-3 text-right font-normal text-ares-primary">
                      {v.httpStatus}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-ares-muted">{v.ip}</td>
                    <td className="py-2 text-right">
                      <Icon
                        icon={v.verified ? icons.shieldCheck : icons.closeCircle}
                        width={14}
                        height={14}
                        className={cn('inline', v.verified ? 'text-ares-primary' : 'text-ares-muted')}
                      />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-ares-muted">
                      No captured requests for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] font-light text-ares-muted">
            <span>
              {data.total.toLocaleString()} requests · page {data.page} of {data.pageCount}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                className="btn-secondary px-3 py-1"
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn-secondary px-3 py-1"
                disabled={page >= data.pageCount}
                onClick={() => onPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </Reveal>
  );
}
