import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/portal/alerts/PageHeader';
import Modal from '@/components/portal/alerts/Modal';
import { ToastHost, useToast } from '@/components/portal/alerts/Toast';
import IntegrationsTab from '@/components/portal/settings/IntegrationsTab';
import BusinessProfileTab from '@/components/portal/settings/BusinessProfileTab';
import MembersTab from '@/components/portal/settings/MembersTab';
import PlanTab from '@/components/portal/settings/PlanTab';

const TABS = [
  { key: 'integrations', label: 'Integrations' },
  { key: 'profile', label: 'Business profile' },
  { key: 'members', label: 'Members' },
  { key: 'plan', label: 'Plan & billing' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'integrations';

  const toast = useToast();
  const utils = trpc.useUtils();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [retype, setRetype] = useState('');
  const [exporting, setExporting] = useState(false);

  const setTab = (key: TabKey) => {
    if (key === 'integrations') setSearchParams({}, { replace: true });
    else setSearchParams({ tab: key }, { replace: true });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const [integrations, profile, plan, members] = await Promise.all([
        utils.settings.integrations.fetch(),
        utils.settings.profile.fetch(),
        utils.settings.plan.fetch(),
        utils.settings.members.fetch(),
      ]);
      const payload = {
        exportedAt: new Date().toISOString(),
        workspace: profile.name,
        integrations,
        businessProfile: profile,
        plan,
        members,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ai-search-iq-workspace-export.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.show('Workspace export downloaded as JSON.');
    } catch {
      toast.show('Export failed — please try again.');
    } finally {
      setExporting(false);
    }
  };

  const openDelete = () => {
    setRetype('');
    setDeleteOpen(true);
    utils.settings.profile.fetch().then((p) => setTenantName(p.name)).catch(() => undefined);
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Workspace." />

      {/* S1 — settings nav tabs */}
      <div className="mb-6 flex gap-5 border-b border-ares-border">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative pb-2.5 text-[12px] font-light uppercase tracking-[0.04em] transition-colors duration-200',
                active ? 'text-ares-primary' : 'text-ares-muted hover:text-ares-secondarytext'
              )}
            >
              {t.label}
              {active && (
                <motion.span
                  layoutId="settings-tab-underline"
                  className="absolute inset-x-0 -bottom-px h-[2px] bg-ares-primary"
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content — cross-fade */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'integrations' && <IntegrationsTab notify={toast.show} />}
          {tab === 'profile' && <BusinessProfileTab notify={toast.show} />}
          {tab === 'members' && <MembersTab notify={toast.show} />}
          {tab === 'plan' && <PlanTab notify={toast.show} />}
        </motion.div>
      </AnimatePresence>

      {/* S6 — danger zone */}
      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-ares border border-ares-primaryDark bg-ares-card p-5">
        <div className="min-w-0 flex-1">
          <p className="font-label text-ares-primaryDark">Danger zone</p>
          <p className="mt-1 text-[11px] font-light text-ares-muted">
            Export everything your workspace holds, or delete the workspace entirely.
          </p>
        </div>
        <button className="btn-secondary !px-3 !py-1.5 text-[10px]" onClick={handleExport} disabled={exporting}>
          <Icon icon={icons.downloadMinimalistic} width={13} height={13} />
          {exporting ? 'Preparing…' : 'Export workspace data'}
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-ares border border-transparent px-3 py-1.5 text-[10px] font-light uppercase tracking-[0.08em] text-ares-primaryDark transition-colors duration-200 hover:border-ares-primaryDark"
          onClick={openDelete}
        >
          <Icon icon={icons.trashBinMinimalistic} width={13} height={13} />
          Delete workspace
        </button>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete workspace"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary !border-ares-primaryDark !bg-ares-primaryDark"
              disabled={!tenantName || retype !== tenantName}
              onClick={() => {
                setDeleteOpen(false);
                toast.show(
                  'Workspace deletion request sent — your operator will confirm within 24 hours.'
                );
              }}
            >
              Delete workspace
            </button>
          </>
        }
      >
        <p className="text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
          This removes all scan history, alerts, and plan data for the workspace. To confirm, type
          the company name{tenantName ? ` — “${tenantName}”` : ''}.
        </p>
        <input
          value={retype}
          onChange={(e) => setRetype(e.target.value)}
          placeholder={tenantName || 'Company name'}
          className="mt-3 w-full rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[12px] font-light text-ares-secondarytext placeholder:text-ares-muted focus:border-ares-primaryDark focus:outline-none"
        />
      </Modal>

      <ToastHost message={toast.message} />
    </div>
  );
}
