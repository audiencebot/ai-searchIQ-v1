import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { EASE_OUT, ErrorCard, Reveal, Skeleton, type RouterOutputs } from '@/components/portal/dashboard/shared';

type CategoryRatesData = RouterOutputs['monitoring']['categoryRates'] | undefined;

/**
 * S3 — mention-rate-by-category bars. Click filters the heatmap to the
 * category; the active category row gets the tenant-highlight tint.
 */
export function CategoryBars({
  data,
  isLoading,
  isError,
  onRetry,
  activeCategory,
  onSelect,
}: {
  data: CategoryRatesData;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  activeCategory: string | null;
  onSelect: (category: string | null) => void;
}) {
  return (
    <Reveal delay={0.1} className="action-card p-6">
      <p className="font-label text-ares-primary">Mention rate by category</p>
      {isLoading && (
        <div className="mt-5 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-[170px]" />
              <Skeleton className="h-1.5 flex-1" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      )}
      {isError && (
        <ErrorCard className="mt-5 border-0 p-6" message="Category rates unavailable." onRetry={onRetry} />
      )}
      {data && (
        <div className="mt-4 space-y-1">
          {data.map((row, i) => {
            const active = activeCategory === row.category;
            return (
              <button
                key={row.category}
                type="button"
                title={`Prompts included: ${row.prompts.join(' · ')}`}
                onClick={() => onSelect(active ? null : row.category)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-ares px-2 py-2 text-left transition-colors duration-200',
                  active ? 'bg-ares-primary/[0.04]' : 'hover:bg-ares-primary/[0.02]'
                )}
              >
                <span className="w-[170px] shrink-0 truncate text-[11px] font-light text-ares-secondarytext">
                  {row.label}
                </span>
                <span className="bar-track flex-1">
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${row.rate}%` }}
                    transition={{ duration: 0.9, delay: i * 0.08, ease: EASE_OUT }}
                    className="bar-fill block"
                  />
                </span>
                <span className="w-9 shrink-0 text-right text-[11px] font-normal text-ares-primary">
                  {row.rate}%
                </span>
              </button>
            );
          })}
          <p className="px-2 pt-3 text-[10px] font-light text-ares-muted">
            Click a category to filter the heatmap above.
          </p>
        </div>
      )}
    </Reveal>
  );
}
