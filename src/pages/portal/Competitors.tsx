import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import Leaderboard from '@/components/portal/competitors/Leaderboard';
import GapDiagnostics from '@/components/portal/competitors/GapDiagnostics';
import SeoResearch from '@/components/portal/competitors/SeoResearch';
import ManageCompetitorsModal from '@/components/portal/competitors/ManageCompetitorsModal';

/** Small inline toast (brand style) — bottom-right, auto-dismisses. */
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
      <div className="h-64 animate-pulse rounded-ares border border-ares-border bg-ares-card" />
      <div className="h-56 animate-pulse rounded-ares border border-ares-border bg-ares-card" />
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
          Competitive intelligence couldn't be loaded.
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
 * Portal — Competitive Intelligence (`/app/competitors`).
 * Design: competitors.md — leaderboard, per-competitor gap diagnostics,
 * DataForSEO research views, manage-competitors modal.
 */
export default function Competitors() {
  const leaderboardQuery = trpc.competitors.leaderboard.useQuery();
  const rows = leaderboardQuery.data ?? [];
  const competitors = rows.filter((r) => !r.isPrimary);

  const [gapBrandId, setGapBrandId] = useState<number>(0);
  const [researchBrandId, setResearchBrandId] = useState<number>(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapRef = useRef<HTMLDivElement>(null);
  const researchRef = useRef<HTMLDivElement>(null);

  // Default both tab groups to the first competitor once data lands.
  useEffect(() => {
    if (competitors.length > 0) {
      setGapBrandId((v) => (v === 0 ? competitors[0].brandId : v));
      setResearchBrandId((v) => (v === 0 ? competitors[0].brandId : v));
    }
  }, [competitors]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  const jumpToGap = (brandId: number) => {
    setGapBrandId(brandId);
    gapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const jumpToResearch = (brandId: number) => {
    setResearchBrandId(brandId);
    researchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (leaderboardQuery.isLoading) return <LoadingState />;
  if (leaderboardQuery.isError) return <ErrorState onRetry={() => leaderboardQuery.refetch()} />;

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
            <p className="font-label mb-2 text-ares-primary">Competitive intelligence</p>
            <h1 className="font-display text-[24px]">Who AI recommends instead of you.</h1>
            <motion.div
              className="mt-3 h-px w-full max-w-md origin-left bg-ares-primary"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <button type="button" className="btn-secondary !px-4 !py-2" onClick={() => setManageOpen(true)}>
            <Icon icon={icons.settings} width={14} height={14} />
            Manage competitors
          </button>
        </div>
      </motion.header>

      {/* S2 — Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <Leaderboard
          rows={rows}
          scanLabel="Jul 14 scan"
          onGapAnalysis={jumpToGap}
          onResearch={jumpToResearch}
        />
      </motion.div>

      {/* S3 — Gap diagnostics */}
      <motion.div
        ref={gapRef}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="scroll-mt-20"
      >
        {competitors.length > 0 && gapBrandId !== 0 && (
          <GapDiagnostics competitors={competitors} value={gapBrandId} onValueChange={setGapBrandId} />
        )}
      </motion.div>

      {/* S4 — DataForSEO research views */}
      <motion.div
        ref={researchRef}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="scroll-mt-20"
      >
        {competitors.length > 0 && researchBrandId !== 0 && (
          <SeoResearch
            competitors={competitors}
            value={researchBrandId}
            onValueChange={setResearchBrandId}
            onToast={showToast}
          />
        )}
      </motion.div>

      {/* S5 — Manage competitors modal */}
      <ManageCompetitorsModal
        open={manageOpen}
        competitors={competitors.map((c) => ({ name: c.name }))}
        onClose={() => setManageOpen(false)}
        onToast={showToast}
      />

      <Toast message={toast} />
    </div>
  );
}
