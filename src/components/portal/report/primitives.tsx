import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Paper sheet (report.md §S2): centered max-w-[820px] white surface, paper
 * shadow, 56px padding, scroll-in reveal (translateY 32px + fade, 600ms).
 * `report-sheet` class is used by the print stylesheet.
 */
export function Sheet({
  id,
  dark,
  className,
  children,
}: {
  id: string;
  dark?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.6, ease: EASE }}
      className={cn(
        'report-sheet mx-auto w-full max-w-[820px] rounded-ares p-8 shadow-paper sm:p-14',
        dark ? 'bg-ares-tertiary' : 'bg-ares-surface',
        className
      )}
    >
      {children}
    </motion.section>
  );
}

/**
 * Section page header (sample-report pattern): "01" primary label + section
 * label muted on the left; optional MoM delta chip + page number on the right;
 * H2 display heading and a hairline scan-line rule below.
 */
export function SectionHeader({
  num,
  label,
  title,
  page,
  delta,
}: {
  num: string;
  label: string;
  title: string;
  page: string;
  delta?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-label text-ares-primary">{num}</span>
          <span className="font-label text-ares-muted">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {delta && (
            <span className="badge-pill normal-case tracking-normal text-ares-muted">{delta}</span>
          )}
          <span className="font-label text-ares-muted">{page}</span>
        </div>
      </div>
      <h2 className="font-display text-[32px] text-ares-text">{title}</h2>
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="section-rule origin-left"
      />
    </div>
  );
}

/** Animated bar row (design.md §5.3): label, track, primary value. */
export function BarRow({
  label,
  value,
  index,
  labelWidth = 'w-[130px]',
}: {
  label: string;
  value: number;
  index: number;
  labelWidth?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('shrink-0 text-[11px] font-light text-ares-secondarytext', labelWidth)}>
        {label}
      </span>
      <div className="bar-track flex-1">
        <motion.div
          className="bar-fill"
          initial={{ width: '0%' }}
          whileInView={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.9, delay: index * 0.08, ease: EASE }}
        />
      </div>
      <span className="w-8 text-right text-[11px] font-light text-ares-primary">{value}</span>
    </div>
  );
}

/** KPI number count-up (design.md §6 — 900ms ease-out on first view). */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}
