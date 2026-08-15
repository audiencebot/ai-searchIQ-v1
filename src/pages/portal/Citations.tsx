import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import SourceTable from '@/components/portal/citations/SourceTable';
import SourceDrawer from '@/components/portal/citations/SourceDrawer';

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

/** KPI count-up (900ms ease-out; respects reduced motion). */
function CountUp({ value, suffix }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}

function Toast({ message }: { message: string | null }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: message ? 1 : 0, y: message ? 0 : 8 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none fixed bottom-6 right-20 z-[60]"
    >
      {message && (
        <div className="flex items-center gap-2.5 rounded-ares border border-ares-border bg-ares-surface px-4 py-3 shadow-paper">
          <Icon icon={icons.checkCircle} width={16} height={16} className="text-ares-primary" />
          <span className="text-[12px] text-ares-secondarytext">{message}</span>
        </div>
      )}
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-72 animate-pulse rounded-ares bg-ares-secondary/60" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-ares border border-ares-border bg-ares-card"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-ares border border-ares-border bg-ares-card" />
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-ares border border-ares-border bg-ares-card p-6">
      <div className="flex items-center gap-2.5">
        <Icon
          icon={icons.dangerTriangle}
          width={18}
          height={18}
          className="text-ares-primaryDark"
        />
        <p className="font-body text-ares-secondarytext">
          Citations &amp; sources couldn't be loaded.
        </p>
      </div>
      <button type="button" onClick={onRetry} className="btn-secondary !px-4 !py-2">
        <Icon icon={icons.refresh} width={14} height={14} />
        Retry
      </button>
    </div>
  );
}

/**
 * Portal — Citations & Sources (`/app/citations`).
 * Design: citations.md — summary strip, 22-source gap table with detail
 * drawer, citation strength by type, pickup feed, insight strip.
 */
