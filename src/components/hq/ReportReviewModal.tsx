import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import Modal from '@/components/portal/alerts/Modal';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';

/**
 * Phase 1.5 report review gate: staff preview of a generated report before
 * it goes to the client. Shows exactly what the payload contains (score,
 * period, integrations, summary) with Approve & send / Hold actions.
 * Used from both HqClientDetail and HqReports.
 */
export default function ReportReviewModal({
  reportId,
  onClose,
  onChanged,
  onError,
}: {
  reportId: number | null;
  onClose: () => void;
  onChanged: () => void | Promise<unknown>;
  onError: (message: string) => void;
}) {
  const review = trpc.hq.reviewReport.useQuery(
    { reportId: reportId ?? 0 },
    { enabled: reportId !== null }
  );
  const approve = trpc.hq.approveReport.useMutation({
    onSuccess: async (r) => {
      await onChanged();
      onClose();
      onError(`Report approved & sent — ${r.emailed}/${r.emailAttempts} notifications sent.`);
    },
    onError: (err) => onError(err.message),
  });

  const report = review.data?.report;
  const payload = report?.payload;

  return (
    <Modal
      open={reportId !== null}
      onClose={onClose}
      title={report ? `Review report — ${review.data?.tenantName ?? ''}` : 'Review report'}
      footer={
        <>
          <button className="btn-secondary px-4 py-2 text-[12px]" onClick={onClose}>
            Hold
          </button>
          <button
            className="btn-primary px-4 py-2 text-[12px]"
            disabled={approve.isPending || report?.status !== 'in_review'}
            title={report?.status !== 'in_review' ? 'Only in_review reports can be approved' : undefined}
            onClick={() => report && approve.mutate({ reportId: report.id })}
          >
            <Icon icon={icons.checkCircle} width={14} height={14} />
            {approve.isPending ? 'Sending…' : 'Approve & send'}
          </button>
        </>
      }
    >
      {review.isLoading && <LoadingBlock rows={4} />}
      {review.error && <ErrorBlock message={review.error.message} onRetry={() => review.refetch()} />}
      {report && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="badge-pill text-ares-muted">{report.status}</span>
            <span className="text-[11px] font-light text-ares-muted">
              {report.type === 'initial_audit' ? 'Initial Audit' : 'Monthly'} · {report.periodLabel}
            </span>
          </div>

          <div className="rounded-ares border border-ares-border bg-ares-pageBg p-4">
            <p className="font-label text-ares-muted">Headline AI visibility score</p>
            <p className="font-display-num mt-1 text-[26px] text-ares-primaryDark">
              {payload?.headlineScore !== undefined ? `${payload.headlineScore}/100` : '—'}
            </p>
          </div>

          <dl className="space-y-2 text-[12px] font-light text-ares-secondarytext">
            <div className="flex justify-between gap-4">
              <dt className="text-ares-muted">Google integrations connected</dt>
              <dd>{payload?.integrationsConnected ?? 0}/3</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ares-muted">Generated</dt>
              <dd>{payload?.generatedAt ? new Date(payload.generatedAt).toLocaleString('en-US') : '—'}</dd>
            </div>
          </dl>

          {payload?.summary && (
            <p className="rounded-ares border border-ares-border/60 bg-ares-card px-3 py-2 text-[12px] font-light leading-relaxed text-ares-secondarytext">
              {payload.summary}
            </p>
          )}

          <p className="text-[10px] font-light text-ares-muted">
            Approving emails this report to every contact with report notifications on and flips the
            client to active. Holding keeps it in the review queue.
          </p>
        </div>
      )}
    </Modal>
  );
}
