import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import MonthSelector, { formatMonthLabel } from '@/components/portal/report/MonthSelector';
import ProgressRail from '@/components/portal/report/ProgressRail';
import ReportStack from '@/components/portal/report/ReportStack';
import type { ReportPayload } from '@/components/portal/report/types';

/**
 * Print/PDF flow (report.md §S4): sheets become letter pages with a page
 * break per sheet; toolbar, rail, and portal chrome are hidden. Injected here
 * so the report page owns its print behavior end-to-end.
 */
const PRINT_CSS = `
@media print {
  body { background: #ffffff !important; }
  aside, header, .report-no-print { display: none !important; }
  main { padding: 0 !important; }
  main > div { max-width: none !important; }
  div[class*="lg:ml-"] { margin-left: 0 !important; }
  .report-sheet {
    box-shadow: none !important;
    border-radius: 0 !important;
    max-width: none !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0.6in !important;
    page-break-after: always;
    break-inside: avoid;
  }
  .report-sheet:last-child { page-break-after: auto; }
}
`;

/**
 * Monthly AI Visibility Report (report.md): the sample report's structure
 * regenerated from frozen per-month snapshots, rendered as clickable paper
 * sheets with archive access and a print/PDF flow.
 */
export default function Report() {
  const listQuery = trpc.report.list.useQuery();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const months = (listQuery.data ?? []).map((r) => r.month);
  const latestMonth = months[0];
  const effectiveMonth = selectedMonth ?? latestMonth;
  const isArchive = Boolean(
    selectedMonth && latestMonth && selectedMonth !== latestMonth
  );

  const reportQuery = trpc.report.byMonth.useQuery(
    effectiveMonth ? { month: effectiveMonth } : undefined,
    { enabled: !listQuery.isSuccess || months.length > 0 }
  );
  const payload = reportQuery.data?.payload as unknown as ReportPayload | undefined;

  const shareLink = async () => {
    const url = new URL(window.location.href);
    if (effectiveMonth) url.searchParams.set('month', effectiveMonth);
    url.searchParams.set('view', 'shared');
    try {
      await navigator.clipboard.writeText(url.toString());
      toast('View-only link copied to clipboard');
    } catch {
      toast('Copy failed — copy the address bar instead');
    }
  };

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <Toaster position="bottom-right" />
      <ProgressRail />

      {/* S1 — Report toolbar */}
      <div className="report-no-print sticky top-14 z-20 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-ares border border-ares-border bg-ares-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Icon icon={icons.documentText} width={16} height={16} className="text-ares-primary" />
          <span className="font-label text-[12px] normal-case tracking-[0.02em] text-ares-text">
            AI Visibility Report
          </span>
          {months.length > 0 && effectiveMonth && (
            <MonthSelector
              months={months}
              selected={effectiveMonth}
              onSelect={(m) => setSelectedMonth(m)}
            />
          )}
          {reportQuery.data?.reportId && (
            <span className="badge-pill text-ares-muted">{reportQuery.data.reportId}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={shareLink} className="btn-secondary !px-3 !py-2 text-[11px]">
            <Icon icon={icons.shareLinear} width={13} height={13} />
            Share link
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary !px-3 !py-2 text-[11px]"
          >
            <Icon icon={icons.downloadMinimalistic} width={13} height={13} />
            Download PDF
          </button>
        </div>
      </div>

      {/* S3 — archive banner */}
      {isArchive && effectiveMonth && latestMonth && (
        <div className="report-no-print mx-auto mb-6 flex max-w-[820px] items-start gap-2.5 rounded-ares border border-ares-border border-l-[3px] border-l-ares-muted bg-ares-card p-4">
          <Icon icon={icons.infoCircle} width={18} height={18} className="mt-0.5 shrink-0 text-ares-muted" />
          <p className="font-body text-[12px] leading-5 text-ares-secondarytext">
            Viewing the {formatMonthLabel(effectiveMonth, effectiveMonth === months[months.length - 1])}{' '}
            report — a snapshot. Current data lives in the dashboard.{' '}
            <button
              type="button"
              onClick={() => setSelectedMonth(null)}
              className="text-ares-link underline decoration-ares-border underline-offset-2 transition-colors duration-200 hover:text-ares-primary"
            >
              Back to {formatMonthLabel(latestMonth, false)}
            </button>
          </p>
        </div>
      )}

      {/* S2 — Sheet stack (cross-fades on month change) */}
      {reportQuery.isLoading || listQuery.isLoading ? (
        <div className="mx-auto flex max-w-[820px] items-center justify-center rounded-ares bg-ares-surface p-24 shadow-paper">
          <p className="text-[11px] font-light text-ares-muted">Assembling report…</p>
        </div>
      ) : reportQuery.isError || !payload ? (
        <div className="mx-auto flex max-w-[820px] flex-col items-center gap-4 rounded-ares bg-ares-surface p-24 text-center shadow-paper">
          <Icon icon={icons.documentText} width={28} height={28} className="text-ares-primary" />
          <p className="font-body text-ares-secondarytext">
            No report is available for this month yet.
          </p>
          {selectedMonth && (
            <button type="button" onClick={() => setSelectedMonth(null)} className="btn-secondary">
              Back to the latest report
            </button>
          )}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={reportQuery.data?.month ?? 'current'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ReportStack payload={payload} />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Bottom helper */}
      <p className="report-no-print mx-auto mt-6 max-w-[820px] text-center text-[10px] font-light text-ares-muted">
        Every table, cell, and score in this report deep-links into the live portal.{' '}
        <Link to="/app" className="text-ares-link underline decoration-ares-border underline-offset-2 hover:text-ares-primary">
          Open the dashboard
        </Link>
      </p>
    </div>
  );
}
