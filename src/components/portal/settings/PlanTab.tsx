import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';

const INCLUDED = [
  'Daily scans across all six AI engines',
  '12-prompt monitored prompt set',
  'Citation & source tracking (22 sources)',
  'Misrepresentation alerts with rescan verification',
  'Monthly AI Visibility Report + copilot access',
];

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="bar-track w-24">
      <motion.div
        className="bar-fill"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export default function PlanTab({ notify }: { notify: (msg: string) => void }) {
  const plan = trpc.settings.plan.useQuery();

  if (plan.isLoading)
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <LoadingBlock rows={6} />
        <LoadingBlock rows={6} />
      </div>
    );
  if (plan.isError)
    return <ErrorBlock message={plan.error.message} onRetry={() => plan.refetch()} />;
  if (!plan.data) return null;

  const { usage } = plan.data;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Current plan */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="action-card p-5"
      >
        <p className="font-label text-ares-primary">AI Search IQ Platform</p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display-num text-[32px]">
            ${plan.data.priceMonthly.toLocaleString()}/mo
          </span>
          <span className="text-[10px] font-light text-ares-muted">{plan.data.priceNote}</span>
        </div>

        <ul className="mt-4 space-y-2 border-t border-ares-border2 pt-4">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Icon
                icon={icons.checkCircle}
                width={14}
                height={14}
                className="mt-0.5 shrink-0 text-ares-primary"
              />
              <span className="text-[12px] font-light text-ares-secondarytext">{item}</span>
            </li>
          ))}
        </ul>

        {plan.data.initialReport.purchased && (
          <p className="mt-4 flex items-start gap-2 border-t border-ares-border2 pt-4 text-[11px] font-light text-ares-secondarytext">
            <Icon
              icon={icons.checkCircle}
              width={14}
              height={14}
              className="mt-0.5 shrink-0 text-ares-primary"
            />
            {plan.data.initialReport.label}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            onClick={() => notify('Billing is managed by your operator — invoices are emailed monthly.')}
          >
            Manage billing
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-ares border border-transparent px-4 py-2 text-[12px] font-light uppercase tracking-[0.04em] text-ares-primaryDark transition-colors duration-200 hover:border-ares-primaryDark"
            onClick={() =>
              notify('To cancel, contact your operator — no self-serve cancellation in the first quarter.')
            }
          >
            Cancel plan
          </button>
        </div>
      </motion.div>

      {/* Usage */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="action-card p-5"
      >
        <p className="font-label text-ares-primary">Scan budget</p>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-light text-ares-secondarytext">
              Prompts: {usage.promptsUsed} of {usage.promptsTotal}
            </span>
            <UsageBar used={usage.promptsUsed} total={usage.promptsTotal} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-ares-border2 pt-4">
            <span className="text-[12px] font-light text-ares-secondarytext">
              Engines: {usage.enginesUsed} of {usage.enginesTotal}
            </span>
            <UsageBar used={usage.enginesUsed} total={usage.enginesTotal} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-ares-border2 pt-4">
            <span className="text-[12px] font-light text-ares-secondarytext">
              Scans this month: {usage.scansThisMonth} daily runs
            </span>
            <Icon icon={icons.refresh} width={14} height={14} className="text-ares-primary" />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-ares-border2 pt-4">
            <span className="text-[12px] font-light text-ares-secondarytext">
              Report: {usage.reportStatus}
            </span>
            <Icon icon={icons.documentText} width={14} height={14} className="text-ares-primary" />
          </div>
        </div>

        <p className="mt-5 text-[10px] font-light leading-[15px] text-ares-muted">
          Need more prompts? Contact your operator — expansion is configuration, not an upsell.
        </p>
      </motion.div>
    </div>
  );
}
