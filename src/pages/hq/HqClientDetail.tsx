import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/portal/alerts/PageHeader';
import Modal from '@/components/portal/alerts/Modal';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';
import { ToastHost, useToast } from '@/components/portal/alerts/Toast';
import { PLAN_LABELS, type PlanTier } from '@contracts/constants';

const GOOGLE_SERVICES = [
  { key: 'gsc', name: 'Search Console' },
  { key: 'ga4', name: 'Google Analytics 4' },
  { key: 'gbp', name: 'Business Profile' },
] as const;

/** The 5 onboarding steps shown as a timeline (plan §4). */
const CHECKLIST_STEPS = [
  { key: 'invited', label: 'Invite sent', at: 'inviteSentAt' },
  { key: 'google_connected', label: 'Google connected', at: 'googleConnectedAt' },
  { key: 'first_scan_done', label: 'First scan done', at: 'firstScanAt' },
  { key: 'report_sent', label: 'Report sent', at: 'reportSentAt' },
  { key: 'active', label: 'Active', at: null },
] as const;

const STEP_ORDER = ['new', 'invited', 'google_connected', 'first_scan_done', 'report_sent', 'active'];

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-ares border border-ares-border bg-ares-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-[15px]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HqClientDetail() {
  const { tenantId: rawId } = useParams();
  const tenantId = Number(rawId);
  const utils = trpc.useUtils();
  const toast = useToast();
  const detail = trpc.hq.clientDetail.useQuery(
    { tenantId },
    { enabled: Number.isFinite(tenantId) }
  );

  const [addOpen, setAddOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const invalidate = () => utils.hq.clientDetail.invalidate({ tenantId });
  const onError = (err: { message: string }) => toast.show(err.message);

  const sendInvite = trpc.hq.sendInvite.useMutation({
    onSuccess: async (r) => {
      toast.show(r.ok ? `Invite emailed to ${r.sent}/${r.total} contacts.` : 'Invite logged — email provider not configured; share the link manually.');
      await invalidate();
    },
    onError,
  });
  const addContact = trpc.hq.addContact.useMutation({
    onSuccess: async () => {
      toast.show('Contact added.');
      setAddOpen(false);
      setContactName('');
      setContactEmail('');
      await invalidate();
    },
    onError,
  });
  const removeContact = trpc.hq.removeContact.useMutation({
    onSuccess: async () => {
      toast.show('Contact removed.');
      await invalidate();
    },
    onError,
  });
  const setPlan = trpc.hq.setPlan.useMutation({
    onSuccess: async () => {
      toast.show('Plan updated.');
      await invalidate();
      await utils.hq.clients.invalidate();
    },
    onError,
  });
  const setAuditPaid = trpc.hq.setAuditPaid.useMutation({
    onSuccess: async () => {
      await invalidate();
    },
    onError,
  });
  const triggerReport = trpc.hq.triggerReport.useMutation({
    onSuccess: async (r) => {
      toast.show(`Report complete — ${r.emailed}/${r.emailAttempts} notifications sent.`);
      await invalidate();
    },
    onError,
  });
  const resendEmail = trpc.hq.resendEmail.useMutation({
    onSuccess: async (r) => {
      toast.show(r.ok ? 'Email re-sent.' : 'Re-send logged — email provider not configured.');
      await invalidate();
    },
    onError,
  });

  if (!Number.isFinite(tenantId)) return <ErrorBlock message="Invalid client id." />;
  if (detail.isLoading) return <LoadingBlock rows={8} />;
  if (detail.error || !detail.data) {
    return <ErrorBlock message={detail.error?.message} onRetry={() => detail.refetch()} />;
  }

  const { tenant, contacts, checklist, invitePath, integrations, reports, emailLog } = detail.data;
  const googleRows = GOOGLE_SERVICES.map((svc) => {
    const row = integrations.find((i) => i.provider === svc.key);
    return { ...svc, connected: row?.status === 'connected', accountLabel: row?.accountLabel ?? null };
  });
  const googleCount = googleRows.filter((g) => g.connected).length;
  const stepIndex = STEP_ORDER.indexOf(checklist?.status ?? 'new');
  const inviteUrl = invitePath ? `${window.location.origin}${invitePath}` : null;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="HQ · Clients" title={tenant.name}>
        <Link to="/admin/clients" className="btn-secondary px-3 py-2 text-[11px]">
          <Icon icon={icons.altArrowLeft} width={13} height={13} />
          All clients
        </Link>
        <Link to="/app" className="btn-secondary px-3 py-2 text-[11px]" title="Staff view of the client portal (read-only)">
          <Icon icon={icons.eye} width={13} height={13} />
          View portal as client
        </Link>
      </PageHeader>

      <p className="-mt-3 text-[11px] font-light text-ares-muted">
        {tenant.industry} · {tenant.websiteUrl} · portal view is read-only for staff
      </p>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Contacts */}
        <Card
          title="Contacts"
          action={
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary px-3 py-1.5 text-[10px]"
                disabled={sendInvite.isPending}
                onClick={() => sendInvite.mutate({ tenantId })}
              >
                <Icon icon={icons.letter} width={12} height={12} />
                Resend invite
              </button>
              <button className="btn-secondary px-3 py-1.5 text-[10px]" onClick={() => setAddOpen(true)}>
                <Icon icon={icons.userPlusRounded} width={12} height={12} />
                Add
              </button>
            </div>
          }
        >
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-ares border border-ares-border/60 px-3 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ares-tertiary text-[9px] text-white">
                  {c.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-normal text-ares-text">{c.name}</p>
                  <p className="truncate text-[10px] font-light text-ares-muted">{c.email}</p>
                </div>
                <span className={cn('badge-pill', c.role === 'primary' ? 'text-ares-primaryDark' : 'text-ares-muted')}>
                  {c.role}
                </span>
                {c.notifyReports && (
                  <span title="Receives report emails">
                    <Icon icon={icons.bell} width={13} height={13} className="text-ares-primary" />
                  </span>
                )}
                <button
                  className="text-ares-muted hover:text-ares-primary"
                  aria-label={`Remove ${c.name}`}
                  disabled={removeContact.isPending}
                  onClick={() => removeContact.mutate({ contactId: c.id })}
                >
                  <Icon icon={icons.trashBinMinimalistic} width={14} height={14} />
                </button>
              </li>
            ))}
          </ul>
          {inviteUrl && (
            <div className="mt-3 flex items-center gap-2 rounded-ares border border-ares-border bg-ares-pageBg px-3 py-2">
              <span className="flex-1 truncate text-[10px] font-light text-ares-ink">{inviteUrl}</span>
              <button
                className="shrink-0 text-ares-primary"
                aria-label="Copy invite link"
                onClick={() => navigator.clipboard.writeText(inviteUrl).then(() => toast.show('Invite link copied.'))}
              >
                <Icon icon={icons.copyLinear} width={13} height={13} />
              </button>
            </div>
          )}
        </Card>

        {/* Plan & billing */}
        <Card title="Plan & billing">
          <div className="flex flex-wrap items-center gap-2">
            {(['report', 'growth', 'enterprise'] as PlanTier[]).map((p) => (
              <button
                key={p}
                disabled={setPlan.isPending}
                onClick={() => setPlan.mutate({ tenantId, plan: p })}
                className={cn(
                  'rounded-ares border px-3 py-1.5 text-[11px] font-light transition-colors',
                  tenant.plan === p
                    ? 'border-ares-primary bg-ares-primary/[0.08] text-ares-primaryDark'
                    : 'border-ares-border text-ares-muted hover:border-ares-primary/50'
                )}
              >
                {PLAN_LABELS[p]}
              </button>
            ))}
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[12px] font-light text-ares-secondarytext">
            <input
              type="checkbox"
              className="h-4 w-4 accent-ares-primary"
              checked={tenant.auditPaid}
              disabled={setAuditPaid.isPending}
              onChange={(e) => setAuditPaid.mutate({ tenantId, paid: e.target.checked })}
            />
            $399 initial audit collected (manual — Stripe later)
          </label>
          <p className="mt-3 text-[10px] font-light text-ares-muted">
            Tenant status: {tenant.status}
          </p>
        </Card>

        {/* Integrations */}
        <Card title={`Google integrations · ${googleCount}/3 connected`}>
          <ul className="space-y-2">
            {googleRows.map((g) => (
              <li key={g.key} className="flex items-center gap-3 rounded-ares border border-ares-border/60 px-3 py-2">
                <Icon
                  icon={g.connected ? icons.checkCircle : icons.closeCircle}
                  width={16}
                  height={16}
                  className={g.connected ? 'text-ares-primary' : 'text-ares-muted/50'}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-normal text-ares-text">{g.name}</p>
                  {g.accountLabel && (
                    <p className="truncate text-[10px] font-light text-ares-muted">{g.accountLabel}</p>
                  )}
                </div>
                <span className="text-[10px] font-light text-ares-muted">
                  {g.connected ? 'connected' : 'not connected'}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Onboarding checklist */}
        <Card title="Onboarding checklist">
          <ol className="space-y-0">
            {CHECKLIST_STEPS.map((step, i) => {
              const done = i < stepIndex || checklist?.status === 'active';
              const current = i === stepIndex && checklist?.status !== 'active';
              const at = checklist && step.at ? (checklist as Record<string, unknown>)[step.at] as Date | null : null;
              return (
                <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < CHECKLIST_STEPS.length - 1 && (
                    <span className="absolute left-[7px] top-4 h-full w-px bg-ares-border" />
                  )}
                  <span
                    className={cn(
                      'z-10 mt-0.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border',
                      done
                        ? 'border-ares-primary bg-ares-primary text-white'
                        : current
                          ? 'border-ares-primary bg-ares-card'
                          : 'border-ares-border bg-ares-card'
                    )}
                  >
                    {done && <Icon icon={icons.checkCircle} width={11} height={11} />}
                  </span>
                  <div>
                    <p className={cn('text-[12px]', done || current ? 'font-normal text-ares-text' : 'font-light text-ares-muted')}>
                      {step.label}
                    </p>
                    {at && <p className="text-[10px] font-light text-ares-muted">{fmtDate(at)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      {/* Reports */}
      <Card
        title="Reports"
        action={
          <div className="flex items-center gap-2">
            <button
              className="btn-primary px-3 py-1.5 text-[10px]"
              disabled={triggerReport.isPending}
              onClick={() => triggerReport.mutate({ tenantId, type: 'initial_audit' })}
            >
              <Icon icon={icons.target} width={12} height={12} />
              Run initial audit
            </button>
            <button
              className="btn-secondary px-3 py-1.5 text-[10px]"
              disabled={triggerReport.isPending}
              onClick={() => triggerReport.mutate({ tenantId, type: 'monthly' })}
            >
              <Icon icon={icons.documentText} width={12} height={12} />
              Run monthly report
            </button>
          </div>
        }
      >
        {reports.length === 0 ? (
          <p className="text-[12px] font-light text-ares-muted">No reports yet — run the initial audit to kick off.</p>
        ) : (
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-ares-border">
                {['Type', 'Period', 'Status', 'Created', 'Completed'].map((h) => (
                  <th key={h} className="font-label px-2 py-2 text-ares-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-ares-border/50 last:border-0">
                  <td className="px-2 py-2">{r.type === 'initial_audit' ? 'Initial Audit' : 'Monthly'}</td>
                  <td className="px-2 py-2 text-ares-secondarytext">{r.periodLabel}</td>
                  <td className="px-2 py-2">
                    <span className={cn('badge-pill', r.status === 'complete' ? 'text-ares-primaryDark' : 'text-ares-muted')}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-ares-muted">{fmtDate(r.createdAt)}</td>
                  <td className="px-2 py-2 text-ares-muted">{fmtDate(r.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Email log */}
      <Card title="Email delivery log">
        {emailLog.length === 0 ? (
          <p className="text-[12px] font-light text-ares-muted">No emails logged yet.</p>
        ) : (
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-ares-border">
                {['To', 'Subject', 'Status', 'Created', 'Sent', ''].map((h) => (
                  <th key={h} className="font-label px-2 py-2 text-ares-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emailLog.map((e) => (
                <tr key={e.id} className="border-b border-ares-border/50 last:border-0">
                  <td className="px-2 py-2 text-ares-secondarytext">{e.toEmail}</td>
                  <td className="max-w-[280px] truncate px-2 py-2 text-ares-secondarytext" title={e.subject}>
                    {e.subject}
                    {e.error && <span className="block truncate text-[10px] text-ares-primaryDark">{e.error}</span>}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={cn(
                        'badge-pill',
                        e.status === 'sent' ? 'text-ares-primaryDark' : e.status === 'failed' ? 'text-ares-ink' : 'text-ares-muted'
                      )}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-ares-muted">{fmtDate(e.createdAt)}</td>
                  <td className="px-2 py-2 text-ares-muted">{fmtDate(e.sentAt)}</td>
                  <td className="px-2 py-2 text-right">
                    {e.status !== 'sent' && (
                      <button
                        className="btn-secondary px-2.5 py-1 text-[10px]"
                        disabled={resendEmail.isPending}
                        onClick={() => resendEmail.mutate({ emailLogId: e.id })}
                      >
                        <Icon icon={icons.refresh} width={11} height={11} />
                        Resend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add contact modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add backup contact"
        footer={
          <>
            <button className="btn-secondary px-4 py-2 text-[12px]" onClick={() => setAddOpen(false)}>Cancel</button>
            <button
              className="btn-primary px-4 py-2 text-[12px]"
              disabled={addContact.isPending || !contactName.trim() || !contactEmail.trim()}
              onClick={() =>
                addContact.mutate({ tenantId, name: contactName, email: contactEmail, role: 'backup' })
              }
            >
              {addContact.isPending ? 'Adding…' : 'Add contact'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="font-label text-ares-muted">Name</span>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="mt-1.5 w-full rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[13px] font-light outline-none focus:border-ares-primary"
            />
          </label>
          <label className="block">
            <span className="font-label text-ares-muted">Email</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="mt-1.5 w-full rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[13px] font-light outline-none focus:border-ares-primary"
            />
          </label>
          <p className="text-[10px] font-light text-ares-muted">
            New contacts are added as backup recipients with report notifications on. The primary
            contact can only be replaced, never removed last.
          </p>
        </div>
      </Modal>

      <ToastHost message={toast.message} />
    </div>
  );
}
