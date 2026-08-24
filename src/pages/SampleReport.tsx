// Sample Report — /sample-report (design: sample-report.md)
// Interactive web rendering of the sample AI Visibility Report.
import { useRef } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { LOGIN_PATH } from '@/const';
import {
  CountUp,
  EASE,
  RadarMark,
  prefersReducedMotion,
  useInViewOnce,
  useLenis,
} from '@/components/marketing/shared';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/* --------------------------------- print CSS -------------------------------- */

const PRINT_CSS = `
@media print {
  header, footer, [data-report-toolbar] { display: none !important; }
  body { background: #ffffff !important; }
  .report-stack { padding: 0 !important; gap: 0 !important; max-width: none !important; }
  .report-sheet {
    box-shadow: none !important;
    border-radius: 0 !important;
    margin: 0 !important;
    max-width: none !important;
    min-height: auto !important;
    page-break-after: always;
    break-after: page;
  }
}
`;

/* ----------------------------------- data ----------------------------------- */

const TOC = [
  { num: '01', title: 'Executive summary', page: '03', href: '#section-01' },
  { num: '02', title: 'AI visibility score', page: '04', href: '#section-02' },
  { num: '03', title: 'Competitive visibility comparison', page: '05', href: '#section-03' },
  { num: '04', title: 'Prompt-level findings', page: '06', href: '#section-04' },
  { num: '05', title: 'Citation and source gaps', page: '07', href: '#section-05' },
  { num: '06', title: 'Misrepresentation alerts', page: '08', href: '#section-06' },
  { num: '07', title: 'Optimization roadmap', page: '09', href: '#section-07' },
  { num: '08', title: '30/60/90-day action plan', page: '10', href: '#section-08' },
];

const ENGINE_NAMES = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'Google AI Overviews', 'AI Search'];

const ENGINE_SCORES = [
  { name: 'ChatGPT', value: 78 },
  { name: 'Gemini', value: 64 },
  { name: 'Claude', value: 52 },
  { name: 'Perplexity', value: 41 },
  { name: 'Google AI Overviews', value: 33 },
  { name: 'AI Search', value: 58 },
];

const SCORE_COMPONENTS = [
  { component: 'Mention rate', weight: '30%', score: '48', contribution: '14.4' },
  { component: 'Recommendation share', weight: '25%', score: '34', contribution: '8.5' },
  { component: 'Citation strength', weight: '20%', score: '65', contribution: '13.0' },
  { component: 'Prompt coverage', weight: '15%', score: '61', contribution: '9.2' },
  { component: 'Sentiment accuracy', weight: '10%', score: '72', contribution: '7.2' },
];

const LEADERBOARD = [
  { rank: '01', brand: 'Atlas Capital', score: 88, mention: '74%', rec: '61%' },
  { rank: '02', brand: 'Northwind Advisory', score: 72, mention: '48%', rec: '34%', tenant: true },
  { rank: '03', brand: 'Beacon Partners', score: 65, mention: '41%', rec: '22%' },
  { rank: '04', brand: 'Cedarwood Group', score: 49, mention: '28%', rec: '11%' },
];

const CATEGORY_BARS = [
  { name: '"Best option" prompts', value: 34 },
  { name: 'Comparison prompts', value: 29 },
  { name: 'Local / "near me"', value: 67 },
  { name: 'Service category', value: 54 },
  { name: 'Decision-stage', value: 38 },
];

const HEATMAP = [
  { prompt: 'Best financial advisor near me', cells: [0.85, 0.65, 0.4, 0.3, 0.2, 0.7] },
  { prompt: 'Top CPA firms for small business', cells: [0.7, 0.5, 0.35, 0.25, 0.15, 0.55] },
  { prompt: 'Compare wealth management firms', cells: [0.4, 0.3, 0.2, 0.15, 0.1, 0.3] },
  { prompt: 'Best tax planning services', cells: [0.75, 0.6, 0.45, 0.35, 0.25, 0.6] },
  { prompt: 'Who should I trust for retirement planning', cells: [0.35, 0.25, 0.2, 0.1, 0.08, 0.25] },
];

