import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { EASE_OUT, ErrorCard, Skeleton, fmtDate } from '@/components/portal/dashboard/shared';

export type CellSelection = {
  promptId: number;
  promptText: string;
  engine: 'chatgpt' | 'gemini' | 'claude' | 'perplexity' | 'ai_overviews' | 'ai_search';
  engineLabel: string;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Render the captured answer with tenant mentions highlighted and competitor mentions muted. */
function HighlightedResponse({
  text,
  brandName,
  competitorNames,
}: {
  text: string;
  brandName: string;
  competitorNames: string[];
}) {
  const names = [brandName, ...competitorNames].filter(Boolean);
  if (names.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${names.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        const lower = part.toLowerCase();
        if (brandName && lower === brandName.toLowerCase()) {
          return (
            <span
              key={i}
              className="bg-ares-primary/[0.12] underline decoration-ares-primary/40 underline-offset-2"
            >
              {part}
            </span>
          );
        }
        if (competitorNames.some((c) => lower === c.toLowerCase())) {
          return (
            <span key={i} className="text-ares-muted">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function MetaChip({ children }: { children: ReactNode }) {
  return <span className="badge-pill text-ares-secondarytext">{children}</span>;
}

/**
 * Response drawer (monitoring.md §S2): 520px right drawer turning one heatmap
 * cell into evidence — meta chips, quoted response block, cited URLs, actions.
 */
export function ResponseDrawer({
  selection,
  scanId,
  onClose,
}: {
  selection: CellSelection | null;
  scanId?: number;
  onClose: () => void;
}) {
  const open = selection !== null;
  const [flagged, setFlagged] = useState(false);
  const response = trpc.monitoring.response.useQuery(
    selection
      ? { promptId: selection.promptId, engine: selection.engine, ...(scanId ? { scanId } : {}) }
      : { promptId: 0, engine: 'chatgpt' },
    { enabled: open }
  );
  const bootstrap = trpc.bootstrap.status.useQuery(undefined, { enabled: open });
  const leaderboard = trpc.competitors.leaderboard.useQuery(undefined, { enabled: open });

  const brandName = bootstrap.data?.tenant?.name ?? 'Northwind Advisory';
  const competitorNames = (leaderboard.data ?? []).filter((b) => !b.isPrimary).map((b) => b.name);

  const close = () => {
    setFlagged(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && selection && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-ares-tertiary/30"
            onClick={close}
          />
          <motion.aside
            initial={{ x: 520 }}
            animate={{ x: 0 }}
            exit={{ x: 520 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-ares-border bg-ares-surface"
          >
            <div className="flex h-14 items-center justify-between gap-3 border-b border-ares-border px-5">
              <p className="truncate text-[12px] font-normal text-ares-text">
                {selection.promptText} · {selection.engineLabel}
                {response.data?.scanDate ? ` · ${fmtDate(response.data.scanDate)}` : ''}
              </p>
              <button
                onClick={close}
                aria-label="Close response drawer"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ares text-ares-muted transition-colors duration-200 hover:text-ares-primary"
              >
                <Icon icon={icons.closeCircle} width={18} height={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {response.isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              )}
              {response.isError && (
                <ErrorCard
                  message="Could not load the captured response for this cell."
                  onRetry={() => response.refetch()}
                />
              )}
              {response.data && (
                <div className="space-y-5">
                  {/* Meta chips */}
                  <div className="flex flex-wrap gap-1.5">
                    <MetaChip>
                      {response.data.mentioned ? (
                        <>
                          <Icon icon={icons.checkCircle} width={12} height={12} className="text-ares-primary" />
                          Mentioned{response.data.position ? ` at position ${response.data.position}` : ''}
                        </>
                      ) : (
                        'Not mentioned'
                      )}
                    </MetaChip>
                    <MetaChip>
                      {response.data.recommended ? (
                        <>
                          <Icon icon={icons.checkCircle} width={12} height={12} className="text-ares-primary" />
                          Recommended
                        </>
                      ) : (
                        'Not recommended'
                      )}
                    </MetaChip>
                    <MetaChip>{response.data.citations.length} citations</MetaChip>
                    <MetaChip>Intensity {Math.round(response.data.intensity * 100)}%</MetaChip>
                  </div>

                  {/* Quoted response block */}
                  {response.data.responseText ? (
                    <blockquote className="rounded-ares border border-ares-border bg-ares-card p-4 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
                      <HighlightedResponse
                        text={response.data.responseText}
                        brandName={brandName}
                        competitorNames={competitorNames}
                      />
                    </blockquote>
                  ) : (
                    <div className="rounded-ares border border-ares-border bg-ares-card p-4 text-[12px] font-light text-ares-muted">
                      No response excerpt captured for this cell — the brand was absent from this
                      engine's answer.
                    </div>
                  )}

                  {/* Cited URLs */}
                  {response.data.citations.length > 0 && (
                    <div>
                      <p className="font-label mb-2 text-ares-muted">Cited sources</p>
                      <ul className="space-y-1.5">
                        {response.data.citations.map((c) => (
                          <li key={c.id} className="flex items-start gap-2 text-[11px] font-light">
                            <Icon
                              icon={icons.linkLinear}
                              width={13}
                              height={13}
                              className="mt-0.5 shrink-0 text-ares-primary"
                            />
                            <span className="min-w-0">
                              <span className="text-ares-secondarytext">{c.sourceName}</span>
                              <span className="block truncate text-ares-link">{c.citedUrl}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {flagged && (
                    <p className="rounded-ares border border-ares-border bg-ares-card p-3 text-[11px] font-light text-ares-secondarytext">
                      Alert draft created —{' '}
                      <Link to="/app/alerts" className="text-ares-primary hover:underline" onClick={close}>
                        review it in Alerts
                      </Link>
                      .
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-ares-border p-5">
              <button className="btn-secondary" onClick={() => setFlagged(true)} disabled={flagged}>
                <Icon icon={icons.dangerTriangle} width={13} height={13} />
                Flag inaccuracy
              </button>
              <Link to="/app/report" className="btn-secondary" onClick={close}>
                Open full scan
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
