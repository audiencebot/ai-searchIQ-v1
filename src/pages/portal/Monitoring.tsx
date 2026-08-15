import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { ENGINE_LABELS, PageIntro, fmtDateLong } from '@/components/portal/dashboard/shared';
import { HeatmapCard } from '@/components/portal/monitoring/HeatmapCard';
import { CategoryBars } from '@/components/portal/monitoring/CategoryBars';
import { PromptSetManager } from '@/components/portal/monitoring/PromptSetManager';
import { ResponseDrawer, type CellSelection } from '@/components/portal/monitoring/ResponseDrawer';
import { InsightStrip } from '@/components/portal/monitoring/InsightStrip';

const ENGINE_IDS = Object.keys(ENGINE_LABELS);
const VALID_ENGINES = new Set(ENGINE_IDS);

const CATEGORY_OPTIONS = [
  { id: '', label: 'All categories' },
  { id: 'best_option', label: 'Best option' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'local', label: 'Local / "near me"' },
  { id: 'service_category', label: 'Service category' },
  { id: 'decision_stage', label: 'Decision-stage' },
] as const;

type CategoryId = (typeof CATEGORY_OPTIONS)[number]['id'];

const selectClass =
  'rounded-ares border border-ares-border bg-ares-card px-2.5 py-1.5 text-[10px] font-light uppercase tracking-[0.08em] text-ares-secondarytext focus:border-ares-primary focus:outline-none';

/**
 * Prompt Monitoring — /app/monitoring (monitoring.md). Prompt × engine
 * heatmap, category aggregates, prompt set manager, response drawer.
 */
export default function Monitoring() {
  const [searchParams] = useSearchParams();
  const initialEngine = searchParams.get('engine');

  const [selectedEngines, setSelectedEngines] = useState<string[]>(() =>
    initialEngine && VALID_ENGINES.has(initialEngine) ? [initialEngine] : ENGINE_IDS
  );
  const [category, setCategory] = useState<CategoryId>('');
  const [scanId, setScanId] = useState<number | undefined>(undefined);
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);

  const scanOptions = trpc.monitoring.scanOptions.useQuery();
  const heatmap = trpc.monitoring.heatmap.useQuery({
    ...(scanId ? { scanId } : {}),
    ...(category ? { category: category as Exclude<CategoryId, ''> } : {}),
  });
  const categoryRates = trpc.monitoring.categoryRates.useQuery(scanId ? { scanId } : undefined);
  const prompts = trpc.monitoring.prompts.useQuery();

  const toggleEngine = (id: string) =>
    setSelectedEngines((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((e) => e !== id);
        return next.length ? next : prev; // keep at least one engine visible
      }
      return ENGINE_IDS.filter((e) => [...prev, id].includes(e));
    });

  const onCategoryBarClick = (cat: string | null) => {
    setCategory((cat ?? '') as CategoryId);
    heatmapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeScanId = heatmap.data?.scanId ?? scanId;

  return (
    <div className="space-y-6">
      {/* S1 — page header */}
      <PageIntro eyebrow="Monitoring" title="Prompt × engine visibility.">
        {/* Engine multi-select chips */}
        <div className="flex flex-wrap gap-1.5">
          {ENGINE_IDS.map((id, i) => {
            const on = selectedEngines.includes(id);
            return (
              <motion.button
                key={id}
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                onClick={() => toggleEngine(id)}
                className={cn(
                  'badge-pill transition-colors duration-200',
                  on
                    ? 'border-ares-primary bg-ares-primary/[0.06] text-ares-primary'
                    : 'text-ares-muted hover:text-ares-secondarytext'
                )}
              >
                {ENGINE_LABELS[id]}
              </motion.button>
            );
          })}
        </div>
        {/* Category filter */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryId)}
          className={selectClass}
          aria-label="Filter by category"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {/* Scan snapshot picker */}
        <div className="relative">
          <Icon
            icon={icons.calendar}
            width={13}
            height={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ares-muted"
          />
          <select
            value={activeScanId ?? ''}
            onChange={(e) => setScanId(e.target.value ? Number(e.target.value) : undefined)}
            className={cn(selectClass, 'pl-7')}
            aria-label="Select scan snapshot"
          >
            {(scanOptions.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                Scan: {fmtDateLong(s.date)}
              </option>
            ))}
            {!scanOptions.data && <option value="">Scan: loading…</option>}
          </select>
        </div>
      </PageIntro>

      {/* S2 — heatmap */}
      <HeatmapCard
        ref={heatmapRef}
        data={heatmap.data}
        isLoading={heatmap.isLoading}
        isError={heatmap.isError}
        onRetry={() => heatmap.refetch()}
        selectedEngines={selectedEngines}
        onCellClick={setSelection}
      />

      {/* S3 + S4 — category bars & prompt set manager */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryBars
          data={categoryRates.data}
          isLoading={categoryRates.isLoading}
          isError={categoryRates.isError}
          onRetry={() => categoryRates.refetch()}
          activeCategory={category || null}
          onSelect={onCategoryBarClick}
        />
        <PromptSetManager
          data={prompts.data}
          isLoading={prompts.isLoading}
          isError={prompts.isError}
          onRetry={() => prompts.refetch()}
        />
      </div>

      {/* S5 — insight strip */}
      <InsightStrip />

      {/* Response drawer */}
      <ResponseDrawer
        selection={selection}
        scanId={activeScanId}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}
