import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../../api/router';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

/** Inferred tRPC output types for dashboard/monitoring payloads. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Client-side label maps for ids returned as bare strings (e.g. alerts.enginesAffected). */
export const ENGINE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
  ai_overviews: 'Google AI Overviews',
  ai_search: 'AI Search',
};

export const SEVERITY_BAR: Record<string, string> = {
  high: '#3289AE',
  medium: '#83D6FA',
  low: '#344148',
};

export const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ---------- Formatters ---------- */

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Jul 14" */
export function fmtDate(d: Date | string | null | undefined): string {
  const date = toDate(d);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
}

/** "Jul 14, 2026" */
export function fmtDateLong(d: Date | string | null | undefined): string {
  const date = toDate(d);
  return date
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
}

/** "JULY 2026" */
export function fmtMonthYear(d: Date | string | null | undefined): string {
  const date = toDate(d);
  return date ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase() : '';
}

/* ---------- Motion primitives ---------- */

/** Signature "scan line" — 1px primary rule drawing left→right under page headers. */
export function ScanLine({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className={cn('h-px w-full origin-left bg-ares-primary', className)}
    />
  );
}

/** Portal page-intro row: eyebrow + display title + scan line, controls on the right. */
export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-label text-ares-primary">{eyebrow}</p>
          <h2 className="font-display mt-2 text-[24px]">{title}</h2>
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
      <ScanLine className="mt-4" />
    </div>
  );
}

/** Standard block reveal: fade + 24px rise, 600ms. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---------- States ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-ares bg-ares-secondary', className)} />;
}

export function ErrorCard({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-ares border border-ares-border bg-ares-card p-8 text-center',
        className
      )}
    >
      <Icon icon={icons.dangerTriangle} width={22} height={22} className="text-ares-primaryDark" />
      <p className="font-body text-ares-secondarytext">{message}</p>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/* ---------- Number ticker ---------- */

/** Count 0 → target with ease-out; respects prefers-reduced-motion. */
export function useCountUp(target: number, duration = 1000, delay = 0, enabled = true): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsed = t - start - delay;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, elapsed / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay, enabled]);
  return value;
}
