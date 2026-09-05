import { Reveal, Skeleton, fmtDate } from '@/components/portal/dashboard/shared';
import { CLASS_COLORS, CLASS_LABELS, type BotClass, type Summary, type TopPages } from './shared';

/** S4a — top bots bar list (per-engine activity, ranked by volume). */
export function TopBots({
  data,
  isLoading,
}: {
  data: Summary | undefined;
  isLoading: boolean;
}) {
  const bots = data?.topBots ?? [];
  const max = Math.max(1, ...bots.map((b) => b.count));
  return (
    <Reveal delay={0.15} className="action-card p-6">
      <p className="font-label text-ares-primary">Bot activity by engine</p>
      {isLoading && <Skeleton className="mt-4 h-[220px] w-full" />}
      {!isLoading && bots.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {bots.map((b) => (
            <li key={b.botName} className="group">
              <div className="flex items-baseline justify-between gap-3 text-[12px] font-light">
                <span className="truncate text-ares-secondarytext">{b.botName}</span>
                <span className="font-normal text-ares-primary">{b.count.toLocaleString()}</span>
              </div>
              <div className="mt-1 h-[6px] w-full rounded-ares bg-ares-secondary/40">
                <div
                  className="h-full rounded-ares transition-[width] duration-700"
                  style={{
                    width: `${Math.round((b.count / max) * 100)}%`,
                    background: CLASS_COLORS[b.botClass as BotClass] ?? '#344148',
                  }}
                  title={CLASS_LABELS[b.botClass as BotClass] ?? b.botClass}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Reveal>
  );
}

/** S4b — most-crawled / most-fetched paths (citation-fetch map). */
export function TopPages({
  data,
  isLoading,
}: {
  data: TopPages | undefined;
  isLoading: boolean;
}) {
  const pages = data ?? [];
  return (
    <Reveal delay={0.2} className="action-card p-6">
      <p className="font-label text-ares-primary">Top pages in the AI channel</p>
      {isLoading && <Skeleton className="mt-4 h-[220px] w-full" />}
      {!isLoading && pages.length > 0 && (
        <table className="mt-4 w-full text-[12px] font-light">
          <thead>
            <tr className="border-b border-ares-border text-left font-label text-ares-muted">
              <th className="pb-2 pr-3">Path</th>
              <th className="pb-2 pr-3 text-right">Hits</th>
              <th className="pb-2 text-right">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.path} className="border-b border-ares-border2 last:border-0">
                <td className="max-w-[220px] truncate py-2 pr-3 text-ares-secondarytext">
                  {p.path}
                </td>
                <td className="py-2 pr-3 text-right font-normal text-ares-primary">
                  {p.count.toLocaleString()}
                </td>
                <td className="py-2 text-right text-ares-muted">{fmtDate(p.lastVisitedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Reveal>
  );
}