const CITATIONS = [
  { source: 'Industry Directory A', type: 'Directory', authority: 'High', status: 'Missing', impact: 'High' },
  { source: 'Regional Business Journal', type: 'Article', authority: 'High', status: 'Missing', impact: 'High' },
  { source: 'Professional Listings Hub', type: 'Listing', authority: 'Medium', status: 'Missing', impact: 'Medium' },
  { source: 'Trustpilot Reviews', type: 'Reviews', authority: 'Medium', status: 'Present', impact: '—' },
  { source: 'Google Business Profile', type: 'Listing', authority: 'High', status: 'Present', impact: '—' },
  { source: 'Wikipedia (company)', type: 'Knowledge', authority: 'High', status: 'Present', impact: '—' },
];

const CITATION_STRENGTH = [
  { name: 'Directories', value: 42 },
  { name: 'Articles', value: 55 },
  { name: 'Listings', value: 70 },
  { name: 'Reviews', value: 68 },
  { name: 'Knowledge', value: 80 },
];

const ALERTS = [
  {
    severity: 'high' as const,
    icon: icons.dangerTriangle,
    label: 'Alert 01 · Outdated Service Area',
    body: 'ChatGPT and Gemini describe Northwind as operating in two regions. The brand now serves four regions. Update service pages and directory listings to reflect current coverage.',
    meta: 'Engines affected: ChatGPT, Gemini · Severity: High',
  },
  {
    severity: 'medium' as const,
    icon: icons.infoCircle,
    label: 'Alert 02 · Incorrect Founding Year',
    body: 'Perplexity cites a founding year of 2011. The correct year is 2009. Correct the Wikipedia entry and authoritative directory listings to resolve the discrepancy.',
    meta: 'Engines affected: Perplexity, AI Search · Severity: Medium',
  },
  {
    severity: 'low' as const,
    icon: icons.handMoney,
    label: 'Alert 03 · Missing Pricing Signal',
    body: "AI engines do not surface Northwind's fee structure in comparison prompts, while competitors publish transparent pricing. Consider publishing a pricing overview page.",
    meta: 'Engines affected: All · Severity: Low',
  },
];

const ROADMAP = [
  { num: '01', impact: 'High', title: 'Website content improvements', body: 'Rewrite service pages to match buyer-intent language used in priority prompts.' },
  { num: '02', impact: 'High', title: 'FAQ and buyer-intent content', body: 'Publish FAQ pages answering the 12 monitored priority prompts verbatim.' },
  { num: '03', impact: 'High', title: 'Schema and structured data', body: 'Add Organization, FAQ, and Service schema across all priority pages.' },
  { num: '04', impact: 'Medium', title: 'Google Business Profile optimization', body: 'Update service areas, categories, and attributes to match current operations.' },
  { num: '05', impact: 'High', title: 'Directory and citation cleanup', body: 'Add listings to the three missing high-authority directories identified in Section 05.' },
  { num: '06', impact: 'Medium', title: 'Authority-building content', body: 'Publish bylined thought leadership in the Regional Business Journal.' },
  { num: '07', impact: 'Medium', title: 'Competitive positioning updates', body: 'Add comparison pages positioning Northwind against Atlas Capital and Beacon.' },
  { num: '08', impact: 'Low', title: 'AI-readable service pages', body: 'Restructure service pages with clear headings, summaries, and entity labels.' },
];

const PHASES = [
  {
    num: '30',
    label: 'Days 1–30 · Stabilize',
    theme: 'Quick Wins',
    items: [
      'Correct founding year across Wikipedia and directory listings',
      'Update service areas on Google Business Profile',
      'Add listings to the three missing high-authority directories',
      'Publish pricing overview page',
    ],
  },
  {
    num: '60',
    label: 'Days 31–60 · Build',
    theme: 'Content & Schema',
    items: [
      'Rewrite service pages to match buyer-intent language',
      'Publish FAQ pages answering the 12 priority prompts',
      'Add Organization, FAQ, and Service schema',
      'Launch comparison pages against Atlas Capital and Beacon',
    ],
  },
  {
    num: '90',
    label: 'Days 61–90 · Expand',
    theme: 'Authority',
    items: [
      'Publish bylined thought leadership in Regional Business Journal',
      'Restructure service pages with AI-readable headings and summaries',
      'Run follow-up visibility scan and benchmark against baseline',
      'Review recommendation share and adjust content priorities',
    ],
  },
];

/* --------------------------------- pieces ----------------------------------- */

/** Paper sheet wrapper. */
function Sheet({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        'report-sheet scroll-mt-32 rounded-ares bg-ares-surface p-8 shadow-paper sm:p-14',
        className
      )}
    >
      {children}
    </section>
  );
}

