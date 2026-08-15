import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { EASE_OUT, ErrorCard, Reveal, Skeleton, fmtDate, type RouterOutputs } from '@/components/portal/dashboard/shared';
import type { CellSelection } from './ResponseDrawer';

type HeatmapData = RouterOutputs['monitoring']['heatmap'] | undefined;

/** Heatmap alpha ramp: rgba(203,77,34,α), α ∈ 0.08…0.9 (design.md §2). */
export function cellAlpha(intensity: number): string {
  const a = Math.min(0.9, Math.max(0.08, 0.08 + intensity * 0.82));
  return `rgba(203,77,34,${a.toFixed(2)})`;
}

const LEGEND_STEPS = [0, 0.25, 0.5, 0.75, 1];

/**
 * S2 — prompt × engine visibility heatmap. Columns are the engines selected in
 * the page header; cells open the response drawer on click.
 */
export const HeatmapCard = forwardRef<
  HTMLDivElement,
  {
    data: HeatmapData;
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    selectedEngines: string[];
    onCellClick: (sel: CellSelection) => void;
  }
>(function HeatmapCard({ data, isLoading, isError, onRetry, selectedEngines, onCellClick }, ref) {
  const engines = (data?.engines ?? []).filter((e) => selectedEngines.includes(e.id));
  const rows = data?.rows ?? [];

  return (
    <Reveal className="action-card p-6" >
      <div ref={ref} className="scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-label text-ares-primary">Visibility heatmap</p>
          {data && (
            <p className="text-[10px] font-light text-ares-muted">
              {rows.length} prompts × {engines.length} engines · {fmtDate(data.scanDate)} scan
            </p>
          )}
        </div>

        {isLoading && (
          <div className="mt-5 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        )}
        {isError && (
          <ErrorCard
            className="mt-5 border-0"
            message="Heatmap unavailable — no completed scan yet."
            onRetry={onRetry}
          />
        )}
        {data && rows.length === 0 && (
          <p className="mt-5 rounded-ares border border-ares-border bg-ares-card p-6 text-center font-body text-ares-muted">
            No prompts in this category for the selected scan.
          </p>
        )}
        {data && rows.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[720px]">
              {/* Header row */}
              <div
                className="grid items-end gap-1"
                style={{ gridTemplateColumns: `minmax(160px,260px) repeat(${engines.length}, minmax(70px,1fr))` }}
              >
                <span className="pb-1 text-[10px] font-normal uppercase tracking-[0.08em] text-ares-muted">
                  Prompt
                </span>
                {engines.map((e) => (
                  <span
                    key={e.id}
                    className="pb-1 text-center text-[10px] font-normal uppercase tracking-[0.08em] text-ares-muted"
                  >
                    {e.label}
                  </span>
                ))}
              </div>
              {/* Body */}
              <div className="space-y-1">
                {rows.map((row, ri) => (
                  <div
                    key={row.promptId}
                    className="grid items-center gap-1"
                    style={{ gridTemplateColumns: `minmax(160px,260px) repeat(${engines.length}, minmax(70px,1fr))` }}
                  >
                    <span
                      title={row.text}
                      className="truncate pr-2 text-[12px] font-light text-ares-text"
                    >
                      {row.text}
                    </span>
                    {row.cells
                      .filter((c) => selectedEngines.includes(c.engine))
                      .map((cell, ci) => (
                        <div key={cell.engine} className="group relative">
                          <motion.button
                            type="button"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              duration: 0.25,
                              delay: Math.min(0.3, (ri * engines.length + ci) * 0.025),
                              ease: EASE_OUT,
                            }}
                            onClick={() =>
                              onCellClick({
                                promptId: row.promptId,
                                promptText: row.text,
                                engine: cell.engine,
                                engineLabel: cell.engineLabel,
                              })
                            }
                            className="h-7 w-full rounded-ares transition-shadow duration-150 hover:shadow-[0_0_0_1px_#CB4D22]"
                            style={{ background: cellAlpha(cell.intensity) }}
                            aria-label={`${row.text} on ${cell.engineLabel}: ${Math.round(cell.intensity * 100)}%`}
                          />
                          {/* Hover tooltip */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-ares border border-ares-border bg-ares-card p-3 shadow-paper group-hover:block">
                            <p className="truncate text-[11px] font-normal text-ares-text">{row.text}</p>
                            <p className="mt-0.5 text-[10px] font-light text-ares-muted">
                              {cell.engineLabel} · Intensity {Math.round(cell.intensity * 100)}%
                            </p>
                            <p className="mt-0.5 text-[10px] font-light text-ares-muted">
                              Recommended: {cell.recommended ? 'Yes' : 'No'} · View response
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-light text-ares-muted">Low</span>
                {LEGEND_STEPS.map((s) => (
                  <span
                    key={s}
                    className="h-3.5 w-6 rounded-ares"
                    style={{ background: cellAlpha(s) }}
                  />
                ))}
                <span className="text-[10px] font-light text-ares-muted">High</span>
                <span className={cn('ml-2 text-[10px] font-light text-ares-muted')}>
                  Intensity = mention prominence, position, and recommendation status.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Reveal>
  );
});
