import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { PLAN_LABELS, PLAN_DESCRIPTIONS, type PlanTier } from '@contracts/constants';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';

const PLAN_CARDS: {
  tier: PlanTier;
  price: string;
  priceNote: string;
  features: string[];
  cta?: { label: string; href: string };
}[] = [
  {
    tier: 'report',
    price: '$399',
    priceNote: 'one-time · per company',
    features: [
      'Full audit across all six AI engines',
      'AI Visibility Score + competitor benchmark',
      'Citation gaps, alerts, first 30/60/90-day plan',
      'Board-ready PDF + portal workspace',
    ],
  },
  {
    tier: 'growth',
    price: '$1,000/mo',
    priceNote: 'per tenant · unlimited seats',
    features: [
      'Daily scans: 12 priority prompts × 6 engines',
      'Live dashboard, heatmap, competitor leaderboard',
      'Misrepresentation alerts with verified resolution',
      'Monthly AI Visibility Report + copilot access',
      'GBP, Search Console, GA4, Lighthouse integrations',
    ],
  },
  {
    tier: 'enterprise',
    price: 'Custom',
    priceNote: 'white-label · for businesses & agencies',
    features: [
      'Your logo and name on the portal and reports',
      'Unlimited client workspaces under your brand',
      'Priority support + dedicated onboarding',
      'Custom pricing — talk to us',
    ],
    cta: { label: 'Talk to us', href: 'mailto:hello@aisearchiq.net' },
  },
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
  const currentTier = plan.data.plan as PlanTier;
  const currentLabel = PLAN_LABELS[currentTier];

  return (
    <div className="space-y-4">
      {/* Current plan — prominent */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="action-card flex flex-wrap items-center justify-between gap-4 border-ares-primary p-5"
      >
        <div>
          <p className="font-label text-ares-muted">Current plan</p>
          <p className="font-display mt-2 text-[22px]">
            You're on {currentLabel}
            {plan.data.whiteLabel && (
              <span className="badge-pill ml-2 align-middle text-ares-primary">White-label</span>
            )}
          </p>
          <p className="mt-1 text-[12px] font-light text-ares-secondarytext">
            {PLAN_DESCRIPTIONS[currentTier]}
          </p>
          {plan.data.initialReport.purchased && (
            <p className="mt-3 flex items-start gap-2 text-[11px] font-light text-ares-secondarytext">
              <Icon
                icon={icons.checkCircle}
                width={14}
                height={14}
                className="mt-0.5 shrink-0 text-ares-primary"
              />
              {plan.data.initialReport.label}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
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

      {/* All three plans — current highlighted */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_CARDS.map((card, i) => {
          const isCurrent = card.tier === currentTier;
          return (
            <motion.div
              key={card.tier}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 * (i + 1), ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'action-card relative flex flex-col p-5',
                isCurrent && 'border-ares-primary'
              )}
            >
              {isCurrent && (
                <span className="badge-pill absolute right-4 top-4 text-ares-primary">
                  Current plan
                </span>
              )}
              <p className="font-label text-ares-primary">{PLAN_LABELS[card.tier]}</p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display-num text-[26px]">{card.price}</span>
              </div>
              <p className="mt-1 text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted">
                {card.priceNote}
              </p>
              <ul className="mt-4 space-y-2 border-t border-ares-border2 pt-4">
                {card.features.map((item) => (
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
              {card.cta && (
                <div className="mt-5 flex-1">
                    <a href={card.cta.href} className="btn-secondary w-full">
                      {card.cta.label}
                    </a>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Usage */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="action-card p-5"
      >
        <p className="font-label text-ares-primary">Scan budget</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-light text-ares-secondarytext">
              Prompts: {usage.promptsUsed} of {usage.promptsTotal}
            </span>
            <UsageBar used={usage.promptsUsed} total={usage.promptsTotal} />
          </div>
          <div className="flex items-center justify-between gap-3 sm:border-t-0 sm:pt-0 border-t border-ares-border2 pt-4">
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
