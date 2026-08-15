import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/portal/alerts/PageHeader';
import AlertCard, { SEVERITY_META } from '@/components/portal/alerts/AlertCard';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';
import { ToastHost, useToast } from '@/components/portal/alerts/Toast';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved';

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
  ai_overviews: 'Google AI Overviews',
  ai_search: 'AI Search',
};

const SEVERITY_CONTEXT: Record<'high' | 'medium' | 'low', string> = {
  high: 'est. +8–12 pts sentiment accuracy when resolved',
  medium: 'verify within 60 days',
  low: 'address via 30/60/90 plan',
};

function prettyType(type: string) {
  const s = type.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Alerts() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [engineFilter, setEngineFilter] = useState<string>('all');
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [pendingBanner, setPendingBanner] = useState<string | null>(null);
  const [notif, setNotif] = useState({ immediate: true, daily: true, weekly: false });
  const toast = useToast();

  const utils = trpc.useUtils();
  const list = trpc.alerts.list.useQuery();
  const counts = trpc.alerts.counts.useQuery();
  const members = trpc.settings.members.useQuery();

  const updateStatus = trpc.alerts.updateStatus.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.alerts.list.cancel();
      const prev = utils.alerts.list.getData();
      utils.alerts.list.setData(undefined, (old) =>
        old?.map((a) => (a.id === id ? { ...a, status } : a))
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) utils.alerts.list.setData(undefined, ctx.prev);
      toast.show(err.message || 'Status change rejected by the lifecycle rules.');
    },
    onSuccess: (updated, vars) => {
      if (!updated) return;
      const short = updated.title.split('·')[0].trim();
      if (vars.status === 'in_progress') {
        toast.show(`${short} acknowledged — fix in progress.`);
      } else if (vars.status === 'resolved') {
        toast.show(`${short} moved to Pending verification — we'll confirm on the next two scans.`);
      } else if (vars.status === 'verified') {
        toast.show(`${short} verified — correction confirmed by scan.`);
      }
    },
    onSettled: () => {
      utils.alerts.list.invalidate();
      utils.alerts.counts.invalidate();
    },
  });

  const alerts = useMemo(() => list.data ?? [], [list.data]);

  const engines = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach((a) => a.enginesAffected.forEach((e) => set.add(e)));
    return Array.from(set);
  }, [alerts]);

  const matches = (a: (typeof alerts)[number]) => {
    if (engineFilter !== 'all' && !a.enginesAffected.includes(engineFilter)) return false;
    return true;
  };

  const isActive = (s: string) => s === 'open' || s === 'in_progress';
  const activeAlerts = alerts.filter(
    (a) => isActive(a.status) && matches(a) && (statusFilter === 'all' || a.status === statusFilter)
  );
  const resolvedAlerts = alerts.filter(
    (a) =>
      !isActive(a.status) && matches(a) && (statusFilter === 'all' || statusFilter === 'resolved')
  );

  const severityCounts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    const firstType: Record<string, string | null> = { high: null, medium: null, low: null };
    alerts.forEach((a) => {
      if (isActive(a.status)) {
        c[a.severity] += 1;
        if (!firstType[a.severity]) firstType[a.severity] = a.type;
      }
    });
    return { c, firstType };
  }, [alerts]);

  const memberNames = (members.data ?? []).map((m) => m.name ?? m.email ?? 'Member');

  const chips: { key: StatusFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: counts.data?.total },
    { key: 'open', label: 'Open', count: counts.data?.open },
    { key: 'in_progress', label: 'In progress', count: counts.data?.inProgress },
    { key: 'resolved', label: 'Resolved', count: counts.data?.resolved },
  ];

  return (
    <div>
      <PageHeader eyebrow="Alerts" title="When AI gets you wrong.">
        {chips.map((chip, i) => (
          <motion.button
            key={chip.key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            onClick={() => setStatusFilter(chip.key)}
            className={cn(
              'badge-pill transition-colors duration-200',
              statusFilter === chip.key
                ? 'border-ares-primary text-ares-primary'
                : 'text-ares-muted hover:text-ares-secondarytext'
            )}
          >
            {chip.label}
            {chip.count !== undefined && ` ${chip.count}`}
          </motion.button>
        ))}
        <select
          value={engineFilter}
          onChange={(e) => setEngineFilter(e.target.value)}
          className="rounded-ares border border-ares-border bg-ares-card px-2 py-1 text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted focus:border-ares-primary focus:outline-none"
          aria-label="Filter by engine"
        >
          <option value="all">All engines</option>
          {engines.map((e) => (
            <option key={e} value={e}>
              {ENGINE_LABEL[e] ?? e}
            </option>
          ))}
        </select>
      </PageHeader>

      {/* S5 — verification banner */}
      <AnimatePresence>
        {pendingBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mb-6 flex items-center gap-2.5 rounded-ares border border-ares-border border-l-[3px] border-l-ares-primary bg-ares-card px-4 py-2.5"
          >
            <Icon icon={icons.refresh} width={14} height={14} className="shrink-0 text-ares-primary" />
            <p className="text-[11px] font-light text-ares-secondarytext">
              {pendingBanner} is pending verification — the next two scans will confirm the
              correction.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* S2 — severity summary strip */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {(['high', 'medium', 'low'] as const).map((sev, i) => {
          const meta = SEVERITY_META[sev];
          const type = severityCounts.firstType[sev];
          return (
            <motion.div
              key={sev}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="kpi-tile relative overflow-hidden pl-5"
            >
              <motion.span
                className={cn('absolute inset-y-0 left-0 w-[3px] origin-top', meta.barClass)}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.07 }}
              />
              <p className="font-label text-ares-muted">{meta.label}</p>
              <p className="font-display-num mt-1 text-[28px]">{severityCounts.c[sev]}</p>
              <p className="mt-1 text-[10px] font-light text-ares-muted">
                {type ? `${prettyType(type)} · ${SEVERITY_CONTEXT[sev]}` : 'No active alerts'}
              </p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* S3 — alert feed */}
        <div className="space-y-4 lg:col-span-8">
          {list.isLoading && (
            <>
              <LoadingBlock rows={4} />
              <LoadingBlock rows={4} />
            </>
          )}
          {list.isError && (
            <ErrorBlock message={list.error.message} onRetry={() => list.refetch()} />
          )}
          {list.isSuccess && activeAlerts.length === 0 && statusFilter !== 'resolved' && (
            <div className="rounded-ares border border-ares-border bg-ares-card p-8 text-center">
              <Icon
                icon={icons.checkCircle}
                width={24}
                height={24}
                className="mx-auto text-ares-primary"
              />
              <p className="font-body mt-3 text-ares-secondarytext">
                No active alerts match these filters — AI is describing you correctly.
              </p>
            </div>
          )}

          {list.isSuccess &&
            statusFilter !== 'resolved' &&
            activeAlerts.map((alert, i) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                index={i}
                members={memberNames}
                assignee={assignments[alert.id]}
                advancing={updateStatus.isPending}
                onAdvance={(id, next) => updateStatus.mutate({ id, status: next })}
                onAssign={(id, name) => {
                  setAssignments((m) => ({ ...m, [id]: name }));
                  toast.show(`Alert assigned to ${name}.`);
                }}
                onPendingVerification={(title) =>
                  setPendingBanner(title.split('·')[0].trim())
                }
              />
            ))}

          {/* Resolved section */}
          {list.isSuccess && resolvedAlerts.length > 0 && (
            <div className="rounded-ares border border-ares-border bg-ares-card">
              <button
                className="flex w-full items-center gap-2.5 px-5 py-4 text-left"
                onClick={() => setResolvedOpen((v) => !v)}
                aria-expanded={resolvedOpen}
              >
                <Icon
                  icon={icons.altArrowDown}
                  width={14}
                  height={14}
                  className={cn(
                    'text-ares-muted transition-transform duration-200',
                    resolvedOpen && 'rotate-180'
                  )}
                />
                <span className="font-label text-ares-muted">Resolved</span>
                <span className="badge-pill text-ares-muted">{resolvedAlerts.length}</span>
              </button>
              <AnimatePresence initial={false}>
                {resolvedOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <ul className="border-t border-ares-border2">
                      {resolvedAlerts.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-start gap-3 border-b border-ares-border2 px-5 py-3.5 opacity-60 last:border-b-0"
                        >
                          <Icon
                            icon={icons.checkCircle}
                            width={16}
                            height={16}
                            className="mt-0.5 shrink-0 text-ares-primary"
                          />
                          <div className="min-w-0">
                            <p className="text-[12px] font-light text-ares-secondarytext">
                              {a.title}
                            </p>
                            <p className="mt-0.5 text-[10px] font-light text-ares-muted">
                              {a.resolvedAt &&
                                `Resolved ${format(new Date(a.resolvedAt), 'MMM dd')}`}
                              {a.status === 'verified' && ' — verified by rescan'}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* S4 — right sidebar */}
        <div className="space-y-4 lg:col-span-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="action-card"
          >
            <p className="font-label text-ares-primary">Severity model</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[11px] font-normal uppercase tracking-[0.08em] text-ares-primaryDark">
                  High
                </p>
                <p className="mt-0.5 text-[11px] font-light leading-[17px] text-ares-secondarytext">
                  Wrong core fact in buyer-intent answers · immediate notification
                </p>
              </div>
              <div className="border-t border-ares-border2 pt-3">
                <p className="text-[11px] font-normal uppercase tracking-[0.08em] text-ares-primary">
                  Medium
                </p>
                <p className="mt-0.5 text-[11px] font-light leading-[17px] text-ares-secondarytext">
                  Incorrect secondary fact, limited spread · daily digest
                </p>
              </div>
              <div className="border-t border-ares-border2 pt-3">
                <p className="text-[11px] font-normal uppercase tracking-[0.08em] text-ares-muted">
                  Low
                </p>
                <p className="mt-0.5 text-[11px] font-light leading-[17px] text-ares-secondarytext">
                  Missing signal, not a wrong fact · weekly digest
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="action-card"
          >
            <p className="font-label text-ares-primary">Sentiment accuracy</p>
            <p className="font-display-num mt-2 text-[28px]">72</p>
            <p className="mt-2 text-[11px] font-light leading-[17px] text-ares-secondarytext">
              Alerts feed the sentiment-accuracy component (10% of your score). Resolving alerts 01
              and 02 is estimated to improve it by 8–12 points.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="action-card"
          >
            <p className="font-label text-ares-primary">Notification settings</p>
            <div className="mt-3 space-y-3">
              {(
                [
                  ['immediate', 'Immediate email for High alerts'],
                  ['daily', 'Daily digest'],
                  ['weekly', 'Weekly summary'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-light text-ares-secondarytext">{label}</span>
                  <Switch
                    checked={notif[key]}
                    onCheckedChange={(v) => {
                      setNotif((n) => ({ ...n, [key]: v }));
                      toast.show(
                        `${label} ${v ? 'enabled' : 'disabled'} — applies from the next scan.`
                      );
                    }}
                    className="rounded-ares data-[state=checked]:bg-ares-primary [&>span]:rounded-ares"
                  />
                </label>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <ToastHost message={toast.message} />
    </div>
  );
}
