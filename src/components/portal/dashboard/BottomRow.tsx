import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import {
  ENGINE_LABELS,
  ErrorCard,
  Reveal,
  SEVERITY_BAR,
  Skeleton,
  fmtDate,
  fmtDateLong,
  EASE_OUT,
  type RouterOutputs,
} from './shared';

type SidebarData = RouterOutputs['dashboard']['sidebarSummary'] | undefined;
type ScanRow = RouterOutputs['dashboard']['scanHistory'][number];

const PHASE_LABELS: Record<string, string> = { d30: '30 · Stabilize', d60: '60 · Build', d90: '90 · Expand' };

function OpenAlertsCard({ data, isLoading }: { data: SidebarData; isLoading: boolean }) {
  const alerts = data?.openAlerts ?? [];
  return (
    <Reveal delay={0.05} className="action-card flex flex-col p-6">
      <p className="font-label text-ares-primary">
        Open alerts{data ? ` · ${alerts.length}` : ''}
      </p>
      {isLoading && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {data && (
        <div className="mt-4 space-y-2.5">
          {alerts.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: EASE_OUT }}
              className="rounded-ares border border-ares-border bg-ares-card p-3"
              style={{ borderLeft: `3px solid ${SEVERITY_BAR[alert.severity] ?? '#8A7A6E'}` }}
            >
              <div className="flex items-center gap-2">
                <Icon
                  icon={icons.dangerTriangle}
                  width={16}
                  height={16}
                  style={{ color: SEVERITY_BAR[alert.severity] ?? '#8A7A6E' }}
                />
                <p className="text-[12px] font-normal text-ares-text">{alert.title}</p>
              </div>
              <p className="mt-1.5 text-[10px] font-light text-ares-muted">
                Engines affected:{' '}
                {alert.enginesAffected.map((e) => ENGINE_LABELS[e] ?? e).join(', ')} · Severity:{' '}
                <span className="capitalize">{alert.severity}</span>
              </p>
            </motion.div>
          ))}
        </div>
      )}
      <Link
        to="/app/alerts"
        className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[11px] font-light text-ares-link transition-colors duration-200 hover:text-ares-primary"
      >
        View all alerts <Icon icon={icons.arrowRight} width={12} height={12} />
      </Link>
    </Reveal>
  );
}

