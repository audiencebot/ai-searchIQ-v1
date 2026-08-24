// Platform — /platform (design: platform.md)
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
  DarkCtaPanel,
  EASE,
  ENGINES,
  EngineGlyph,
  SectionHeader,
  SplitWords,
  prefersReducedMotion,
  useInViewOnce,
  useLenis,
  useStandardReveals,
} from '@/components/marketing/shared';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/* ------------------------------ S2 pipeline data ---------------------------- */

const PIPELINE = [
  {
    num: '01',
    title: 'Prompt set',
    body: '12 priority buyer prompts across 5 categories, grounded in your real GSC query demand.',
  },
  {
    num: '02',
    title: 'Daily execution',
    body: "Each prompt runs through all six engines' real user interfaces — what a buyer actually sees.",
  },
  {
    num: '03',
    title: 'Extraction',
    body: 'Brand mentions, mention order, recommendations, and every cited URL, captured and versioned.',
  },
  {
    num: '04',
    title: 'Scoring',
    body: 'Weighted composite: mention rate 30%, recommendation share 25%, citation strength 20%, prompt coverage 15%, sentiment accuracy 10%.',
  },
  {
    num: '05',
    title: 'Action',
    body: 'Findings generate alerts, roadmap cards, and your 30/60/90-day plan automatically.',
  },
];

/* ------------------------------ S3 module mocks ----------------------------- */

const ENGINE_SCORES = [
  { name: 'ChatGPT', value: 78 },
  { name: 'Gemini', value: 64 },
  { name: 'Claude', value: 52 },
  { name: 'Perplexity', value: 41 },
  { name: 'AI Overviews', value: 33 },
  { name: 'AI Search', value: 58 },
];

function MockDashboard({ active }: { active: boolean }) {
  const tiles = [
    { label: 'Visibility Score', value: '72', ctx: '+6 vs. last scan' },
    { label: 'Mention Rate', value: '48%', ctx: 'of monitored prompts' },
    { label: 'Rec. Share', value: '34%', ctx: 'of "best option" lists' },
    { label: 'Coverage', value: '61%', ctx: 'of priority prompts' },
    { label: 'Citation Strength', value: 'Med', ctx: '3 gaps found' },
    { label: 'Lead Gap', value: '23%', ctx: 'behind leader' },
  ];
  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className="rounded-ares border border-ares-border2 bg-ares-surface p-3 transition-all duration-500"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(12px)',
              transitionDelay: `${i * 60}ms`,
            }}
          >
            <p className="text-[9px] uppercase tracking-[0.08em] text-ares-muted">{t.label}</p>
            <p className="font-display-num mt-1 text-[22px]">{t.value}</p>
            <p className="mt-0.5 text-[9px] font-light text-ares-muted">{t.ctx}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2.5">
        {ENGINE_SCORES.map((e, i) => (
          <div key={e.name} className="flex items-center gap-3">
            <span className="w-[92px] shrink-0 text-[9px] uppercase tracking-[0.08em] text-ares-muted">
              {e.name}
            </span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: active ? `${e.value}%` : '0%', transitionDelay: `${i * 80}ms` }}
              />
            </div>
            <span className="w-6 text-right text-[10px] font-normal text-ares-primary">{e.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOCK_HEATMAP = [
  [0.85, 0.65, 0.4, 0.3, 0.2, 0.7],
  [0.7, 0.5, 0.35, 0.25, 0.15, 0.55],
  [0.4, 0.3, 0.2, 0.15, 0.1, 0.3],
  [0.75, 0.6, 0.45, 0.35, 0.25, 0.6],
  [0.35, 0.25, 0.2, 0.1, 0.08, 0.25],
];

function MockMonitoring({ active }: { active: boolean }) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-6 gap-1.5">
        {MOCK_HEATMAP.flatMap((row, r) =>
          row.map((a, c) => {
            const i = r * 6 + c;
            return (
              <div
                key={i}
                className="h-7 rounded-ares transition-all duration-500"
                style={{
                  backgroundColor: `rgba(50,137,174,${active ? a : 0.05})`,
                  opacity: active ? 1 : 0.4,
                  transform: active ? 'scale(1)' : 'scale(0.9)',
                  transitionDelay: `${i * 30}ms`,
                }}
              />
            );
          })
        )}
      </div>
      <div className="mt-4 flex items-center gap-2 text-[9px] uppercase tracking-[0.08em] text-ares-muted">
        <span>Low</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((a) => (
          <span
            key={a}
            className="h-3 w-6 rounded-ares"
            style={{ backgroundColor: `rgba(50,137,174,${a})` }}
          />
        ))}
        <span>High</span>
      </div>
    </div>
  );
}

