import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { BarRow, CountUp, EASE, SectionHeader, Sheet } from './primitives';
import { CATEGORY_LABELS, ENGINE_SHORT } from './types';
import type { ReportPayload } from './types';

/** Sheet ids — shared with the progress rail and TOC jump-scroll. */
export const SHEETS = [
  { id: 'report-cover', label: 'Cover' },
  { id: 'report-toc', label: 'Contents' },
  { id: 'report-s01', label: 'Executive summary' },
  { id: 'report-s02', label: 'AI visibility score' },
  { id: 'report-s03', label: 'Competitive comparison' },
  { id: 'report-s04', label: 'Prompt-level findings' },
  { id: 'report-s05', label: 'Citation & source gaps' },
  { id: 'report-s06', label: 'Misrepresentation alerts' },
  { id: 'report-s07', label: 'Optimization roadmap' },
  { id: 'report-s08', label: '30/60/90-day plan' },
] as const;

const TOC_ROWS = [
  { num: '01', title: 'Executive summary', page: '03', target: 'report-s01' },
  { num: '02', title: 'AI visibility score', page: '04', target: 'report-s02' },
  { num: '03', title: 'Competitive visibility comparison', page: '05', target: 'report-s03' },
  { num: '04', title: 'Prompt-level findings', page: '06', target: 'report-s04' },
  { num: '05', title: 'Citation and source gaps', page: '07', target: 'report-s05' },
  { num: '06', title: 'Misrepresentation alerts', page: '08', target: 'report-s06' },
  { num: '07', title: 'Optimization roadmap', page: '09', target: 'report-s07' },
  { num: '08', title: '30/60/90-day action plan', page: '10', target: 'report-s08' },
];

/** Alpha ramp for heatmap cells (design.md §5.3). */
function heatAlpha(intensity: number): number {
  return Math.min(0.9, Math.max(0.08, intensity));
}

const SEVERITY_STYLE = {
  high: { bar: 'border-l-ares-primary', icon: icons.dangerTriangle, iconClass: 'text-ares-primary', label: 'High' },
  medium: { bar: 'border-l-ares-severityMedium', icon: icons.infoCircle, iconClass: 'text-ares-severityMedium', label: 'Medium' },
  low: { bar: 'border-l-ares-muted', icon: icons.handMoney, iconClass: 'text-ares-muted', label: 'Low' },
} as const;

/**
 * Clickable data element (report.md §S2.2): hover shows a 1px primary inset
 * outline + pointer + "Open in portal" tooltip; click deep-links into the
 * portal view behind the number.
 */
function DeepLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div
      role="link"
      tabIndex={0}
      title="Open in portal"
      onClick={() => navigate(to)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(to);
      }}
      className={cn(
        'cursor-pointer rounded-ares transition-shadow duration-150 hover:shadow-[inset_0_0_0_1px_#3289AE]',
        className
      )}
    >
      {children}
    </div>
  );
}

