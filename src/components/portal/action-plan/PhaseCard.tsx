import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../api/router';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type Phase = RouterOutputs['actionPlan']['checklist']['phases'][number];
export type ChecklistItem = Phase['items'][number];

const PHASE_NUMBER: Record<string, string> = { d30: '30', d60: '60', d90: '90' };

/** Right-side evidence link → the alert / source / roadmap surface behind the item. */
function itemHref(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('founding') || t.includes('pricing') || t.includes('service areas'))
    return '/app/alerts';
  if (t.includes('director') || t.includes('journal') || t.includes('thought leadership'))
    return '/app/citations';
  if (t.includes('comparison') || t.includes('recommendation share')) return '/app/competitors';
  if (t.includes('scan') || t.includes('benchmark')) return '/app';
  return '/app/monitoring';
}

function CheckRow({
  item,
  index,
  updating,
  onToggle,
}: {
  item: ChecklistItem;
  index: number;
  updating: boolean;
  onToggle: (item: ChecklistItem) => void;
}) {
  const done = item.status === 'done';
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
      className="flex items-start gap-3 border-b border-ares-border2 py-3 last:border-b-0"
    >
      <button
        onClick={() => onToggle(item)}
        disabled={updating}
        aria-pressed={done}
        aria-label={done ? `Mark "${item.title}" as not done` : `Mark "${item.title}" as done`}
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-ares border transition-colors duration-200 disabled:opacity-50',
          done
            ? 'border-ares-primary bg-ares-primary'
            : 'border-ares-muted/50 bg-ares-card hover:border-ares-primary'
        )}
      >
        {done && (
          <svg viewBox="0 0 12 12" className="h-3 w-3">
            <motion.path
              d="M2 6.5 L5 9.2 L10 3"
              fill="none"
              stroke="#fff"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.25 }}
            />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[12px] font-light leading-[19.5px] text-ares-secondarytext transition-opacity duration-200',
            done && 'opacity-60'
          )}
        >
          {item.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {item.status === 'in_progress' && (
            <span className="badge-pill border-ares-primary/40 text-ares-primary">In progress</span>
          )}
          {item.title.toLowerCase().includes('follow-up visibility scan') && (
            <span className="badge-pill text-ares-muted">
              <Icon icon={icons.refresh} width={11} height={11} className="text-ares-primary" />
              Auto-runs Sep 12
            </span>
          )}
        </div>
      </div>
      <Link
        to={itemHref(item.title)}
        aria-label={`Open evidence for "${item.title}"`}
        className="mt-0.5 shrink-0 text-ares-muted transition-colors duration-200 hover:text-ares-primary"
      >
        <Icon icon={icons.linkLinear} width={14} height={14} />
      </Link>
    </motion.li>
  );
}

export default function PhaseCard({
  phase,
  index,
  updating,
  onToggle,
}: {
  phase: Phase;
  index: number;
  updating: boolean;
  onToggle: (item: ChecklistItem) => void;
}) {
  const complete = phase.total > 0 && phase.done === phase.total;
  const pct = phase.total > 0 ? Math.round((phase.done / phase.total) * 100) : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="action-card flex flex-col p-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-ares border font-display-num text-[28px] transition-colors duration-300',
            complete
              ? 'border-ares-primary bg-ares-primary !text-white'
              : 'border-ares-border bg-ares-surface'
          )}
        >
          {PHASE_NUMBER[phase.phase] ?? phase.phase}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-label text-ares-secondarytext">{phase.label}</p>
          <div className="mt-1.5">
            {complete ? (
              <span className="badge-pill border-ares-primary text-ares-primary">
                <Icon icon={icons.checkCircle} width={11} height={11} />
                Complete
              </span>
            ) : (
              <span className="badge-pill text-ares-muted">{phase.theme}</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="bar-track">
          <motion.div
            className="bar-fill"
            initial={{ width: `${pct}%` }}
            animate={{ width: `${pct}%`, scale: complete ? [1, 1.02, 1] : 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <p className="mt-1.5 text-[10px] font-light text-ares-muted">
          {phase.done} of {phase.total} complete
        </p>
      </div>

      <div className="section-rule mt-3" />

      {/* Checklist */}
      <ul className="flex-1">
        {phase.items.map((item, i) => (
          <CheckRow key={item.id} item={item} index={i} updating={updating} onToggle={onToggle} />
        ))}
      </ul>
    </motion.section>
  );
}