/** Section page header pattern (all § pages). */
function PageHeader({ num, label, page, title }: { num: string; label: string; page: string; title: string }) {
  return (
    <header>
      <div className="flex items-center justify-between">
        <p className="font-label">
          <span className="text-ares-primary">{num}</span>
          <span className="ml-3 text-ares-muted">{label}</span>
        </p>
        <p className="font-label text-ares-muted">Page {page}</p>
      </div>
      <h2 className="font-display mt-4 text-[clamp(24px,4vw,32px)]">{title}</h2>
      <div className="section-rule mt-5" />
    </header>
  );
}

/** Animated score bar row. */
function BarRow({
  label,
  value,
  suffix = '',
  active,
  delay,
}: {
  label: string;
  value: number;
  suffix?: string;
  active: boolean;
  delay: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[130px] shrink-0 text-[11px] font-light text-ares-secondarytext">{label}</span>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: active ? `${value}%` : '0%', transitionDelay: `${delay}ms` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-[11px] font-normal text-ares-primary">
        {value}
        {suffix}
      </span>
    </div>
  );
}

/** KPI tile with optional count-up. */
function KpiTile({
  label,
  value,
  suffix,
  textValue,
  context,
}: {
  label: string;
  value?: number;
  suffix?: string;
  textValue?: string;
  context: string;
}) {
  return (
    <div className="kpi-tile">
      <p className="font-label text-ares-muted">{label}</p>
      <p className="font-display-num mt-2 text-[28px]">
        {value != null ? <CountUp value={value} suffix={suffix} duration={0.9} /> : textValue}
      </p>
      <p className="mt-1 text-[10px] font-light text-ares-muted">{context}</p>
    </div>
  );
}

/* ---------------------------------- page ------------------------------------ */

