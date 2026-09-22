import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/portal/alerts/PageHeader';
import Modal from '@/components/portal/alerts/Modal';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';
import { ToastHost, useToast } from '@/components/portal/alerts/Toast';
import type { PlanTier } from '@contracts/constants';

const PLAN_BADGE: Record<PlanTier, string> = {
  report: 'Audit $399',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

const CHECKLIST_NEXT_ACTION: Record<string, string> = {
  new: 'Send invite',
  invited: 'Waiting for Google connect',
  google_connected: 'Run initial audit',
  first_scan_done: 'Send report',
  report_sent: 'Confirm activation',
  active: '—',
};

const STATUS_STYLES: Record<string, string> = {
  onboarding: 'border-ares-border bg-ares-secondary/40 text-ares-ink',
  active: 'border-ares-primary/40 bg-ares-primary/10 text-ares-primaryDark',
  paused: 'border-ares-border bg-ares-pageBg text-ares-muted',
  churned: 'border-ares-border bg-ares-pageBg text-ares-muted line-through',
};

const PLAN_OPTIONS: { value: PlanTier; label: string; note: string }[] = [
  { value: 'report', label: 'Initial Audit $399', note: 'One-time baseline audit' },
  { value: 'growth', label: 'Growth $1,000/mo', note: 'Recurring monthly reporting' },
  { value: 'enterprise', label: 'Enterprise', note: 'Custom, white-label' },
];

interface FormState {
  name: string;
  websiteUrl: string;
  industry: string;
  plan: PlanTier;
  primaryName: string;
  primaryEmail: string;
  backupName: string;
  backupEmail: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  websiteUrl: '',
  industry: '',
  plan: 'report',
  primaryName: '',
  primaryEmail: '',
  backupName: '',
  backupEmail: '',
};

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-label text-ares-muted">
        {label}
        {required && <span className="text-ares-primary"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[13px] font-light text-ares-text outline-none transition-colors focus:border-ares-primary"
      />
    </label>
  );
}

