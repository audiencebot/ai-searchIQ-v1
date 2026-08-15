import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { ErrorCard, Skeleton, fmtDate, useCountUp, EASE_OUT, type RouterOutputs } from './shared';

type KpisData = RouterOutputs['dashboard']['kpis'];
export type Kpi = KpisData['kpis'][number];

function KpiValue({ kpi, index }: { kpi: Kpi; index: number }) {
  const numeric = typeof kpi.value === 'number';
  const counted = useCountUp(numeric ? (kpi.value as number) : 0, 1000, index * 80);
  return (
    <p className="font-display-num mt-2 text-[28px]">
      {numeric ? counted : kpi.value}
      {kpi.unit && <span className="text-[20px]">{kpi.unit}</span>}
    </p>
  );
}

export function KpiTileGrid({
  data,
  isLoading,
  isError,
  onRetry,
  onSelect,
}: {
  data: KpisData | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelect: (kpi: Kpi) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="kpi-tile">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-3 h-2.5 w-32" />
          </div>
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return (
      <ErrorCard
        message="Dashboard data unlocks after your first completed scan."
        onRetry={onRetry}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.kpis.map((kpi, i) => (
        <motion.button
          key={kpi.id}
          type="button"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.07, ease: EASE_OUT }}
          onClick={() => onSelect(kpi)}
          className={cn(
            'kpi-tile relative text-left',
            i === 0 && 'before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-ares before:bg-ares-primary'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-label text-ares-muted">{kpi.label}</p>
            {i === 0 && (
              <Icon icon={icons.arrowRightUp} width={14} height={14} className="text-ares-primary" />
            )}
          </div>
          <KpiValue kpi={kpi} index={i} />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.08 }}
            className="mt-1 text-[10px] font-light text-ares-muted"
          >
            {kpi.context} · <span className="text-ares-secondarytext">{kpi.deltaText}</span>
          </motion.p>
        </motion.button>
      ))}
    </div>
  );
}

/**
 * KPI drill-down drawer (dashboard.md §S2): 440px right drawer titled
 * "<KPI> — evidence", listing the contributing prompts/engines behind the
 * metric, with links into /app/monitoring.
 */
export function KpiEvidenceDrawer({ kpi, onClose }: { kpi: Kpi | null; onClose: () => void }) {
  const open = kpi !== null;
  const heatmap = trpc.monitoring.heatmap.useQuery(undefined, { enabled: open });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-ares-tertiary/30"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 440 }}
            animate={{ x: 0 }}
            exit={{ x: 440 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-ares-border bg-ares-surface"
          >
            <div className="flex h-14 items-center justify-between border-b border-ares-border px-5">
              <span className="font-display text-[15px]">{kpi.label} — evidence</span>
              <button
                onClick={onClose}
                aria-label="Close evidence drawer"
                className="flex h-8 w-8 items-center justify-center rounded-ares text-ares-muted transition-colors duration-200 hover:text-ares-primary"
              >
                <Icon icon={icons.closeCircle} width={18} height={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {heatmap.isLoading && (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              )}
              {heatmap.isError && (
                <ErrorCard
                  message="Could not load the contributing scan rows."
                  onRetry={() => heatmap.refetch()}
                />
              )}
              {heatmap.data && (
                <>
                  <p className="font-label mb-3 text-ares-muted">
                    Contributing prompts · {fmtDate(heatmap.data.scanDate)} scan
                  </p>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Prompt</th>
                        <th>Category</th>
                        <th className="text-right">Mentioned</th>
                        <th className="text-right">Peak</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.data.rows.map((row) => {
                        const mentioned = row.cells.filter((c) => c.mentioned);
                        const peak = Math.max(...row.cells.map((c) => c.intensity));
                        return (
                          <tr key={row.promptId}>
                            <td className="max-w-[160px] truncate text-ares-text">{row.text}</td>
                            <td className="text-ares-muted">{row.categoryLabel}</td>
                            <td className="text-right text-ares-secondarytext">
                              {mentioned.length}/{row.cells.length}
                            </td>
                            <td className="text-right font-normal text-ares-primary">
                              {Math.round(peak * 100)}%
                            </td>
                            <td className="text-right">
                              <Link
                                to="/app/monitoring"
                                className="text-ares-link transition-colors duration-200 hover:text-ares-primary"
                                aria-label={`Open ${row.text} in prompt monitoring`}
                              >
                                <Icon icon={icons.arrowRight} width={14} height={14} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="border-t border-ares-border p-5">
              <Link to="/app/monitoring" className="btn-secondary w-full" onClick={onClose}>
                Open prompt monitoring
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function useKpiDrawer() {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  return { kpi, open: setKpi, close: () => setKpi(null) };
}