export default function SampleReport() {
  const rootRef = useRef<HTMLDivElement>(null);
  const coverH1Ref = useRef<HTMLHeadingElement>(null);
  const engineBars = useInViewOnce<HTMLDivElement>(0.3);
  const categoryBars = useInViewOnce<HTMLDivElement>(0.3);
  const citationBars = useInViewOnce<HTMLDivElement>(0.3);
  const heatmap = useInViewOnce<HTMLDivElement>(0.2);
  useLenis();

  /* Cover entrance: word-split H1, meta grid fade-up, hairlines draw. */
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const split = new SplitText(coverH1Ref.current, { type: 'words' });
      gsap.fromTo(
        split.words,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: EASE, stagger: 0.08, delay: 0.15 }
      );
      gsap.fromTo(
        '[data-cover-fade]',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: EASE, stagger: 0.1, delay: 0.3 }
      );
      gsap.fromTo(
        '[data-cover-meta]',
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: EASE, stagger: 0.06, delay: 0.6 }
      );
      gsap.fromTo(
        '[data-cover-rule]',
        { scaleX: 0 },
        { scaleX: 1, duration: 0.7, ease: EASE, stagger: 0.1, delay: 0.5 }
      );
      return () => split.revert();
    },
    { scope: rootRef }
  );

  /* Scroll-driven staggers across the report body. */
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const st = (trigger: gsap.DOMTarget) => ({ trigger, start: 'top 85%', once: true }) as const;

      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.6, ease: EASE, scrollTrigger: st(el) }
        );
      });

      // TOC rows: slide-right 12px, 40ms stagger
      const tocRows = gsap.utils.toArray<HTMLElement>('[data-toc-row]');
      if (tocRows.length) {
        gsap.fromTo(
          tocRows,
          { opacity: 0, x: -12 },
          { opacity: 1, x: 0, duration: 0.5, ease: EASE, stagger: 0.04, scrollTrigger: st('[data-toc-list]') }
        );
      }

      // §01 KPI tiles rise 20px
      const kpis = gsap.utils.toArray<HTMLElement>('[data-kpi-grid] > *');
      if (kpis.length) {
        gsap.fromTo(
          kpis,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.6, ease: EASE, stagger: 0.08, scrollTrigger: st('[data-kpi-grid]') }
        );
      }

      // §02/§03 table rows 40ms stagger
      gsap.utils.toArray<HTMLElement>('[data-stagger-rows]').forEach((tbody) => {
        gsap.fromTo(
          Array.from(tbody.children),
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, ease: EASE, stagger: 0.04, scrollTrigger: st(tbody) }
        );
      });

      // Composite row + Northwind row: one-time tint pulse
      gsap.utils.toArray<HTMLElement>('[data-pulse-tint]').forEach((el) => {
        gsap.fromTo(
          el,
          { backgroundColor: 'rgba(50,137,174,0.16)' },
          { backgroundColor: 'rgba(50,137,174,0.05)', duration: 1.2, ease: 'power2.out', scrollTrigger: st(el) }
        );
      });

      // §05 "Missing" cells: one-time soft pulse
      gsap.utils.toArray<HTMLElement>('[data-pulse-missing]').forEach((el) => {
        gsap.fromTo(
          el,
          { backgroundColor: 'rgba(50,137,174,0.12)' },
          { backgroundColor: 'rgba(50,137,174,0)', duration: 1.2, ease: 'power2.out', scrollTrigger: st(el) }
        );
      });

      // §06 alert rows: slide in from left 24px, 100ms stagger
      const alerts = gsap.utils.toArray<HTMLElement>('[data-alert-row]');
      if (alerts.length) {
        gsap.fromTo(
          alerts,
          { opacity: 0, x: -24 },
          { opacity: 1, x: 0, duration: 0.6, ease: EASE, stagger: 0.1, scrollTrigger: st('[data-alert-list]') }
        );
      }

      // §07 roadmap cards: 60ms stagger grid reveal
      const cards = gsap.utils.toArray<HTMLElement>('[data-roadmap-card]');
      if (cards.length) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.6, ease: EASE, stagger: 0.06, scrollTrigger: st('[data-roadmap-grid]') }
        );
      }

      // §08 phase cards 120ms stagger; checklist items cascade 50ms per card
      gsap.utils.toArray<HTMLElement>('[data-phase-card]').forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.6, ease: EASE, delay: i * 0.12, scrollTrigger: st('[data-phase-list]') }
        );
        gsap.fromTo(
          Array.from(card.querySelectorAll('[data-phase-item]')),
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4, ease: EASE, stagger: 0.05, delay: 0.2 + i * 0.12, scrollTrigger: st('[data-phase-list]') }
        );
      });
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef}>
      <style>{PRINT_CSS}</style>

      {/* S1 — Report toolbar (sticky, screen only) */}
      <div
        data-report-toolbar
        className="sticky top-16 z-40 border-b border-white/[0.08] bg-[rgba(7,22,29,0.96)] backdrop-blur-[8px]"
      >
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Icon icon={icons.documentText} width={16} height={16} className="text-ares-primary" />
            <span className="text-[12px] font-light text-white/85">Sample AI Visibility Report</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-primary !px-4 !py-2 text-[11px]"
            >
              <Icon icon={icons.downloadMinimalistic} width={14} height={14} />
              Download PDF
            </button>
            <Link
              to={`${LOGIN_PATH}?intent=report`}
              className="hidden text-[11px] font-light uppercase tracking-[0.04em] text-white/70 transition-colors duration-200 hover:text-ares-primary sm:inline"
            >
              Request your report
            </Link>
          </div>
        </div>
      </div>

      {/* Report stack */}
      <div className="report-stack mx-auto max-w-[868px] space-y-6 px-6 py-16">
        {/* S2 — Cover page */}
        <Sheet className="flex flex-col justify-between bg-ares-tertiary !p-8 sm:!px-14 sm:!py-[72px] lg:min-h-[920px]">
          <div className="flex items-center justify-between" data-cover-fade>
            <div className="flex items-center gap-2.5">
              <RadarMark size={22} />
              <span className="text-[13px] font-light text-white/90">AI Visibility Intelligence</span>
            </div>
            <span className="font-label text-white/50">Confidential · Sample</span>
          </div>

          <div className="py-16">
            <p className="font-label text-ares-primary" data-cover-fade>
              AI Visibility Intelligence Report
            </p>
            <h1
              ref={coverH1Ref}
              className="font-display mt-6 text-white"
              style={{ fontSize: 'clamp(36px, 6vw, 52px)', lineHeight: 1.0 }}
            >
              How AI sees your business.
            </h1>
            <p className="mt-6 max-w-[480px] text-[14px] font-light leading-[22px] text-white/70" data-cover-fade>
              A sample executive report showing how a business appears across AI search engines and
              large language models — visibility scores, competitor benchmarks, citation gaps, and a
              30/60/90-day action plan.
            </p>
          </div>

          <div>
            <div data-cover-rule className="h-px w-full origin-left bg-white/[0.18]" />
            <div className="grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
              {[
                { label: 'Prepared For', value: 'Northwind Advisory' },
                { label: 'Industry', value: 'Professional Services' },
                { label: 'Report Date', value: 'July 2026' },
                { label: 'Report ID', value: 'AVI-2026-07-NS04' },
              ].map((m) => (
                <div key={m.label} data-cover-meta>
                  <p className="font-label text-white/50">{m.label}</p>
                  <p className="mt-2 text-[13px] font-light text-white/90">{m.value}</p>
                </div>
              ))}
            </div>
            <div data-cover-rule className="h-px w-full origin-left bg-white/[0.18]" />
            <p className="mt-6 text-[10px] font-light text-white/40" data-cover-fade>
              This sample report uses illustrative data. AI Visibility Intelligence for the next era
              of search.
            </p>
          </div>
        </Sheet>

        {/* S3 — Table of contents */}
        <Sheet id="contents">
          <p className="font-label flex items-center gap-2 text-ares-primary">
            <Icon icon={icons.list} width={15} height={15} />
            Contents
          </p>
          <h2 className="font-display mt-4 text-[clamp(24px,4vw,32px)]">Report contents.</h2>
          <div className="section-rule mt-5" />
          <nav className="mt-6" data-toc-list>
            {TOC.map((row) => (
              <a
                key={row.num}
                href={row.href}
                data-toc-row
                className="group flex items-baseline gap-3 border-b border-ares-border2 py-3 last:border-b-0"
              >
                <span className="font-label text-[10px] text-ares-primary">{row.num}</span>
                <span className="text-[13px] font-light text-ares-secondarytext transition-colors duration-200 group-hover:text-ares-primary">
                  {row.title}
                </span>
                <span className="mx-2 flex-1 border-b border-dotted border-ares-border transition-colors duration-200 group-hover:border-ares-primary/50" />
                <span className="text-[11px] font-light text-ares-muted">{row.page}</span>
              </a>
            ))}
          </nav>
          <p className="font-label mt-10 text-ares-muted">Engines monitored</p>
          <div className="mt-4 flex flex-wrap gap-2" data-reveal>
            {ENGINE_NAMES.map((name) => (
              <span key={name} className="badge-pill !px-3 !py-1.5 text-[10px] text-ares-secondarytext">
                {name}
              </span>
            ))}
          </div>
        </Sheet>

        {/* S4 — §01 Executive summary */}
        <Sheet id="section-01">
          <PageHeader num="01" label="Executive Summary" page="03" title="Executive summary." />
          <p className="mt-6 text-[13px] font-light leading-[22px] text-ares-secondarytext">
            Northwind Advisory currently appears in{' '}
            <span className="font-normal text-ares-primary">48%</span> of monitored AI-generated
            responses across priority buyer questions. The brand leads in two prompt categories but
            is absent from high-intent comparison prompts where two competitors are consistently
            recommended. Visibility is strongest on ChatGPT and weakest on Google AI Overviews.
            Three citation gaps and two misrepresentation alerts were identified. This report
            outlines the findings and a 30/60/90-day plan to improve AI visibility.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3" data-kpi-grid>
            <KpiTile label="AI Visibility Score" value={72} suffix="%" context="+6 vs. last scan" />
            <KpiTile label="Brand Mention Rate" value={48} suffix="%" context="of monitored prompts" />
            <KpiTile label="Competitor Lead Gap" value={23} suffix="%" context="behind leader" />
            <KpiTile label="Citation Strength" textValue="Medium" context="3 gaps found" />
            <KpiTile label="Prompt Coverage" value={61} suffix="%" context="of priority prompts" />
            <KpiTile label="Recommendation Share" value={34} suffix="%" context='of "best option" lists' />
          </div>
          <p className="font-label mt-10 text-ares-primary">Key findings</p>
          <ul className="mt-4 space-y-2.5" data-reveal>
            {[
              'Northwind is recommended in 34% of "best option" prompts — up from 28%.',
              'Two competitors appear in 71% of comparison prompts where Northwind is absent.',
              'Google AI Overviews under-represents the brand; ChatGPT is the strongest channel.',
              'Three citation sources are missing from authoritative directories AI relies on.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
                <Icon icon={icons.arrowRight} width={14} height={14} className="mt-0.5 shrink-0 text-ares-primary" />
                {item}
              </li>
            ))}
          </ul>
        </Sheet>

        {/* S5 — §02 AI visibility score */}
        <Sheet id="section-02">
          <PageHeader num="02" label="AI Visibility Score" page="04" title="AI visibility score." />
          <p className="mt-6 text-[13px] font-light leading-[22px] text-ares-secondarytext">
            The AI Visibility Score combines mention rate, recommendation share, citation strength,
            and prompt coverage into a single index. Northwind scores{' '}
            <span className="font-normal text-ares-primary">72</span>, placing it second among four
            monitored competitors.
          </p>
          <p className="font-label mt-10 text-ares-primary">Score by engine</p>
          <div ref={engineBars.ref} className="mt-5 space-y-3">
            {ENGINE_SCORES.map((e, i) => (
              <BarRow key={e.name} label={e.name} value={e.value} active={engineBars.inView} delay={i * 80} />
            ))}
          </div>
          <div className="section-rule mt-10" />
          <p className="font-label mt-10 text-ares-primary">Score components</p>
          <div className="mt-5 overflow-x-auto rounded-ares border border-ares-border bg-ares-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Weight</th>
                  <th>Score</th>
                  <th>Contribution</th>
                </tr>
              </thead>
              <tbody data-stagger-rows>
                {SCORE_COMPONENTS.map((row) => (
                  <tr key={row.component}>
                    <td className="text-ares-secondarytext">{row.component}</td>
                    <td className="text-ares-secondarytext">{row.weight}</td>
                    <td className="text-ares-primary">{row.score}</td>
                    <td className="text-ares-secondarytext">{row.contribution}</td>
                  </tr>
                ))}
                <tr data-pulse-tint>
                  <td className="font-normal text-ares-text">Composite</td>
                  <td className="text-ares-secondarytext">100%</td>
                  <td className="text-ares-muted">—</td>
                  <td className="font-normal text-ares-primary">52.3 → 72 (indexed)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Sheet>

        {/* S6 — §03 Competitive visibility comparison */}
        <Sheet id="section-03">
          <PageHeader num="03" label="Competitive Visibility Comparison" page="05" title="Competitive visibility comparison." />
          <p className="mt-6 text-[13px] font-light leading-[22px] text-ares-secondarytext">
            Northwind ranks second of four monitored competitors. The leader, Atlas Capital, appears
            in 88% of priority prompts and is recommended in 61% of "best option" lists.
            Northwind's gap is concentrated in comparison and recommendation prompts.
          </p>
          <p className="font-label mt-10 text-ares-primary">Competitor leaderboard</p>
          <div className="mt-5 overflow-x-auto rounded-ares border border-ares-border bg-ares-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Brand</th>
                  <th>Visibility Score</th>
                  <th>Mention Rate</th>
                  <th>Rec. Share</th>
                </tr>
              </thead>
              <tbody data-stagger-rows>
                {LEADERBOARD.map((row) => (
                  <tr key={row.rank} {...(row.tenant ? { 'data-pulse-tint': true } : {})}>
                    <td className="font-label text-ares-primary">{row.rank}</td>
                    <td className={cn(row.tenant ? 'font-normal text-ares-primary' : 'text-ares-secondarytext')}>
                      {row.brand}
                    </td>
                    <td className="text-ares-primary">{row.score}</td>
                    <td className="text-ares-secondarytext">{row.mention}</td>
                    <td className="text-ares-secondarytext">{row.rec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="section-rule mt-10" />
          <p className="font-label mt-10 text-ares-primary">Mention rate by prompt category</p>
          <div ref={categoryBars.ref} className="mt-5 space-y-3">
            {CATEGORY_BARS.map((b, i) => (
              <BarRow key={b.name} label={b.name} value={b.value} suffix="%" active={categoryBars.inView} delay={i * 80} />
            ))}
          </div>
        </Sheet>

        {/* S7 — §04 Prompt-level findings */}
        <Sheet id="section-04">
          <PageHeader num="04" label="Prompt-Level Findings" page="06" title="Prompt-level findings." />
          <p className="mt-6 text-[13px] font-light leading-[22px] text-ares-secondarytext">
            Twelve priority prompts were tested across six AI engines. Northwind appears in 61% of
            prompts but is recommended in only 34%. The heatmap below shows visibility intensity by
            prompt and engine.
          </p>
          <p className="font-label mt-10 text-ares-primary">Visibility heatmap</p>
          <div ref={heatmap.ref} className="mt-5 overflow-x-auto rounded-ares border border-ares-border bg-ares-card p-4">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="pb-3 pr-3 text-left text-[10px] font-normal uppercase tracking-[0.08em] text-ares-muted">
                    Prompt
                  </th>
                  {ENGINE_NAMES.map((name) => (
                    <th key={name} className="pb-3 text-center text-[10px] font-normal uppercase tracking-[0.08em] text-ares-muted">
                      {name.replace('Google AI Overviews', 'AI Overviews')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HEATMAP.map((row, r) => (
                  <tr key={row.prompt}>
                    <td className="py-1.5 pr-3 text-[11px] font-light text-ares-secondarytext">{row.prompt}</td>
                    {row.cells.map((a, c) => {
                      const idx = r * 6 + c;
                      return (
                        <td key={c} className="p-1">
                          <div
                            className="group relative h-7 rounded-ares transition-all duration-500"
                            style={{
                              backgroundColor: `rgba(50,137,174,${heatmap.inView ? a : 0.05})`,
                              opacity: heatmap.inView ? 1 : 0.4,
                              transform: heatmap.inView ? 'scale(1)' : 'scale(0.9)',
                              transitionDelay: `${idx * 30}ms`,
                            }}
                          >
                            <div className="pointer-events-none absolute -top-12 left-1/2 z-10 w-56 -translate-x-1/2 rounded-ares border border-ares-border bg-ares-tertiary px-3 py-2 text-left text-[10px] font-light leading-[14px] text-white/80 opacity-0 shadow-paper transition-opacity duration-200 group-hover:opacity-100">
                              Intensity {Math.round(a * 100)}% · In the platform, every cell opens the raw AI response.
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex items-center gap-2 text-[9px] uppercase tracking-[0.08em] text-ares-muted">
              <span>Low</span>
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((a) => (
                <span key={a} className="h-3 w-6 rounded-ares" style={{ backgroundColor: `rgba(50,137,174,${a})` }} />
              ))}
              <span>High</span>
            </div>
          </div>
          <p className="mt-4 text-[10px] font-light leading-[16px] text-ares-muted">
            Northwind is strongest in local "near me" and service-category prompts, and weakest in
            comparison and decision-stage prompts where competitors are consistently recommended.
          </p>
        </Sheet>

        {/* S8 — §05 Citation and source gaps */}
        <Sheet id="section-05">
          <PageHeader num="05" label="Citation and Source Gaps" page="07" title="Citation and source gaps." />
          <p className="mt-6 text-[13px] font-light leading-[22px] text-ares-secondarytext">
            AI engines rely on cited sources to build responses. Northwind is referenced by 14 of 22
            monitored sources. Three high-authority sources are missing citations, reducing the
            brand's likelihood of being recommended.
          </p>
          <div className="mt-6 overflow-x-auto rounded-ares border border-ares-border bg-ares-card">
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
              <tbody data-stagger-rows>
                {CITATIONS.map((row) => (
                  <tr key={row.source}>
                    <td className="text-ares-secondarytext">{row.source}</td>
                    <td className="text-ares-secondarytext">{row.type}</td>
                    <td className="text-ares-secondarytext">{row.authority}</td>
                    <td
                      className={cn(row.status === 'Missing' && 'font-normal text-ares-primary')}
                      {...(row.status === 'Missing' ? { 'data-pulse-missing': true } : {})}
                    >
                      {row.status}
                    </td>
                    <td className="text-ares-secondarytext">{row.impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="section-rule mt-10" />
          <p className="font-label mt-10 text-ares-primary">Citation strength by source type</p>
          <div ref={citationBars.ref} className="mt-5 space-y-3">
            {CITATION_STRENGTH.map((b, i) => (
              <BarRow key={b.name} label={b.name} value={b.value} active={citationBars.inView} delay={i * 80} />
            ))}
          </div>
        </Sheet>

        {/* S9 — §06 Misrepresentation alerts */}
        <Sheet id="section-06">
          <PageHeader num="06" label="Misrepresentation Alerts" page="08" title="Misrepresentation alerts." />
          <p className="mt-6 text-[13px] font-light leading-[22px] text-ares-secondarytext">
            Two misrepresentation alerts were detected. AI engines occasionally describe Northwind
            with outdated service areas and an incorrect founding year. These inaccuracies reduce
            trust signals and can mislead buyers.
          </p>
          <div className="mt-8 space-y-3" data-alert-list>
            {ALERTS.map((alert) => (
              <div
                key={alert.label}
                data-alert-row
                className={cn(
                  'rounded-ares border border-ares-border bg-ares-card p-4 shadow-paper border-l-[3px]',
                  alert.severity === 'high' && 'border-l-ares-primary',
                  alert.severity === 'medium' && 'border-l-ares-severityMedium',
                  alert.severity === 'low' && 'border-l-ares-muted'
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    icon={alert.icon}
                    width={18}
                    height={18}
                    className={cn(
                      'mt-0.5 shrink-0',
                      alert.severity === 'high' && 'text-ares-primary',
                      alert.severity === 'medium' && 'text-ares-severityMedium',
                      alert.severity === 'low' && 'text-ares-muted'
                    )}
                  />
                  <div>
                    <p className="font-label text-ares-tertiary">{alert.label}</p>
                    <p className="mt-2 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
                      {alert.body}
                    </p>
                    <p className="mt-2 text-[10px] font-light text-ares-muted">{alert.meta}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] font-light leading-[16px] text-ares-muted">
            Resolving alerts 01 and 02 is estimated to improve the sentiment accuracy component by
            8–12 points.
          </p>
        </Sheet>

        {/* S10 — §07 Optimization roadmap */}
        <Sheet id="section-07">
          <PageHeader num="07" label="Optimization Roadmap" page="09" title="Optimization roadmap." />
          <p className="mt-6 text-[13px] font-light leading-[22px] text-ares-secondarytext">
            Findings translate into eight roadmap categories. Each is prioritized by expected
            visibility impact and effort.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2" data-roadmap-grid>
            {ROADMAP.map((card) => (
              <div key={card.num} data-roadmap-card className="action-card !p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-label text-ares-primary">Priority {card.num}</p>
                  <span className="badge-pill text-ares-muted">{card.impact} Impact</span>
                </div>
                <p className="font-display mt-4 text-[16px] normal-case tracking-normal text-ares-tertiary">
                  {card.title}
                </p>
                <p className="mt-2 text-[11px] font-light leading-[17px] text-ares-secondarytext">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </Sheet>

        {/* S11 — §08 30/60/90-day action plan */}
        <Sheet id="section-08">
          <PageHeader num="08" label="30/60/90-Day Action Plan" page="10" title="30/60/90-day action plan." />
          <p className="mt-6 text-[13px] font-light leading-[22px] text-ares-secondarytext">
            A phased plan to close the visibility gap. Day 1–30 stabilizes accuracy and citations;
            Day 31–60 builds content and schema; Day 61–90 expands authority and competitive
            positioning.
          </p>
          <div className="mt-8 space-y-4" data-phase-list>
            {PHASES.map((phase) => (
              <div key={phase.num} data-phase-card className="action-card !p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display-num text-[24px]">{phase.num}</span>
                  <span className="font-label text-ares-tertiary">{phase.label}</span>
                  <span className="badge-pill ml-auto text-ares-muted">{phase.theme}</span>
                </div>
                <div className="section-rule mt-4" />
                <ul className="mt-4 space-y-2.5">
                  {phase.items.map((item) => (
                    <li
                      key={item}
                      data-phase-item
                      className="flex items-start gap-2.5 text-[12px] font-light leading-[19.5px] text-ares-secondarytext"
                    >
                      <Icon icon={icons.checkCircle} width={14} height={14} className="mt-0.5 shrink-0 text-ares-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Closing CTA block */}
          <div className="mt-8 rounded-ares bg-ares-tertiary p-6">
            <p className="font-label text-ares-primary">Next step</p>
            <p className="font-display mt-3 text-[22px] text-white">Turn this report into action.</p>
            <p className="mt-3 max-w-md text-[12px] font-light leading-[19.5px] text-white/70">
              Request your own AI Visibility Report — your business, your competitors, your plan.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={`${LOGIN_PATH}?intent=report`} className="btn-primary">
                Request your AI Visibility Report
              </Link>
              <Link to="/" className="btn-secondary-dark">
                Back to overview
              </Link>
            </div>
          </div>

          {/* Report footer row */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ares-border pt-6">
            <div className="flex items-center gap-2.5">
              <RadarMark size={18} />
              <span className="text-[10px] font-light text-ares-muted">
                AI Visibility Intelligence for the next era of search.
              </span>
            </div>
            <span className="text-[10px] font-light text-ares-muted">
              © 2026 · Sample Report · Page 10 of 10
            </span>
          </div>
        </Sheet>
      </div>
    </div>
  );
}