export default function Citations() {
  const summaryQuery = trpc.citations.summary.useQuery();
  const sourcesQuery = trpc.citations.sources.useQuery();
  const strengthQuery = trpc.citations.strengthByType.useQuery();
  const feedQuery = trpc.citations.pickupFeed.useQuery({ limit: 6 });

  const summary = summaryQuery.data;
  const sources = sourcesQuery.data ?? [];

  const [openSourceId, setOpenSourceId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  if (summaryQuery.isLoading || sourcesQuery.isLoading) return <LoadingState />;
  if (summaryQuery.isError || sourcesQuery.isError || !summary) {
    return <ErrorState onRetry={() => void Promise.all([summaryQuery.refetch(), sourcesQuery.refetch()])} />;
  }

  return (
    <div className="space-y-6">
      {/* S1 — Page header */}
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-label mb-2 text-ares-primary">Citations &amp; sources</p>
            <h1 className="font-display text-[24px]">Where AI learns about you.</h1>
            <motion.div
              className="mt-3 h-px w-full max-w-md origin-left bg-ares-primary"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.3 }}
            className="badge-pill text-ares-secondarytext"
          >
            {summary.sourcesPresent} of {summary.sourcesTotal} sources present ·{' '}
            {summary.highAuthorityGaps} high-impact gaps
          </motion.span>
        </div>
      </motion.header>

      {/* S2 — Summary strip */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0, ease: [0.22, 1, 0.36, 1] }}
          className="kpi-tile"
        >
          <p className="font-label text-ares-muted">Citation strength</p>
          <p className="font-display-num mt-2 text-[28px]">{summary.citationStrength.label}</p>
          <div className="bar-track mt-3">
            <motion.div
              className="h-full rounded-ares bg-ares-primary"
              initial={{ width: 0 }}
              animate={{ width: `${summary.citationStrength.subScore}%` }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className="mt-2 text-[10px] text-ares-muted">
            Sub-score {summary.citationStrength.subScore}/100
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
          className="kpi-tile"
        >
          <p className="font-label text-ares-muted">Sources present</p>
          <p className="font-display-num mt-2 text-[28px]">
            <CountUp value={summary.sourcesPresent} />
            <span className="text-ares-muted"> / {summary.sourcesTotal}</span>
          </p>
          <p className="mt-2 text-[10px] text-ares-muted">
            +{summary.presentDelta} vs. last scan
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className="kpi-tile"
        >
          <p className="font-label text-ares-muted">High-authority gaps</p>
          <p className="font-display-num mt-2 text-[28px]">
            <CountUp value={summary.highAuthorityGaps} />
          </p>
          <p className="mt-2 text-[10px] text-ares-muted">
            Each suppresses recommendation likelihood
          </p>
        </motion.div>
      </div>

      {/* S3 — Source gap table */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <SourceTable sources={sources} onOpenSource={setOpenSourceId} onToast={showToast} />
      </motion.div>

      {/* S4 + S5 — strength by type + pickup feed */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-ares border border-ares-border bg-ares-card p-4 md:p-6"
        >
          <p className="font-label mb-5 text-ares-primary">Citation strength by source type</p>
          {strengthQuery.isLoading && (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded-ares bg-ares-secondary/60" />
              ))}
            </div>
          )}
          {strengthQuery.data && (
            <>
              <div className="space-y-4">
                {strengthQuery.data.rows.map((r, i) => (
                  <div key={r.type} className="flex items-center gap-3">
                    <span className="w-24 text-[11px] text-ares-secondarytext">{r.label}</span>
                    <div className="bar-track flex-1">
                      <motion.div
                        className="h-full rounded-ares bg-ares-primary"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${r.score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <span className="w-6 text-right text-[11px] font-normal text-ares-primary">
                      {r.score}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-[10px] text-ares-muted">{strengthQuery.data.footnote}</p>
            </>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-ares border border-ares-border bg-ares-card p-4 md:p-6"
        >
          <p className="font-label mb-4 text-ares-primary">Recent citation activity</p>
          {feedQuery.isLoading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-ares bg-ares-secondary/60" />
              ))}
            </div>
          )}
          {feedQuery.data && (
            <ul className="divide-y divide-ares-border">
              {feedQuery.data.map((row, i) => {
                const inner = (
                  <>
                    <Icon
                      icon={row.isWarning ? icons.dangerTriangle : icons.linkLinear}
                      width={15}
                      height={15}
                      className={
                        row.isWarning
                          ? 'mt-0.5 shrink-0 text-ares-primaryDark'
                          : 'mt-0.5 shrink-0 text-ares-primary'
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] leading-relaxed text-ares-secondarytext">
                        {row.text}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ares-muted">
                        {fmtDate(row.date)} · {row.engineLabel}
                      </p>
                    </div>
                  </>
                );
                return (
                  <motion.li
                    key={row.id}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.06 }}
                    className="py-2.5 first:pt-0 last:pb-0"
                  >
                    {row.isWarning ? (
                      <Link to="/app/alerts" className="flex items-start gap-2.5">
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-2.5">{inner}</div>
                    )}
                  </motion.li>
                );
              })}
              {feedQuery.data.length === 0 && (
                <li className="py-3 text-[11px] text-ares-muted">No citation activity yet.</li>
              )}
            </ul>
          )}
        </motion.section>
      </div>

      {/* S6 — Insight strip */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-ares bg-ares-tertiary p-6 md:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-[13px] font-light leading-[22px] text-on-dark">
            AI engines rely on cited sources to build answers. Closing the three high-authority
            gaps is the fastest path to moving Citation Strength from Medium to High — it's
            Priority 05 on your roadmap.
          </p>
          <Link to="/app/action-plan" className="btn-secondary-dark">
            Open roadmap
            <Icon icon={icons.arrowRight} width={14} height={14} />
          </Link>
        </div>
      </motion.section>

      {/* Source detail drawer */}
      <SourceDrawer
        sourceId={openSourceId}
        onClose={() => setOpenSourceId(null)}
        onToast={showToast}
      />

      <Toast message={toast} />
    </div>
  );
}