const MINI_LEADERBOARD = [
  { rank: '01', name: 'Atlas Capital', score: 88 },
  { rank: '02', name: 'Northwind Advisory', score: 72, tenant: true },
  { rank: '03', name: 'Beacon Partners', score: 65 },
  { rank: '04', name: 'Cedarwood Group', score: 49 },
];

function MockCompetitive({ active }: { active: boolean }) {
  return (
    <div className="w-full">
      {MINI_LEADERBOARD.map((row, i) => (
        <div
          key={row.rank}
          className="flex items-center gap-3 border-b border-ares-border px-2 py-2.5 transition-all duration-500 last:border-b-0"
          style={{
            backgroundColor: row.tenant ? 'rgba(50,137,174,0.05)' : undefined,
            opacity: active ? 1 : 0,
            transform: active ? 'translateY(0)' : 'translateY(10px)',
            transitionDelay: `${i * 60}ms`,
          }}
        >
          <span className="font-label text-ares-primary">{row.rank}</span>
          <span
            className={cn(
              'flex-1 text-[11px]',
              row.tenant ? 'font-normal text-ares-primary' : 'font-light text-ares-secondarytext'
            )}
          >
            {row.name}
          </span>
          <span className="font-display-num text-[16px]">{row.score}</span>
        </div>
      ))}
    </div>
  );
}

function MockAlert({ active }: { active: boolean }) {
  return (
    <div
      className="action-card w-full border-l-[3px] !border-l-ares-primary !p-4 transition-all duration-500"
      style={{
        opacity: active ? 1 : 0,
        transform: active ? 'translateX(0)' : 'translateX(-16px)',
      }}
    >
      <div className="flex items-start gap-3">
        <Icon
          icon={icons.dangerTriangle}
          width={18}
          height={18}
          className="mt-0.5 shrink-0 text-ares-primary"
        />
        <div>
          <p className="text-[12px] font-normal text-ares-text">Outdated service area</p>
          <p className="mt-1 text-[11px] font-light leading-[17px] text-ares-secondarytext">
            ChatGPT and Gemini describe two regions. The brand now serves four.
          </p>
          <p className="mt-1.5 text-[10px] font-light text-ares-muted">
            Engines affected: ChatGPT, Gemini · Severity: High
          </p>
        </div>
      </div>
    </div>
  );
}

function MockActionPlan({ active }: { active: boolean }) {
  const phases = [
    { num: '30', label: 'Stabilize' },
    { num: '60', label: 'Build' },
    { num: '90', label: 'Expand' },
  ];
  return (
    <div className="grid w-full grid-cols-3 gap-3">
      {phases.map((p, i) => (
        <div
          key={p.num}
          className="rounded-ares border border-ares-border2 bg-ares-surface p-4 text-center transition-all duration-500"
          style={{
            opacity: active ? 1 : 0,
            transform: active ? 'translateY(0)' : 'translateY(14px)',
            transitionDelay: `${i * 100}ms`,
          }}
        >
          <p className="font-display-num text-[26px]">{p.num}</p>
          <p className="font-label mt-1 text-ares-muted">{p.label}</p>
        </div>
      ))}
    </div>
  );
}

function MockCopilot({ active }: { active: boolean }) {
  return (
    <div className="w-full space-y-3">
      <div
        className="ml-auto w-fit max-w-[85%] rounded-ares border border-ares-border bg-ares-secondary px-4 py-3 transition-all duration-500"
        style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(10px)',
        }}
      >
        <p className="text-[12px] font-light text-ares-secondarytext">Why did my score drop?</p>
      </div>
      <div
        className="w-fit max-w-[92%] rounded-ares border border-ares-border bg-ares-surface px-4 py-3 transition-all duration-500"
        style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(10px)',
          transitionDelay: '200ms',
        }}
      >
        <p className="text-[12px] font-light leading-[19px] text-ares-secondarytext">
          Sentiment accuracy fell 6 points after ChatGPT began citing an outdated service area in
          comparison prompts.
        </p>
        <span className="badge-pill mt-2.5 text-ares-primary">Score components · Jul scan</span>
      </div>
    </div>
  );
}