function scrollToSheet(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * The full sheet stack (report.md §S2): cover → TOC → 8 sections + footer,
 * rendered from the frozen monthly payload.
 */
export default function ReportStack({ payload }: { payload: ReportPayload }) {
  const mentionKpi = payload.kpis.find((k) => k.label === 'Brand Mention Rate');
  const mentionRate = typeof mentionKpi?.value === 'number' ? mentionKpi.value : 48;
  const coverageKpi = payload.kpis.find((k) => k.label === 'Prompt Coverage');
  const recKpi = payload.kpis.find((k) => k.label === 'Recommendation Share');
  const leader = payload.leaderboard[0];
  const shownSources = payload.citationGaps.sources.slice(0, 6);
  const shownHeatmapRows = payload.heatmap.rows.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Cover (dark paper) ─────────────────────────────────────────── */}
      <Sheet id={SHEETS[0].id} dark className="noise-overlay flex min-h-[640px] flex-col justify-between gap-8 sm:min-h-[920px]">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon={icons.radar2} width={20} height={20} className="text-ares-primary" />
            <span className="font-label text-[13px] normal-case tracking-[0.02em] text-white/90">
              AI Visibility Intelligence
            </span>
          </div>
          <span className="font-label text-white/50">{payload.meta.label}</span>
        </div>
        <div className="relative z-10 flex flex-col gap-4 pt-16">
          <span className="font-label text-ares-primary">AI Visibility Intelligence Report</span>
          <h1 className="font-display text-[52px] leading-[52px] text-ares-secondary">
            How AI Sees
            <br />
            Your Business.
          </h1>
          <p className="font-body max-w-[480px] text-[14px] leading-[22px] text-white/70">
            A monthly executive report showing how {payload.meta.tenant} appears across AI search
            engines and large language models — visibility scores, competitor benchmarks, citation
            gaps, and a 30/60/90-day action plan.
          </p>
        </div>
        <div className="relative z-10 flex flex-col gap-6">
          <div className="section-rule-dark" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {[
              { label: 'Prepared For', value: payload.meta.tenant },
              { label: 'Industry', value: payload.meta.industry },
              { label: 'Report Date', value: payload.meta.reportDate },
              { label: 'Report ID', value: payload.meta.reportId },
              { label: 'Tenant · Seats', value: `${payload.meta.tenant} · ${payload.meta.seats} members` },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                className="flex flex-col gap-1"
              >
                <span className="font-label text-white/50">{m.label}</span>
                <span className="font-body text-[13px] text-ares-secondary">{m.value}</span>
              </motion.div>
            ))}
          </div>
          <div className="section-rule-dark" />
          <p className="font-body text-[10px] text-white/40">
            Generated from live scan data for {payload.meta.tenant}. AI Visibility Intelligence for
            the next era of search.
          </p>
        </div>
      </Sheet>

      {/* ── Table of contents ──────────────────────────────────────────── */}
      <Sheet id={SHEETS[1].id} className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Icon icon={icons.list} width={16} height={16} className="text-ares-primary" />
          <span className="font-label text-ares-primary">Contents</span>
        </div>
        <h2 className="font-display text-[32px] text-ares-text">Report Contents</h2>
        <div className="section-rule" />
        <div className="flex flex-col">
          {TOC_ROWS.map((row, i) => (
            <motion.button
              key={row.num}
              type="button"
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.04, ease: EASE }}
              onClick={() => scrollToSheet(row.target)}
              className="group flex items-baseline gap-3 border-b border-ares-border py-3 text-left"
            >
              <span className="text-[10px] font-normal uppercase tracking-[0.08em] text-ares-primary">
                {row.num}
              </span>
              <span className="text-[12px] font-light text-ares-secondarytext transition-colors duration-200 group-hover:text-ares-primary">
                {row.title}
              </span>
              <span className="mx-2 flex-1 border-b border-dotted border-ares-border transition-colors duration-200 group-hover:border-ares-primary/50" />
              <span className="text-[10px] font-light text-ares-muted">{row.page}</span>
            </motion.button>
          ))}
        </div>
        <div className="section-rule mt-2" />
        <div className="flex flex-col gap-2">
          <span className="font-label text-ares-muted">Engines Monitored</span>
          <div className="flex flex-wrap gap-2">
            {payload.meta.enginesMonitored.map((e) => (
              <span key={e} className="badge-pill text-ares-secondarytext">
                {e}
              </span>
            ))}
          </div>
        </div>
      </Sheet>

      {/* ── 01 Executive summary ───────────────────────────────────────── */}
      <Sheet id={SHEETS[2].id} className="flex flex-col gap-6">
        <SectionHeader
          num="01"
          label="Executive Summary"
          title="Executive summary."
          page="Page 03"
          delta={payload.deltas.executiveSummary}
        />
        <p className="font-body text-[13px] leading-[22px] text-ares-secondarytext">
          {payload.meta.tenant} currently appears in{' '}
          <strong className="font-normal text-ares-primary">{mentionRate}%</strong> of monitored
          AI-generated responses across priority buyer questions. The brand leads in two prompt
          categories but is absent from high-intent comparison prompts where two competitors are
          consistently recommended. Visibility is strongest on ChatGPT and weakest on Google AI
          Overviews. Three citation gaps and two misrepresentation alerts were identified. This
          report outlines the findings and a 30/60/90-day plan to improve AI visibility.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {payload.kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: EASE }}
            >
              <DeepLink to="/app" className="h-full">
                <div className="kpi-tile flex h-full flex-col gap-1">
                  <span className="font-label text-ares-muted">{kpi.label}</span>
                  <span className="font-display-num text-[28px]">
                    {typeof kpi.value === 'number' ? (
                      <CountUp value={kpi.value} suffix={kpi.unit} />
                    ) : (
                      `${kpi.value}${kpi.unit}`
                    )}
                  </span>
                  <span className="font-body text-[10px] text-ares-muted">{kpi.context}</span>
                </div>
              </DeepLink>
            </motion.div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <span className="font-label text-ares-primary">Key Findings</span>
          <ul className="flex flex-col gap-2.5">
            {payload.keyFindings.map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: EASE }}
                className="flex items-start gap-2.5"
              >
                <Icon icon={icons.arrowRight} width={13} height={13} className="mt-1 shrink-0 text-ares-primary" />
                <span className="font-body text-[12px] leading-5 text-ares-secondarytext">{f}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </Sheet>

      {/* ── 02 AI visibility score ─────────────────────────────────────── */}
      <Sheet id={SHEETS[3].id} className="flex flex-col gap-6">
        <SectionHeader num="02" label="AI Visibility Score" title="AI visibility score." page="Page 04" />
        <p className="font-body text-[13px] leading-[22px] text-ares-secondarytext">
          The AI Visibility Score is a weighted composite of five components, indexed to 100.{' '}
          {payload.meta.tenant}&apos;s composite score is{' '}
          <strong className="font-normal text-ares-primary">{payload.components.composite.indexed}</strong>,
          with prompt coverage and recommendation share the fastest-improving inputs.
        </p>
        <div className="flex flex-col gap-3">
          <span className="font-label text-ares-muted">Score by Engine</span>
          <div className="flex flex-col gap-2.5">
            {payload.engineScores.map((e, i) => (
              <DeepLink key={e.engine} to="/app" className="py-0.5">
                <BarRow label={e.label} value={e.score} index={i} />
              </DeepLink>
            ))}
          </div>
        </div>
        <div className="section-rule" />
        <div className="flex flex-col gap-3">
          <span className="font-label text-ares-muted">Score Components</span>
          <table className="data-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Weight</th>
                <th>Score</th>
                <th>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {payload.components.rows.map((r) => (
                <tr key={r.component}>
                  <td className="text-ares-secondarytext">{r.component}</td>
                  <td className="text-ares-muted">{r.weight}%</td>
                  <td className="text-ares-primary">{r.score}</td>
                  <td className="text-ares-secondarytext">{r.contribution.toFixed(1)}</td>
                </tr>
              ))}
              <tr>
                <td className="font-normal text-ares-text">Composite</td>
                <td className="text-ares-muted">{payload.components.composite.weight}%</td>
                <td className="text-ares-muted">—</td>
                <td className="font-normal text-ares-primary">
                  {payload.components.composite.raw} → {payload.components.composite.indexed} (indexed)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Sheet>

      {/* ── 03 Competitive visibility comparison ───────────────────────── */}
      <Sheet id={SHEETS[4].id} className="flex flex-col gap-6">
        <SectionHeader
          num="03"
          label="Competitive Comparison"
          title="Competitive visibility comparison."
          page="Page 05"
          delta={payload.deltas.competitive}
        />
        <p className="font-body text-[13px] leading-[22px] text-ares-secondarytext">
          {payload.meta.tenant} ranks second of four tracked brands. {leader?.brand ?? 'The leader'}{' '}
          leads at <strong className="font-normal text-ares-primary">{leader?.score ?? '—'}</strong>;
          the gap is concentrated in comparison and recommendation prompts.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Brand</th>
              <th>Score</th>
              <th>Mention Rate</th>
              <th>Rec. Share</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {payload.leaderboard.map((row) => (
              <DeepTr key={row.brand} to="/app/competitors" highlight={row.isYou}>
                <td className="text-ares-muted">{String(row.rank).padStart(2, '0')}</td>
                <td className={cn(row.isYou ? 'font-normal text-ares-primary' : 'text-ares-secondarytext')}>
                  {row.brand}
                </td>
                <td className="text-ares-primary">{row.score}</td>
                <td className="text-ares-secondarytext">{row.mentionRate}%</td>
                <td className="text-ares-secondarytext">{row.recommendationShare}%</td>
                <td>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-[10px]',
                      row.trend >= 0 ? 'text-ares-primary' : 'text-ares-muted'
                    )}
                  >
                    <Icon
                      icon={row.trend >= 0 ? icons.arrowUpLinear : icons.arrowDownLinear}
                      width={10}
                      height={10}
                    />
                    {row.trend >= 0 ? `+${row.trend}` : row.trend}
                  </span>
                </td>
              </DeepTr>
            ))}
          </tbody>
        </table>
        <div className="section-rule" />
        <div className="flex flex-col gap-3">
          <span className="font-label text-ares-muted">Mention Rate by Prompt Category</span>
          <div className="flex flex-col gap-2.5">
            {payload.categoryRates.map((c, i) => (
              <DeepLink key={c.category} to="/app/monitoring" className="py-0.5">
                <BarRow
                  label={CATEGORY_LABELS[c.category] ?? c.category}
                  value={c.rate}
                  index={i}
                  labelWidth="w-[150px]"
                />
              </DeepLink>
            ))}
          </div>
        </div>
      </Sheet>

      {/* ── 04 Prompt-level findings ───────────────────────────────────── */}
      <Sheet id={SHEETS[5].id} className="flex flex-col gap-6">
        <SectionHeader num="04" label="Prompt-Level Findings" title="Prompt-level findings." page="Page 06" />
        <p className="font-body text-[13px] leading-[22px] text-ares-secondarytext">
          {payload.heatmap.rows.length} priority prompts tested across {payload.heatmap.engines.length}{' '}
          AI engines. {payload.meta.tenant} appears in{' '}
          <strong className="font-normal text-ares-primary">
            {typeof coverageKpi?.value === 'number' ? coverageKpi.value : 61}%
          </strong>{' '}
          and is recommended in{' '}
          <strong className="font-normal text-ares-primary">
            {typeof recKpi?.value === 'number' ? recKpi.value : 34}%
          </strong>
          . A sample of the matrix is shown below — the full heatmap lives in Prompt Monitoring.
        </p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Prompt</th>
                {payload.heatmap.engines.map((e) => (
                  <th key={e.id} className="text-center">
                    {ENGINE_SHORT[e.id] ?? e.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownHeatmapRows.map((row, ri) => (
                <tr key={row.prompt}>
                  <td className="max-w-[220px] text-ares-secondarytext">{row.prompt}</td>
                  {row.cells.map((cell, ci) => (
                    <td key={cell.engine} className="p-1">
                      <HeatCell
                        intensity={cell.intensity}
                        prompt={row.prompt}
                        engine={ENGINE_SHORT[cell.engine] ?? cell.engine}
                        delay={(ri * row.cells.length + ci) * 0.03}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-light text-ares-muted">Low</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((a) => (
            <span
              key={a}
              className="h-3 w-6 rounded-ares"
              style={{ backgroundColor: `rgba(50,137,174,${a})` }}
            />
          ))}
          <span className="text-[10px] font-light text-ares-muted">High</span>
        </div>
        <p className="font-body text-[10px] text-ares-muted">
          Strongest in local and service-category prompts; weakest in comparison and decision-stage
          prompts. Every cell opens the raw AI response in the portal.
        </p>
      </Sheet>

      {/* ── 05 Citation & source gaps ──────────────────────────────────── */}
      <Sheet id={SHEETS[6].id} className="flex flex-col gap-6">
        <SectionHeader num="05" label="Citation & Source Gaps" title="Citation and source gaps." page="Page 07" />
        <p className="font-body text-[13px] leading-[22px] text-ares-secondarytext">
          {payload.meta.tenant} is referenced by{' '}
          <strong className="font-normal text-ares-primary">{payload.citationGaps.summary.present}</strong>{' '}
          of {payload.citationGaps.summary.total} monitored sources;{' '}
          {payload.citationGaps.summary.highAuthorityGaps} high-authority gaps remain.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th>Authority</th>
              <th>Status</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {shownSources.map((s) => (
              <DeepTr key={s.name} to="/app/citations">
                <td className="text-ares-secondarytext">{s.name}</td>
                <td className="capitalize text-ares-muted">{s.type}</td>
                <td className="capitalize text-ares-muted">{s.authority}</td>
                <td
                  className={cn(
                    'capitalize',
                    s.status === 'missing' ? 'font-normal text-ares-primary' : 'text-ares-secondarytext'
                  )}
                >
                  {s.status}
                </td>
                <td className="capitalize text-ares-muted">{s.impact ?? '—'}</td>
              </DeepTr>
            ))}
          </tbody>
        </table>
        <Link
          to="/app/citations"
          className="inline-flex items-center gap-1.5 text-[11px] font-light text-ares-link transition-colors duration-200 hover:text-ares-primary"
        >
          View all {payload.citationGaps.sources.length} monitored sources in the portal
          <Icon icon={icons.arrowRight} width={11} height={11} />
        </Link>
        <div className="section-rule" />
        <div className="flex flex-col gap-3">
          <span className="font-label text-ares-muted">Citation Strength by Source Type</span>
          <div className="flex flex-col gap-2.5">
            {payload.citationGaps.strengthByType.map((t, i) => (
              <DeepLink key={t.type} to="/app/citations" className="py-0.5">
                <BarRow label={t.label} value={t.score} index={i} />
              </DeepLink>
            ))}
          </div>
        </div>
      </Sheet>

      {/* ── 06 Misrepresentation alerts ────────────────────────────────── */}
      <Sheet id={SHEETS[7].id} className="flex flex-col gap-6">
        <SectionHeader
          num="06"
          label="Misrepresentation Alerts"
          title="Misrepresentation alerts."
          page="Page 08"
          delta={payload.deltas.alerts}
        />
        <p className="font-body text-[13px] leading-[22px] text-ares-secondarytext">
          {payload.alerts.length} alerts tracked across monitored engines — each carries evidence
          and a recommended fix in the portal.
        </p>
        <div className="flex flex-col gap-3">
          {payload.alerts.map((a, i) => {
            const style = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.low;
            return (
              <motion.div
                key={a.title}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1, ease: EASE }}
              >
                <DeepLink to="/app/alerts">
                  <div className={cn('rounded-ares border border-ares-border border-l-[3px] bg-ares-card p-4', style.bar)}>
                    <div className="flex items-start gap-2.5">
                      <Icon icon={style.icon} width={18} height={18} className={cn('mt-0.5 shrink-0', style.iconClass)} />
                      <div className="min-w-0">
                        <p className="font-label text-ares-text">{a.title}</p>
                        <p className="mt-1.5 font-body text-[12px] leading-5 text-ares-secondarytext">
                          {a.description}
                        </p>
                        <p className="mt-1.5 text-[10px] font-light text-ares-muted">
                          Engines affected:{' '}
                          {a.enginesAffected.map((e) => ENGINE_SHORT[e] ?? e).join(', ')} · Severity:{' '}
                          {style.label} · Status: {a.status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </div>
                </DeepLink>
              </motion.div>
            );
          })}
        </div>
        <p className="font-body text-[10px] text-ares-muted">
          Resolving alerts 01–02 is estimated at +8–12 points on sentiment accuracy.
        </p>
      </Sheet>

      {/* ── 07 Optimization roadmap ────────────────────────────────────── */}
      <Sheet id={SHEETS[8].id} className="flex flex-col gap-6">
        <SectionHeader num="07" label="Optimization Roadmap" title="Optimization roadmap." page="Page 09" />
        <p className="font-body text-[13px] leading-[22px] text-ares-secondarytext">
          Eight categories prioritized by impact × effort. Status and ownership are managed live in
          the portal action plan.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {payload.roadmap.map((r, i) => (
            <motion.div
              key={r.priority}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }}
            >
              <DeepLink to="/app/action-plan" className="h-full">
                <div className="action-card flex h-full flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-label text-ares-primary">
                      Priority {String(r.priority).padStart(2, '0')}
                    </span>
                    <span className="badge-pill text-ares-muted">{r.impact} impact</span>
                  </div>
                  <p className="font-display text-[16px] normal-case text-ares-text">{r.title}</p>
                  <p className="text-[11px] font-light leading-4 text-ares-secondarytext">{r.description}</p>
                  <span className="mt-auto text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted">
                    {r.status.replace('_', ' ')}
                  </span>
                </div>
              </DeepLink>
            </motion.div>
          ))}
        </div>
      </Sheet>

      {/* ── 08 30/60/90-day action plan + footer ───────────────────────── */}
      <Sheet id={SHEETS[9].id} className="flex flex-col gap-6">
        <SectionHeader num="08" label="Action Plan" title="30/60/90-day action plan." page="Page 10" />
        <div className="flex flex-col gap-4">
          {payload.plan.phases.map((phase, i) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.12, ease: EASE }}
              className="action-card flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-display-num text-[24px]">
                    {phase.phase.replace('d', '')}
                  </span>
                  <span className="font-label text-ares-text">{phase.label}</span>
                </div>
                <span className="badge-pill text-ares-muted">{phase.theme}</span>
              </div>
              <div className="section-rule" />
              <ul className="flex flex-col gap-2">
                {phase.items.map((item, j) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.12 + j * 0.05, ease: EASE }}
                    className="flex items-start gap-2.5"
                  >
                    <Icon icon={icons.checkCircle} width={13} height={13} className="mt-0.5 shrink-0 text-ares-primary" />
                    <span className="font-body text-[12px] leading-5 text-ares-secondarytext">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Closing CTA — portal variant (report.md §S2) */}
        <div className="noise-overlay relative flex flex-col gap-4 rounded-ares bg-ares-tertiary p-6">
          <div className="relative z-10 flex flex-col gap-3">
            <span className="font-label text-ares-primary">Next Step</span>
            <p className="font-display text-[22px] text-white">This plan is live in your portal.</p>
            <p className="font-body max-w-[440px] text-[12px] leading-5 text-white/70">
              Every item on this plan tracks status, ownership, and progress in the action plan —
              updated with each weekly scan.
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              <Link to="/app/action-plan" className="btn-primary">
                Open action plan
              </Link>
            </div>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex flex-col gap-4">
          <div className="section-rule" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon icon={icons.radar2} width={14} height={14} className="text-ares-primary" />
              <span className="font-body text-[10px] text-ares-muted">
                AI Visibility Intelligence for the next era of search.
              </span>
            </div>
            <span className="font-body text-[10px] text-ares-muted">{payload.footer}</span>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/** Heatmap cell — clickable deep-link into Prompt Monitoring. */
function HeatCell({
  intensity,
  prompt,
  engine,
  delay,
}: {
  intensity: number;
  prompt: string;
  engine: string;
  delay: number;
}) {
  const navigate = useNavigate();
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay, ease: EASE }}
      onClick={() => navigate('/app/monitoring')}
      title={`${prompt} × ${engine} · ${Math.round(intensity * 100)}% — Open in portal`}
      className="block h-7 w-full min-w-[44px] rounded-ares transition-shadow duration-150 hover:shadow-[inset_0_0_0_1px_#3289AE]"
      style={{ backgroundColor: `rgba(50,137,174,${heatAlpha(intensity)})` }}
    />
  );
}

/** Table-row deep link — keeps <tr> markup valid while navigating. */
function DeepTr({
  to,
  highlight,
  className,
  children,
}: {
  to: string;
  highlight?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <tr
      onClick={() => navigate(to)}
      title="Open in portal"
      className={cn(
        'cursor-pointer hover:shadow-[inset_0_0_0_1px_#3289AE]',
        highlight && 'bg-ares-primary/[0.04]',
        className
      )}
    >
      {children}
    </tr>
  );
}
