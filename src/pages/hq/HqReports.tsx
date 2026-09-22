import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/portal/alerts/PageHeader';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';
import { ToastHost, useToast } from '@/components/portal/alerts/Toast';
import ReportReviewModal from '@/components/hq/ReportReviewModal';

/** Report status badge styling (Phase 1.5 review gate adds in_review/sent). */
const REPORT_STATUS_STYLES: Record<string, string> = {
  in_review: 'border-ares-primary/50 bg-ares-primary/10 text-ares-primaryDark',
  approved: 'border-ares-primary/50 bg-ares-primary/10 text-ares-primaryDark',
  sent: 'text-ares-primaryDark',
  complete: 'text-ares-primaryDark',
  running: 'text-ares-muted',
  queued: 'text-ares-muted',
  failed: 'text-ares-ink',
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Global report queue/history + email delivery across all clients (plan §6 screen 4). */
export default function HqReports() {
  const utils = trpc.useUtils();
  const toast = useToast();
  const reports = trpc.hq.reportsList.useQuery();
  const emails = trpc.hq.emailLog.useQuery();
  const [reviewReportId, setReviewReportId] = useState<number | null>(null);

  const resendEmail = trpc.hq.resendEmail.useMutation({
    onSuccess: async (r) => {
      toast.show(r.ok ? 'Email re-sent.' : 'Re-send logged — email provider not configured.');
      await utils.hq.emailLog.invalidate();
    },
    onError: (err) => toast.show(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="HQ · Reports" title="Report queue & email delivery" />

      {reports.isLoading && <LoadingBlock rows={5} />}
      {reports.error && <ErrorBlock message={reports.error.message} onRetry={() => reports.refetch()} />}
      {reports.data && (
        <section className="overflow-x-auto rounded-ares border border-ares-border bg-ares-card">
          <div className="border-b border-ares-border px-5 py-4">
            <h3 className="font-display text-[15px]">Reports across all clients</h3>
          </div>
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-ares-border">
                {['Client', 'Type', 'Period', 'Status', 'Created', 'Completed', ''].map((h) => (
                  <th key={h} className="font-label px-4 py-3 text-ares-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.data.map(({ report, tenantName }) => (
                <tr key={report.id} className="border-b border-ares-border/50 last:border-0 hover:bg-ares-pageBg/60">
                  <td className="px-4 py-3">
                    <Link to={`/admin/clients/${report.tenantId}`} className="font-normal text-ares-text hover:text-ares-primary">
                      {tenantName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ares-secondarytext">
                    {report.type === 'initial_audit' ? 'Initial Audit' : 'Monthly'}
                  </td>
                  <td className="px-4 py-3 text-ares-secondarytext">{report.periodLabel}</td>
                  <td className="px-4 py-3">
                    <span className={cn('badge-pill', REPORT_STATUS_STYLES[report.status] ?? 'text-ares-muted')}>
                      {report.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ares-muted">{fmtDate(report.createdAt)}</td>
                  <td className="px-4 py-3 text-ares-muted">{fmtDate(report.completedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {report.status === 'in_review' && (
                      <button
                        className="btn-primary px-2.5 py-1 text-[10px]"
                        onClick={() => setReviewReportId(report.id)}
                      >
                        <Icon icon={icons.eye} width={11} height={11} />
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {reports.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ares-muted">
                    No reports yet — kick one off from a client page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {emails.isLoading && <LoadingBlock rows={5} />}
      {emails.error && <ErrorBlock message={emails.error.message} onRetry={() => emails.refetch()} />}
      {emails.data && (
        <section className="overflow-x-auto rounded-ares border border-ares-border bg-ares-card">
          <div className="border-b border-ares-border px-5 py-4">
            <h3 className="font-display text-[15px]">Email delivery</h3>
          </div>
          <table className="w-full min-w-[860px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-ares-border">
                {['Client', 'To', 'Subject', 'Status', 'Created', 'Sent', ''].map((h) => (
                  <th key={h} className="font-label px-4 py-3 text-ares-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emails.data.map(({ entry, tenantName }) => (
                <tr key={entry.id} className="border-b border-ares-border/50 last:border-0 hover:bg-ares-pageBg/60">
                  <td className="px-4 py-3">
                    <Link to={`/admin/clients/${entry.tenantId}`} className="font-normal text-ares-text hover:text-ares-primary">
                      {tenantName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ares-secondarytext">{entry.toEmail}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-ares-secondarytext" title={entry.subject}>
                    {entry.subject}
                    {entry.error && <span className="block truncate text-[10px] text-ares-primaryDark">{entry.error}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'badge-pill',
                        entry.status === 'sent'
                          ? 'text-ares-primaryDark'
                          : entry.status === 'failed'
                            ? 'text-ares-ink'
                            : 'text-ares-muted'
                      )}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ares-muted">{fmtDate(entry.createdAt)}</td>
                  <td className="px-4 py-3 text-ares-muted">{fmtDate(entry.sentAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {entry.status !== 'sent' && (
                      <button
                        className="btn-secondary px-2.5 py-1 text-[10px]"
                        disabled={resendEmail.isPending}
                        onClick={() => resendEmail.mutate({ emailLogId: entry.id })}
                      >
                        <Icon icon={icons.refresh} width={11} height={11} />
                        Resend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {emails.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ares-muted">
                    No emails logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      <ReportReviewModal
        reportId={reviewReportId}
        onClose={() => setReviewReportId(null)}
        onChanged={async () => {
          await utils.hq.reportsList.invalidate();
          await utils.hq.notifications.invalidate();
        }}
        onError={(m) => toast.show(m)}
      />

      <ToastHost message={toast.message} />
    </div>
  );
}
