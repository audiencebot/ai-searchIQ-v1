import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

export type LeaderboardRow = {
  rank: number;
  brandId: number;
  name: string;
  isPrimary: boolean;
  score: number;
  mentionRate: number;
  recommendationShare: number;
  trend: number;
};

function TrendCell({ trend }: { trend: number }) {
  const up = trend >= 0;
  return (
    <span className="inline-flex items-center gap-1 text-ares-muted">
      <Icon
        icon={up ? icons.altArrowUp : icons.altArrowDown}
        width={11}
        height={11}
        className={cn(up ? 'text-ares-primary' : 'text-ares-muted')}
      />
      <span>
        {up ? '+' : '−'}
        {Math.abs(trend)}
      </span>
    </span>
  );
}

/**
 * Leaderboard card (competitors.md §S2): data-table on identical methodology
 * + score-gap bar visual with the lead-gap bracket annotation.
 */
export default function Leaderboard({
  rows,
  scanLabel,
  onGapAnalysis,
  onResearch,
}: {
  rows: LeaderboardRow[];
  scanLabel: string;
  onGapAnalysis: (brandId: number) => void;
  onResearch: (brandId: number) => void;
}) {
  const tenant = rows.find((r) => r.isPrimary);
  const leader = rows[0];
  const maxScore = leader?.score ?? 100;
  const leadGap = leader && tenant && !leader.isPrimary ? leader.score - tenant.score : null;

  return (
    <section className="rounded-ares border border-ares-border bg-ares-card p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-label text-ares-primary">Competitor leaderboard · {scanLabel}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[640px]">
          <thead>
            <tr>
              <th className="w-12">Rank</th>
              <th>Brand</th>
              <th className="w-28">Visibility score</th>
              <th className="w-24">Mention rate</th>
              <th className="w-24">Rec. share</th>
              <th className="w-16">Trend</th>
              <th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={row.brandId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'group transition-shadow duration-200',
                  row.isPrimary && 'bg-ares-primary/[0.04]'
                )}
              >
                <td className="text-ares-muted">{String(row.rank).padStart(2, '0')}</td>
                <td>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        row.isPrimary ? 'font-normal text-ares-primary' : 'text-ares-secondarytext'
                      )}
                    >
                      {row.name}
                    </span>
                    {row.isPrimary && (
                      <span className="badge-pill border-ares-primary/40 text-ares-primary">You</span>
                    )}
                  </span>
                </td>
                <td className="font-normal text-ares-primary">{row.score}</td>
                <td className="text-ares-secondarytext">{row.mentionRate}%</td>
                <td className="text-ares-secondarytext">{row.recommendationShare}%</td>
                <td>
                  <TrendCell trend={row.trend} />
                </td>
                <td className="text-right">
                  {!row.isPrimary && (
                    <span className="invisible inline-flex items-center gap-3 text-[10px] text-ares-link opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => onGapAnalysis(row.brandId)}
                        className="uppercase tracking-[0.08em] transition-colors duration-150 hover:text-ares-primary"
                      >
                        Gap analysis
                      </button>
                      <button
                        type="button"
                        onClick={() => onResearch(row.brandId)}
                        className="uppercase tracking-[0.08em] transition-colors duration-150 hover:text-ares-primary"
                      >
                        Research
                      </button>
                    </span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Score-gap visual */}
      <div className="mt-6 space-y-2.5">
        {rows.map((row, i) => (
          <div key={row.brandId} className="flex items-center gap-3">
            <span
              className={cn(
                'w-36 truncate text-[11px]',
                row.isPrimary ? 'font-normal text-ares-primary' : 'text-ares-secondarytext'
              )}
            >
              {row.name}
            </span>
            <div className="bar-track flex-1">
              <motion.div
                className={cn(
                  'h-full rounded-ares',
                  row.isPrimary ? 'bg-ares-primary' : 'bg-ares-muted'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${(row.score / maxScore) * 100}%` }}
                transition={{ duration: 0.9, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span
              className={cn(
                'w-8 text-right text-[11px]',
                row.isPrimary ? 'font-normal text-ares-primary' : 'text-ares-muted'
              )}
            >
              {row.score}
            </span>
          </div>
        ))}
        {leadGap !== null && leadGap > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.9 }}
            className="pt-1 text-[10px] text-ares-muted"
          >
            <span className="text-ares-primary">⌞</span> {leadGap}-point lead gap — concentrated in
            comparison &amp; decision-stage prompts.
          </motion.p>
        )}
      </div>
    </section>
  );
}