const BOT_SIGNALS = [
  { label: 'Training crawl', agent: 'GPTBot · ClaudeBot · PerplexityBot', value: 84, count: '1,204 hits' },
  { label: 'Citation fetch', agent: 'ChatGPT-User · Claude-User · Perplexity-User', value: 52, count: '312 fetches' },
  { label: 'Referral visit', agent: 'chatgpt.com · perplexity.ai · gemini.google.com', value: 38, count: '221 visits' },
];

function MockChannelAnalytics({ active }: { active: boolean }) {
  return (
    <div className="w-full space-y-4">
      {BOT_SIGNALS.map((row, i) => (
        <div
          key={row.label}
          className="transition-all duration-500"
          style={{
            opacity: active ? 1 : 0,
            transform: active ? 'translateY(0)' : 'translateY(12px)',
            transitionDelay: `${i * 100}ms`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-normal uppercase tracking-[0.08em] text-ares-tertiary">
              {row.label}
            </span>
            <span className="text-[10px] font-normal text-ares-primary">{row.count}</span>
          </div>
          <p className="mt-0.5 text-[9px] font-light text-ares-muted">{row.agent}</p>
          <div className="bar-track mt-1.5">
            <div
              className="bar-fill"
              style={{ width: active ? `${row.value}%` : '0%', transitionDelay: `${i * 80}ms` }}
            />
          </div>
        </div>
      ))}
      <div
        className="flex items-center justify-between rounded-ares border border-ares-border2 bg-ares-secondary px-3 py-2.5 transition-all duration-500"
        style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(12px)',
          transitionDelay: '350ms',
        }}
      >
        <span className="text-[10px] font-light text-ares-secondarytext">
          AI-referred revenue this month
        </span>
        <span className="font-display-num text-[16px]">$18,400</span>
      </div>
    </div>
  );
}

/* ------------------------------- module rows -------------------------------- */

const MODULES = [
  {
    id: 'dashboard',
    eyebrow: 'Module 01 · AI Visibility Dashboard',
    title: 'One score. Six numbers. No black boxes.',
    body: 'A single 0–100 composite tells you where you stand; the tiles beneath it tell you why. Every number is traceable to the scan that produced it.',
    bullets: [
      'Composite 0–100 with published weights',
      'Delta vs. last scan on every tile',
      'Click any number to the evidence',
    ],
    Mock: MockDashboard,
  },
  {
    id: 'monitoring',
    eyebrow: 'Module 02 · Prompt Monitoring',
    title: 'Every buyer question, every engine, every day.',
    body: 'Your priority prompts run daily across all six engines. The heatmap shows intensity at a glance; the raw response is always one click away.',
    bullets: [
      'Prompt × engine heatmap with intensity',
      'Five buyer-journey categories',
      'Raw responses behind every cell',
    ],
    Mock: MockMonitoring,
  },
  {
    id: 'competitive',
    eyebrow: 'Module 03 · Competitive Intelligence',
    title: "Know exactly who's winning — and why.",
    body: 'Your competitors are measured with the identical methodology, on the same prompts, on the same day. No apples-to-oranges benchmarks.',
    bullets: [
      'Leaderboard on identical methodology',
      'Per-competitor prompt gaps',
      'DataForSEO SERP/keyword/backlink research',
    ],
    Mock: MockCompetitive,
  },
  {
    id: 'alerts',
    eyebrow: 'Module 04 · Misrepresentation Alerts',
    title: 'When AI gets you wrong, you know first.',
    body: 'Extracted facts are checked against your ground truth. Wrong service areas, wrong founding years, missing pricing — flagged with severity and evidence.',
    bullets: [
      'Fact extraction vs. your ground truth',
      'Severity tiers with response evidence',
      'Verified resolution tracking',
    ],
    Mock: MockAlert,
  },
  {
    id: 'action-plan',
    eyebrow: 'Module 05 · Action Plans',
    title: 'Findings become a sequenced plan.',
    body: 'Every finding lands on an impact × effort roadmap and rolls into a 30/60/90-day sequence — Stabilize, Build, Expand.',
    bullets: [
      'Impact × effort roadmap cards',
      'Auto-generated 30/60/90 plan',
      'Day-90 re-benchmark closes the loop',
    ],
    Mock: MockActionPlan,
  },
  {
    id: 'copilot',
    eyebrow: 'Module 06 · Ask AI Search IQ',
    title: 'Ask your data anything.',
    body: 'Interpretation, diagnosis, comparison, and action questions — answered from your scan records, never invented.',
    bullets: [
      'Interpretation, diagnosis, comparison, action answers',
      'Every claim cited to a scan record',
      'Hard tenant scoping, honest "not enough data"',
    ],
    Mock: MockCopilot,
  },
  {
    id: 'channel-analytics',
    eyebrow: 'Module 07 · AI Channel Analytics',
    title: 'Measured, not estimated — proof from your own server.',
    body: 'Prompt monitoring shows how AI talks about you; server-side analytics show what AI actually does on your site. Every training crawl, every live citation fetch while a real customer gets an answer, every visit referred from an AI response — captured first-party, no sampling.',
    bullets: [
      'Server-side capture via log drains (Vercel / Netlify / Cloudflare) or log upload',
      'Three-signal bot classification: training / citation-fetch / referral',
      'Ghost-page and JS-rendering-gap detection',
      'AI-referrer revenue attribution',
    ],
    Mock: MockChannelAnalytics,
  },
];