function PlanProgressCard({ data, isLoading }: { data: SidebarData; isLoading: boolean }) {
  return (
    <Reveal delay={0.15} className="action-card flex flex-col p-6">
      <p className="font-label text-ares-primary">30/60/90 plan</p>
      {isLoading && (
        <div className="mt-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}
      {data && (
        <div className="mt-4 space-y-4">
          {data.planPhases.map((phase, i) => {
            const pct = phase.total > 0 ? Math.round((phase.done / phase.total) * 100) : 0;
            return (
              <div key={phase.phase}>
                <div className="flex items-baseline justify-between">
                  <p className="text-[11px] font-normal text-ares-text">
                    {PHASE_LABELS[phase.phase] ?? phase.phase}
                  </p>
                  <p className="text-[10px] font-light text-ares-muted">
                    {phase.done}/{phase.total} done · {pct}%
                  </p>
                </div>
                <div className="bar-track mt-1.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: EASE_OUT }}
                    className="bar-fill"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Link
        to="/app/action-plan"
        className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[11px] font-light text-ares-link transition-colors duration-200 hover:text-ares-primary"
      >
        Open action plan <Icon icon={icons.arrowRight} width={12} height={12} />
      </Link>
    </Reveal>
  );
}

/** Read-only snapshot dialog (640px paper) for one historical scan. */
function ScanSnapshotModal({ scan, onClose }: { scan: ScanRow | null; onClose: () => void }) {
  const open = scan !== null;
  const heatmap = trpc.monitoring.heatmap.useQuery(
    scan ? { scanId: scan.id } : undefined,
    { enabled: open }
  );

  let mentionedPct: number | null = null;
  let recommendedPct: number | null = null;
  if (heatmap.data && heatmap.data.rows.length > 0) {
    const cells = heatmap.data.rows.flatMap((r) => r.cells);
    mentionedPct = Math.round((cells.filter((c) => c.mentioned).length / cells.length) * 100);
    recommendedPct = Math.round((cells.filter((c) => c.recommended).length / cells.length) * 100);
  }

  return (
    <AnimatePresence>
      {open && scan && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-ares-tertiary/30"
            onClick={onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="pointer-events-auto w-full max-w-[640px] rounded-ares border border-ares-border bg-ares-surface shadow-paper"
            >
              <div className="flex items-center justify-between border-b border-ares-border px-6 py-4">
                <div>
                  <p className="font-label text-ares-primary">Scan snapshot · read-only</p>
                  <p className="font-display mt-1 text-[18px]">{fmtDateLong(scan.date)}</p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close snapshot"
                  className="flex h-8 w-8 items-center justify-center rounded-ares text-ares-muted transition-colors duration-200 hover:text-ares-primary"
                >
                  <Icon icon={icons.closeCircle} width={18} height={18} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
                <div className="kpi-tile">
                  <p className="font-label text-ares-muted">Score</p>
                  <p className="font-display-num mt-1 text-[24px]">{scan.score ?? '—'}</p>
                </div>
                <div className="kpi-tile">
                  <p className="font-label text-ares-muted">Status</p>
                  <p className="mt-2 text-[13px] font-light capitalize text-ares-secondarytext">
                    {scan.status}
                  </p>
                </div>
                <div className="kpi-tile">
                  <p className="font-label text-ares-muted">Mentioned cells</p>
                  <p className="font-display-num mt-1 text-[24px]">
                    {heatmap.isLoading ? '…' : mentionedPct !== null ? `${mentionedPct}%` : '—'}
                  </p>
                </div>
                <div className="kpi-tile">
                  <p className="font-label text-ares-muted">Recommended</p>
                  <p className="font-display-num mt-1 text-[24px]">
                    {heatmap.isLoading ? '…' : recommendedPct !== null ? `${recommendedPct}%` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-ares-border px-6 py-4">
                <p className="text-[10px] font-light text-ares-muted">
                  Historical snapshot — current values may differ.
                </p>
                <button className="btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function ScanHistoryCard({
  data,
  isLoading,
  isError,
  onRetry,
  onSelect,
}: {
  data: ScanRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelect: (scan: ScanRow) => void;
}) {
  return (
    <Reveal delay={0.25} className="action-card p-6">
      <p className="font-label text-ares-primary">Scan history</p>
      {isLoading && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}
      {isError && (
        <ErrorCard className="mt-4 border-0 p-6" message="Scan history unavailable." onRetry={onRetry} />
      )}
      {data && (
        <table className="data-table mt-3">
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th className="text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((scan) => (
              <tr
                key={scan.id}
                onClick={() => onSelect(scan)}
                className="cursor-pointer transition-colors duration-150 hover:bg-ares-primary/[0.04]"
              >
                <td className="text-ares-text">{fmtDate(scan.date)}</td>
                <td
                  className={
                    scan.status === 'complete' ? 'text-ares-secondarytext' : 'text-ares-primaryDark'
                  }
                >
                  <span className="inline-flex items-center gap-1.5 capitalize">
                    {scan.status !== 'complete' && (
                      <Icon icon={icons.refresh} width={11} height={11} />
                    )}
                    {scan.status === 'partial' ? 'Partial — retrying' : scan.status}
                  </span>
                </td>
                <td className="text-right font-normal text-ares-primary">{scan.score ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Reveal>
  );
}

/** S5 — three-column bottom row. */
export function BottomRow() {
  const summary = trpc.dashboard.sidebarSummary.useQuery();
  const history = trpc.dashboard.scanHistory.useQuery({ limit: 3 });
  const [selectedScan, setSelectedScan] = useState<ScanRow | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <OpenAlertsCard data={summary.data} isLoading={summary.isLoading} />
        <PlanProgressCard data={summary.data} isLoading={summary.isLoading} />
        <ScanHistoryCard
          data={history.data}
          isLoading={history.isLoading}
          isError={history.isError}
          onRetry={() => history.refetch()}
          onSelect={setSelectedScan}
        />
      </div>
      <ScanSnapshotModal scan={selectedScan} onClose={() => setSelectedScan(null)} />
    </>
  );
}
