import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'framer-motion';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../api/router';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RoadmapItem = RouterOutputs['actionPlan']['roadmap'][number];
export type RoadmapStatus = 'suggested' | 'accepted' | 'in_progress' | 'done';

const STATUS_LABEL: Record<RoadmapStatus, string> = {
  suggested: 'Suggested',
  accepted: 'Accepted',
  in_progress: 'In progress',
  done: 'Done',
};

const EFFORT_LABEL: Record<string, string> = { low: 'Low', medium: 'Med', high: 'High' };

/** Route the "Triggered by" evidence link back to the finding that generated it. */
function evidenceHref(triggeredBy: string | null): string {
  const t = (triggeredBy ?? '').toLowerCase();
  if (t.includes('alert')) return '/app/alerts';
  if (t.includes('citation') || t.includes('journal') || t.includes('director'))
    return '/app/citations';
  if (t.includes('atlas') || t.includes('comparison') || t.includes('competitor'))
    return '/app/competitors';
  return '/app/monitoring';
}

export default function RoadmapCard({
  item,
  index,
  updating,
  onStatus,
}: {
  item: RoadmapItem;
  index: number;
  updating: boolean;
  onStatus: (id: number, status: RoadmapStatus) => void;
}) {
  const done = item.status === 'done';
  const [flash, setFlash] = useState(false);
  const prevStatus = useRef(item.status);

  // Status change → 400ms primary border flash (action-plan.md §S2)
  useEffect(() => {
    if (prevStatus.current !== item.status) {
      prevStatus.current = item.status;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 450);
      return () => clearTimeout(t);
    }
  }, [item.status]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="action-card relative flex flex-col p-5"
    >
      <AnimatePresence>
        {flash && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-ares border border-ares-primary"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* Top row */}
      <div className="flex items-center justify-between gap-3">
        <p className="font-label text-ares-primary">
          Priority {String(item.priority ?? 0).padStart(2, '0')}
        </p>
        {item.impact && (
          <span
            className={cn(
              'badge-pill',
              item.impact === 'high'
                ? 'border-ares-primary text-ares-primary'
                : 'text-ares-muted'
            )}
          >
            {item.impact} impact
          </span>
        )}
      </div>

      {/* Title + body */}
      <div className="mt-3 flex items-start gap-2">
        <h3 className="font-display text-[16px] leading-snug">{item.title}</h3>
        {done && (
          <Icon
            icon={icons.checkCircle}
            width={16}
            height={16}
            className="mt-0.5 shrink-0 text-ares-primary"
          />
        )}
      </div>
      {item.description && (
        <p
          className={cn(
            'mt-2 text-[11px] font-light leading-[17px] text-ares-secondarytext transition-opacity duration-300',
            done && 'opacity-70'
          )}
        >
          {item.description}
        </p>
      )}

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.effort && (
          <span className="badge-pill text-ares-muted">Effort: {EFFORT_LABEL[item.effort]}</span>
        )}
        {item.targetComponent && (
          <span className="badge-pill text-ares-muted">Moves: {item.targetComponent}</span>
        )}
      </div>

      {/* Evidence link + status control */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ares-border2 pt-3">
        {item.triggeredBy && (
          <Link
            to={evidenceHref(item.triggeredBy)}
            className="inline-flex items-center gap-1.5 text-[10px] font-light text-ares-link transition-colors duration-200 hover:text-ares-primary"
          >
            <Icon icon={icons.linkLinear} width={12} height={12} />
            Triggered by: {item.triggeredBy}
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] font-light uppercase tracking-[0.08em] text-ares-muted">
            Status
          </span>
          <select
            value={item.status}
            disabled={updating}
            onChange={(e) => onStatus(item.id, e.target.value as RoadmapStatus)}
            className={cn(
              'rounded-ares border bg-ares-card px-2 py-1 text-[10px] font-light uppercase tracking-[0.08em] focus:border-ares-primary focus:outline-none disabled:opacity-50',
              done ? 'border-ares-primary text-ares-primary' : 'border-ares-border text-ares-secondarytext'
            )}
            aria-label={`Status for priority ${item.priority}`}
          >
            {(Object.keys(STATUS_LABEL) as RoadmapStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </motion.article>
  );
}
