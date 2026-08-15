import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/portal/alerts/PageHeader';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';
import { ToastHost, useToast } from '@/components/portal/alerts/Toast';
import RoadmapCard, { type RoadmapStatus } from '@/components/portal/action-plan/RoadmapCard';
import PhaseCard, { type ChecklistItem } from '@/components/portal/action-plan/PhaseCard';

const ROADMAP_FILTERS: { key: 'all' | RoadmapStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'suggested', label: 'Suggested' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
];

const LOOP_STEPS = ['Measure', 'Act', 'Re-measure'];

export default function ActionPlan() {
  const [roadmapFilter, setRoadmapFilter] = useState<'all' | RoadmapStatus>('all');
  const toast = useToast();

  const utils = trpc.useUtils();
  const roadmap = trpc.actionPlan.roadmap.useQuery();
  const checklist = trpc.actionPlan.checklist.useQuery();
  const progress = trpc.actionPlan.progress.useQuery();

  const invalidate = () => {
    utils.actionPlan.roadmap.invalidate();
    utils.actionPlan.checklist.invalidate();
    utils.actionPlan.progress.invalidate();
  };

  const updateStatus = trpc.actionPlan.updateStatus.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.actionPlan.roadmap.cancel();
      await utils.actionPlan.checklist.cancel();
      const prevRoadmap = utils.actionPlan.roadmap.getData();
      const prevChecklist = utils.actionPlan.checklist.getData();
      utils.actionPlan.roadmap.setData(undefined, (old) =>
        old?.map((c) => (c.id === id ? { ...c, status } : c))
      );
      utils.actionPlan.checklist.setData(undefined, (old) => {
        if (!old) return old;
        const phases = old.phases.map((p) => {
          const items = p.items.map((i) => (i.id === id ? { ...i, status } : i));
          return { ...p, items, done: items.filter((i) => i.status === 'done').length };
        });
        return { ...old, phases, done: phases.reduce((acc, p) => acc + p.done, 0) };
      });
      return { prevRoadmap, prevChecklist };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prevRoadmap) utils.actionPlan.roadmap.setData(undefined, ctx.prevRoadmap);
      if (ctx?.prevChecklist) utils.actionPlan.checklist.setData(undefined, ctx.prevChecklist);
      toast.show(err.message || 'Could not update the plan item.');
    },
    onSettled: invalidate,
  });

  const onRoadmapStatus = (id: number, status: RoadmapStatus) => {
    const card = roadmap.data?.find((c) => c.id === id);
    updateStatus.mutate({ id, status });
    const num = String(card?.priority ?? 0).padStart(2, '0');
    if (status === 'accepted') toast.show(`Priority ${num} accepted — added to your 30-day phase.`);
    else if (status === 'in_progress') toast.show(`Priority ${num} moved to in progress.`);
    else if (status === 'done')
      toast.show(`Priority ${num} done — it will be re-measured on the next scan.`);
    else toast.show(`Priority ${num} moved back to suggested.`);
  };

  const onChecklistToggle = (item: ChecklistItem) => {
    const next = item.status === 'done' ? 'todo' : 'done';
    const phase = checklist.data?.phases.find((p) => p.items.some((i) => i.id === item.id));
    updateStatus.mutate({ id: item.id, status: next });
    if (next === 'done') {
      const willComplete =
        phase && phase.total > 0 && phase.items.every((i) => i.id === item.id || i.status === 'done');
      toast.show(
        willComplete
          ? `${phase.label} complete — re-measured on the next scan.`
          : `"${item.title}" marked done — progress saved.`
      );
    }
  };

  const cards = (roadmap.data ?? []).filter(
    (c) => roadmapFilter === 'all' || c.status === roadmapFilter
  );

  return (
    <div>
      <PageHeader eyebrow="Action" title="From findings to fixes.">
        <span className="badge-pill text-ares-muted">
          <Icon icon={icons.target} width={12} height={12} className="text-ares-primary" />
          Plan progress: {progress.data ? `${progress.data.done} of ${progress.data.total}` : '…'}{' '}
          items done · regenerated after each scan
        </span>
      </PageHeader>

      {/* S2 — Optimization roadmap */}
      <section>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="font-label text-ares-primary">Optimization roadmap</p>
          <span className="text-[10px] font-light text-ares-muted">
            Prioritized by impact × effort
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {ROADMAP_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setRoadmapFilter(f.key)}
                className={cn(
                  'badge-pill transition-colors duration-200',
                  roadmapFilter === f.key
                    ? 'border-ares-primary text-ares-primary'
                    : 'text-ares-muted hover:text-ares-secondarytext'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {roadmap.isLoading && (
            <>
              <LoadingBlock rows={4} />
              <LoadingBlock rows={4} />
            </>
          )}
          {roadmap.isError && (
            <div className="md:col-span-2">
              <ErrorBlock message={roadmap.error.message} onRetry={() => roadmap.refetch()} />
            </div>
          )}
          {roadmap.isSuccess && cards.length === 0 && (
            <div className="rounded-ares border border-ares-border bg-ares-card p-8 text-center md:col-span-2">
              <p className="font-body text-ares-secondarytext">
                No roadmap items with this status.
              </p>
            </div>
          )}
          {roadmap.isSuccess &&
            cards.map((card, i) => (
              <RoadmapCard
                key={card.id}
                item={card}
                index={i}
                updating={updateStatus.isPending}
                onStatus={onRoadmapStatus}
              />
            ))}
        </div>
      </section>

      {/* S3 — 30/60/90-day plan */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-label text-ares-primary">30/60/90-day action plan</p>
          <span className="text-[10px] font-light text-ares-muted">
            Auto-generated from current findings · benchmark scan auto-scheduled at Day 61–90
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {checklist.isLoading && (
            <>
              <LoadingBlock rows={5} />
              <LoadingBlock rows={5} />
              <LoadingBlock rows={5} />
            </>
          )}
          {checklist.isError && (
            <div className="lg:col-span-3">
              <ErrorBlock message={checklist.error.message} onRetry={() => checklist.refetch()} />
            </div>
          )}
          {checklist.isSuccess &&
            checklist.data.phases.map((phase, i) => (
              <PhaseCard
                key={phase.phase}
                phase={phase}
                index={i}
                updating={updateStatus.isPending}
                onToggle={onChecklistToggle}
              />
            ))}
        </div>
      </section>

      {/* S4 — Closed-loop explainer strip */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 rounded-ares bg-ares-tertiary p-6 lg:p-8"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          {/* Measure → Act → Re-measure */}
          <div className="flex items-center gap-0">
            {LOOP_STEPS.map((step, i) => (
              <div key={step} className="flex items-center">
                {i > 0 && (
                  <motion.span
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.2 + i * 0.2 }}
                    className="mx-2 h-px w-6 origin-left border-t border-dotted border-white/40 sm:w-10"
                  />
                )}
                <motion.span
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.2 }}
                  className="font-label whitespace-nowrap text-ares-primary"
                >
                  {step}
                </motion.span>
              </div>
            ))}
          </div>
          <p className="flex-1 text-[12px] font-light leading-[19.5px] text-on-dark">
            Every completed item is re-measured on the next scan. The Day 61–90 benchmark compares
            against your Jul baseline and regenerates this plan — the loop no monitoring-only tool
            closes.
          </p>
          <Link
            to="/app/ask?q=What%20should%20I%20do%20first%3F"
            className="btn-secondary-dark shrink-0"
          >
            <Icon icon={icons.chatRoundDots} width={14} height={14} />
            Ask the copilot about this plan
          </Link>
        </div>
      </motion.section>

      <ToastHost message={toast.message} />
    </div>
  );
}