export default function HqClients() {
  const utils = trpc.useUtils();
  const toast = useToast();
  const clients = trpc.hq.clients.useQuery();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ tenantId: number; invitePath: string } | null>(null);

  const createClient = trpc.hq.createClient.useMutation({
    onSuccess: async (data) => {
      setCreated({ tenantId: data.tenantId, invitePath: data.invitePath });
      await utils.hq.clients.invalidate();
    },
    onError: (err) => setFormError(err.message),
  });
  const sendInvite = trpc.hq.sendInvite.useMutation({
    onSuccess: async (r) => {
      toast.show(
        r.ok
          ? `Invite emailed to ${r.sent}/${r.total} contacts.`
          : `Invite logged but email is not configured yet — share the link manually.`
      );
      await utils.hq.clients.invalidate();
    },
    onError: (err) => toast.show(`Invite failed: ${err.message}`),
  });

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const filtered = useMemo(() => {
    const rows = clients.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.tenant.name.toLowerCase().includes(q) ||
        r.tenant.industry.toLowerCase().includes(q) ||
        r.tenant.websiteUrl.toLowerCase().includes(q)
    );
  }, [clients.data, search]);

  const openModal = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreated(null);
    setModalOpen(true);
  };

  const submit = () => {
    setFormError(null);
    if (!form.name.trim() || !form.websiteUrl.trim() || !form.industry.trim()) {
      setFormError('Company name, website, and industry are required.');
      return;
    }
    if (!form.primaryName.trim() || !form.primaryEmail.trim()) {
      setFormError('A primary contact (name + email) is required.');
      return;
    }
    if (!form.backupName.trim() || !form.backupEmail.trim()) {
      setFormError('A backup contact (name + email) is required.');
      return;
    }
    createClient.mutate({
      name: form.name,
      websiteUrl: form.websiteUrl,
      industry: form.industry,
      plan: form.plan,
      primaryContact: { name: form.primaryName, email: form.primaryEmail },
      backupContact: { name: form.backupName, email: form.backupEmail },
    });
  };

  const inviteUrl = created ? `${window.location.origin}${created.invitePath}` : null;

  return (
    <div>
      <PageHeader eyebrow="HQ · Clients" title="Every client, every plan, every status">
        <div className="relative">
          <Icon
            icon={icons.magnifer}
            width={15}
            height={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ares-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-56 rounded-ares border border-ares-border bg-ares-card py-2 pl-9 pr-3 text-[12px] font-light outline-none focus:border-ares-primary"
          />
        </div>
        <button className="btn-primary px-4 py-2 text-[12px]" onClick={openModal}>
          <Icon icon={icons.addCircle} width={15} height={15} />
          New Client
        </button>
      </PageHeader>

      {clients.isLoading && <LoadingBlock rows={6} />}
      {clients.error && <ErrorBlock message={clients.error.message} onRetry={() => clients.refetch()} />}

      {clients.data && (
        <div className="overflow-x-auto rounded-ares border border-ares-border bg-ares-card">
          <table className="w-full min-w-[860px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-ares-border">
                {['Client', 'Plan', 'Status', 'Google', 'Last report', 'Next action'].map((h) => (
                  <th key={h} className="font-label px-4 py-3 text-ares-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.tenant.id}
                  className="border-b border-ares-border/50 last:border-0 hover:bg-ares-pageBg/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/clients/${row.tenant.id}`}
                      className="font-normal text-ares-text hover:text-ares-primary"
                    >
                      {row.tenant.name}
                    </Link>
                    <p className="text-[10px] font-light text-ares-muted">
                      {row.tenant.industry} · {row.tenant.websiteUrl}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-pill text-ares-primaryDark">
                      {PLAN_BADGE[row.tenant.plan as PlanTier] ?? row.tenant.plan}
                    </span>
                    {row.tenant.plan === 'report' && (
                      <p className="mt-1 text-[10px] font-light text-ares-muted">
                        {row.tenant.auditPaid ? 'Audit paid' : 'Audit unpaid'}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-ares border px-2 py-0.5 text-[10px] font-light',
                        STATUS_STYLES[row.tenant.status] ?? STATUS_STYLES.paused
                      )}
                    >
                      {row.tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        row.googleConnected === 3 ? 'text-ares-primaryDark' : 'text-ares-muted'
                      )}
                    >
                      <Icon
                        icon={row.googleConnected === 3 ? icons.checkCircle : icons.plugCircle}
                        width={14}
                        height={14}
                      />
                      {row.googleConnected}/3
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ares-secondarytext">
                    {row.lastReport ? (
                      <>
                        {row.lastReport.periodLabel}
                        <span className="ml-1 text-[10px] text-ares-muted">
                          ({row.lastReport.status})
                        </span>
                      </>
                    ) : (
                      <span className="text-ares-muted">None yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ares-secondarytext">
                    {row.checklistStatus
                      ? (CHECKLIST_NEXT_ACTION[row.checklistStatus] ?? row.checklistStatus)
                      : '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ares-muted">
                    No clients match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Client modal (plan §4 steps 1–3) */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={created ? 'Client created — send the invite' : 'New Client'}
        footer={
          created ? (
            <>
              <button className="btn-secondary px-4 py-2 text-[12px]" onClick={() => setModalOpen(false)}>
                Done
              </button>
              <button
                className="btn-primary px-4 py-2 text-[12px]"
                disabled={sendInvite.isPending}
                onClick={() => sendInvite.mutate({ tenantId: created.tenantId })}
              >
                <Icon icon={icons.letter} width={14} height={14} />
                {sendInvite.isPending ? 'Sending…' : 'Send invite email'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary px-4 py-2 text-[12px]" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary px-4 py-2 text-[12px]"
                disabled={createClient.isPending}
                onClick={submit}
              >
                {createClient.isPending ? 'Creating…' : 'Create client'}
              </button>
            </>
          )
        }
      >
        {created && inviteUrl ? (
          <div className="space-y-3">
            <p className="text-[12px] font-light leading-relaxed text-ares-secondarytext">
              The client workspace, contacts, and onboarding checklist are ready. Share this
              secure connect link with the primary contact — it expires in 7 days.
            </p>
            <div className="flex items-center gap-2 rounded-ares border border-ares-border bg-ares-pageBg px-3 py-2">
              <span className="flex-1 truncate text-[11px] font-light text-ares-ink">{inviteUrl}</span>
              <button
                className="shrink-0 text-ares-primary hover:text-ares-primaryDark"
                aria-label="Copy invite link"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl).then(() => toast.show('Invite link copied.'));
                }}
              >
                <Icon icon={icons.copyLinear} width={15} height={15} />
              </button>
            </div>
            <p className="text-[11px] font-light text-ares-muted">
              Or send it by email now — both contacts receive the branded invite.
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-3">
              <p className="font-label text-ares-primary">1 · Details</p>
              <Field label="Company name" value={form.name} onChange={(v) => set({ name: v })} required placeholder="Acme Corp" />
              <Field label="Website" value={form.websiteUrl} onChange={(v) => set({ websiteUrl: v })} required placeholder="https://acme.com" />
              <Field label="Industry" value={form.industry} onChange={(v) => set({ industry: v })} required placeholder="Professional Services" />
            </div>

            <div className="space-y-2">
              <p className="font-label text-ares-primary">2 · Plan</p>
              {PLAN_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-ares border px-3 py-2.5 transition-colors',
                    form.plan === opt.value
                      ? 'border-ares-primary bg-ares-primary/[0.06]'
                      : 'border-ares-border hover:border-ares-primary/50'
                  )}
                >
                  <input
                    type="radio"
                    name="plan"
                    className="mt-0.5 accent-ares-primary"
                    checked={form.plan === opt.value}
                    onChange={() => set({ plan: opt.value })}
                  />
                  <span>
                    <span className="block text-[12px] font-normal text-ares-text">{opt.label}</span>
                    <span className="block text-[10px] font-light text-ares-muted">{opt.note}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="space-y-3">
              <p className="font-label text-ares-primary">3 · Contacts</p>
              <fieldset className="space-y-3 rounded-ares border border-ares-border p-3">
                <legend className="px-1 text-[10px] font-light text-ares-muted">Primary contact (required)</legend>
                <Field label="Name" value={form.primaryName} onChange={(v) => set({ primaryName: v })} required />
                <Field label="Email" type="email" value={form.primaryEmail} onChange={(v) => set({ primaryEmail: v })} required />
              </fieldset>
              <fieldset className="space-y-3 rounded-ares border border-ares-border p-3">
                <legend className="px-1 text-[10px] font-light text-ares-muted">Backup contact (required)</legend>
                <Field label="Name" value={form.backupName} onChange={(v) => set({ backupName: v })} required />
                <Field label="Email" type="email" value={form.backupEmail} onChange={(v) => set({ backupEmail: v })} required />
              </fieldset>
            </div>

            {formError && (
              <p className="rounded-ares border border-ares-border bg-ares-secondary/40 px-3 py-2 text-[11px] font-light text-ares-ink">
                {formError}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ToastHost message={toast.message} />
    </div>
  );
}