function ModuleRow({
  mod,
  index,
}: {
  mod: (typeof MODULES)[number];
  index: number;
}) {
  const reverse = index % 2 === 1;
  const rowRef = useRef<HTMLDivElement>(null);
  const { ref: mockRef, inView } = useInViewOnce<HTMLDivElement>(0.2);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const row = rowRef.current;
      if (!row) return;
      const copy = row.querySelector('[data-row-copy]');
      const mock = row.querySelector('[data-row-mock]');
      const line = row.querySelector('[data-row-scanline]');
      const st = { trigger: row, start: 'top 85%', once: true } as const;
      gsap.fromTo(
        copy,
        { opacity: 0, x: reverse ? 32 : -32 },
        { opacity: 1, x: 0, duration: 0.6, ease: EASE, scrollTrigger: st }
      );
      gsap.fromTo(
        mock,
        { opacity: 0, x: reverse ? -32 : 32 },
        { opacity: 1, x: 0, duration: 0.6, ease: EASE, scrollTrigger: st }
      );
      gsap.fromTo(
        line,
        { scaleX: 0 },
        { scaleX: 1, duration: 0.7, ease: EASE, scrollTrigger: st }
      );
    },
    { scope: rowRef }
  );

  const { Mock } = mod;
  return (
    <div ref={rowRef} id={mod.id} className="scroll-mt-24 py-16">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div data-row-copy className={cn(reverse && 'lg:order-2')}>
          <p className="font-label text-ares-primary">{mod.eyebrow}</p>
          <h3 className="font-display mt-4 text-ares-tertiary" style={{ fontSize: 'clamp(24px, 3vw, 32px)' }}>
            {mod.title}
          </h3>
          <div data-row-scanline className="mt-5 h-px w-24 origin-left bg-ares-primary" />
          <p className="mt-5 text-[13px] font-light leading-[22px] text-ares-secondarytext">
            {mod.body}
          </p>
          <ul className="mt-6 space-y-2.5">
            {mod.bullets.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-[12px] font-light text-ares-secondarytext">
                <Icon icon={icons.checkCircle} width={15} height={15} className="shrink-0 text-ares-primary" />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div data-row-mock className={cn(reverse && 'lg:order-1')}>
          <div
            ref={mockRef}
            className="rounded-ares border border-ares-border bg-ares-card p-6 shadow-paper"
          >
            <Mock active={inView} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- S4 methodology ------------------------------- */

const SCORE_COMPONENTS = [
  { component: 'Mention rate', weight: '30%', score: '48', contribution: '14.4' },
  { component: 'Recommendation share', weight: '25%', score: '34', contribution: '8.5' },
  { component: 'Citation strength', weight: '20%', score: '65', contribution: '13.0' },
  { component: 'Prompt coverage', weight: '15%', score: '61', contribution: '9.2' },
  { component: 'Sentiment accuracy', weight: '10%', score: '72', contribution: '7.2' },
];

/* ------------------------------ S5 integrations ----------------------------- */

const INTEGRATIONS = [
  { name: 'Log drains', role: 'Server-side AI traffic capture via Vercel, Netlify, or Cloudflare — or upload logs directly.' },
  { name: 'Google Business Profile', role: 'Ground truth for listings, service areas, reviews.' },
  { name: 'Google Search Console', role: 'Real query demand grounds your prompt set.' },
  { name: 'Google Analytics 4', role: 'AI-referral attribution: visibility → visits → conversions.' },
  { name: 'DataForSEO', role: 'SERP overlap, keyword gaps, backlink intelligence.' },
  { name: 'Lighthouse', role: 'Technical audits that keep recommendations publishable.' },
];

/* ---------------------------------- page ------------------------------------ */

export default function Platform() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { ref: pipeRef, inView: pipeInView } = useInViewOnce<HTMLDivElement>(0.2);
  useLenis();
  useStandardReveals(rootRef);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      // S4 methodology table rows stagger; composite row pulses its tint once
      const rows = gsap.utils.toArray<HTMLElement>('[data-method-row]');
      if (rows.length) {
        gsap.fromTo(
          rows,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: EASE,
            stagger: 0.04,
            scrollTrigger: { trigger: '[data-method-table]', start: 'top 85%', once: true },
          }
        );
      }
      const composite = rootRef.current?.querySelector('[data-composite-row]');
      if (composite) {
        gsap.fromTo(
          composite,
          { backgroundColor: 'rgba(50,137,174,0.16)' },
          {
            backgroundColor: 'rgba(50,137,174,0.05)',
            duration: 1.2,
            ease: 'power2.out',
            scrollTrigger: { trigger: composite, start: 'top 85%', once: true },
          }
        );
      }
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef}>
      {/* S1 — Page header */}
      <section className="noise-overlay relative">
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-32">
          <p className="font-label text-ares-primary" data-reveal>
            The platform
          </p>
          <SplitWords
            className="font-display mt-6 max-w-4xl"
            style={{ fontSize: 'clamp(36px, 5.5vw, 56px)' }}
          >
            From blind spot to closed loop.
          </SplitWords>
          <div data-scanline className="mt-6 h-px w-32 origin-left bg-ares-primary" />
          <p
            className="mt-6 max-w-[560px] text-[13px] font-light leading-[22px] text-ares-secondarytext"
            data-reveal
          >
            AI Search IQ runs your buyers' real questions through six AI engines every day, scores
            what it finds, flags what's wrong, and hands you a sequenced plan — then re-measures to
            prove it worked.
          </p>
        </div>
      </section>

      {/* S2 — How a scan works */}
      <section className="border-y border-ares-border bg-ares-surface">
        <div ref={pipeRef} className="mx-auto max-w-6xl px-6 py-16">
          <p className="font-label text-ares-primary">How a scan works</p>
          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0">
            {PIPELINE.map((step, i) => (
              <div key={step.num} className="flex flex-1 flex-col lg:flex-row lg:items-center">
                <div
                  className="flex-1 rounded-ares border border-ares-border bg-ares-card p-4 transition-all duration-500"
                  style={{
                    opacity: pipeInView ? 1 : 0,
                    transform: pipeInView ? 'scale(1)' : 'scale(0.96)',
                    transitionDelay: `${i * 60}ms`,
                  }}
                >
                  <p className="font-label text-ares-primary">{step.num}</p>
                  <p className="mt-2 text-[13px] font-normal text-ares-tertiary">{step.title}</p>
                  <p className="mt-1.5 text-[11px] font-light leading-[17px] text-ares-secondarytext">
                    {step.body}
                  </p>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div className="relative hidden w-8 shrink-0 items-center lg:flex" aria-hidden>
                    <div
                      className="h-px w-full origin-left border-t border-dotted border-ares-muted/60 transition-transform duration-500"
                      style={{
                        transform: pipeInView ? 'scaleX(1)' : 'scaleX(0)',
                        transitionDelay: `${150 + i * 150}ms`,
                      }}
                    />
                    <Icon
                      icon={icons.arrowRight}
                      width={13}
                      height={13}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-ares-surface text-ares-primary transition-opacity duration-300"
                      style={{ opacity: pipeInView ? 1 : 0, transitionDelay: `${250 + i * 150}ms` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* S3 — Module tour */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        {MODULES.map((mod, i) => (
          <div key={mod.id}>
            <ModuleRow mod={mod} index={i} />
            {i < MODULES.length - 1 && <div className="section-rule" />}
          </div>
        ))}
      </section>

      {/* S4 — Methodology */}
      <section id="methodology" className="scroll-mt-24 border-y border-ares-border bg-ares-surface">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <SectionHeader
            eyebrow="Methodology"
            title="A score you can defend in a board meeting."
            center
            titleSize="clamp(26px, 3.6vw, 36px)"
          />
          <div className="mt-12 overflow-x-auto rounded-ares border border-ares-border bg-ares-card" data-reveal>
            <table className="data-table" data-method-table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Weight</th>
                  <th>Score</th>
                  <th>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {SCORE_COMPONENTS.map((row) => (
                  <tr key={row.component} data-method-row>
                    <td className="text-ares-secondarytext">{row.component}</td>
                    <td className="text-ares-secondarytext">{row.weight}</td>
                    <td className="text-ares-primary">{row.score}</td>
                    <td className="text-ares-secondarytext">{row.contribution}</td>
                  </tr>
                ))}
                <tr data-method-row data-composite-row>
                  <td className="font-normal text-ares-text">Composite</td>
                  <td className="text-ares-secondarytext">100%</td>
                  <td className="text-ares-muted">—</td>
                  <td className="font-normal text-ares-primary">52.3 → 72 (indexed)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-[10px] font-light leading-[16px] text-ares-muted" data-reveal>
            Weights are fixed across tenants at a methodology version so scores stay comparable.
            Every value drills through to the prompts, engines, and responses behind it.
          </p>
        </div>
      </section>

      {/* S5 — Integrations strip */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeader eyebrow="Connected stack" title="Plugs into the tools you already run." titleSize="clamp(24px, 3vw, 32px)" />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-reveal-group>
          {INTEGRATIONS.map((intg) => (
            <div key={intg.name} className="action-card flex flex-col !p-5 hover:border-ares-primary">
              <Icon icon={icons.plugCircle} width={22} height={22} className="text-ares-primary" />
              <p className="mt-4 text-[13px] font-normal leading-[18px] text-ares-tertiary">{intg.name}</p>
              <p className="mt-1.5 flex-1 text-[11px] font-light leading-[17px] text-ares-secondarytext">
                {intg.role}
              </p>
              <span className="badge-pill mt-4 w-fit text-ares-muted">Connected at onboarding</span>
            </div>
          ))}
        </div>
      </section>

      {/* S6 — Engine coverage */}
      <section className="border-y border-ares-border bg-ares-surface py-12">
        <p className="font-label text-center text-ares-muted" data-reveal>
          Monitored daily across six AI engines
        </p>
        <div
          className="mx-auto mt-8 grid max-w-6xl grid-cols-2 gap-4 px-6 sm:grid-cols-3 lg:grid-cols-6"
          data-reveal-group
        >
          {ENGINES.map((engine) => (
            <div
              key={engine.name}
              title="Front-end prompt execution — what a real user sees"
              className="group flex cursor-default flex-col items-center gap-2 rounded-ares border border-ares-border bg-ares-secondary px-3 py-5 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-ares-primary"
            >
              <EngineGlyph kind={engine.glyph} />
              <span className="font-label text-center text-ares-tertiary/75">{engine.name}</span>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-[11px] font-light text-ares-muted" data-reveal>
          Further engines (Copilot, Grok) are operator-configured, never a per-tenant upsell.
        </p>
      </section>

      {/* S7 — CTA */}
      <div className="pt-24">
        <DarkCtaPanel
          eyebrow="Next step"
          title="See your own numbers."
          body="Request your initial AI Visibility Report. Baseline in days, plan included."
        >
          <Link to={`${LOGIN_PATH}?intent=report`} className="btn-primary">
            Request your AI Visibility Report
          </Link>
          <Link to="/sample-report" className="btn-secondary-dark">
            Explore the sample report
          </Link>
        </DarkCtaPanel>
      </div>
    </div>
  );
}
