import { useEffect, useRef, useState, memo } from 'react';
import { Link } from 'react-router';
import { LOGIN_PATH } from '@/const';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { Icon } from '@iconify/react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

const EASE = 'power3.out'; // ≈ cubic-bezier(0.22, 1, 0.36, 1)

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------------------------------- bits ---------------------------------- */

/** Number ticker: counts 0 → value on first scroll into view (900–1200ms). */
function CountUp({
  value,
  prefix = '',
  suffix = '',
  duration = 1.0,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (prefersReducedMotion()) {
        el.textContent = `${prefix}${value.toLocaleString('en-US')}${suffix}`;
        return;
      }
      const obj = { v: 0 };
      gsap.to(obj, {
        v: value,
        duration,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        onUpdate: () => {
          el.textContent = `${prefix}${Math.round(obj.v).toLocaleString('en-US')}${suffix}`;
        },
      });
    },
    { scope: ref }
  );
  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}

/** Eyebrow + display heading + terracotta scan line. */
function SectionHeader({
  eyebrow,
  eyebrowTone = 'primary',
  title,
  light = false,
  center = false,
  className,
}: {
  eyebrow: string;
  eyebrowTone?: 'primary' | 'muted';
  title: string;
  light?: boolean;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(center && 'text-center', className)}>
      <p
        className={cn(
          'font-label flex items-center gap-2',
          center && 'justify-center',
          eyebrowTone === 'primary' ? 'text-ares-primary' : 'text-ares-muted'
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          'font-display mt-4',
          light ? 'text-white' : 'text-ares-tertiary'
        )}
        style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}
      >
        {title}
      </h2>
      <div
        data-scanline
        className={cn('mt-5 h-px w-24 origin-left bg-ares-primary', center && 'mx-auto origin-center')}
      />
    </div>
  );
}

/** Floating mini KPI tile (perpetual motion isolated in a memo component). */
const FloatingKpiTile = memo(function FloatingKpiTile() {
  return (
    <div className="animate-ares-float kpi-tile absolute -bottom-6 -left-6 z-10 w-44 shadow-paper">
      <p className="font-label text-ares-muted">AI Visibility Score</p>
      <p className="font-display-num mt-2 text-[32px]">
        <CountUp value={72} duration={1.2} />
      </p>
      <p className="mt-1 text-[10px] font-light text-ares-muted">
        Sample tenant · Northwind Advisory
      </p>
    </div>
  );
});

/* ------------------------------- engine chips ------------------------------ */

function EngineGlyph({ kind }: { kind: string }) {
  const stroke = '#07161D';
  switch (kind) {
    case 'hexagon':
      return (
        <svg viewBox="0 0 40 40" className="h-9 w-9">
          <polygon points="31,20 25.5,29.5 14.5,29.5 9,20 14.5,10.5 25.5,10.5" fill="none" stroke={stroke} strokeWidth="1.4" />
          <circle cx="20" cy="20" r="3.2" fill="none" stroke={stroke} strokeWidth="1.4" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 40 40" className="h-9 w-9">
          <path d="M 20 3 C 22 13.5 26.5 18 37 20 C 26.5 22 22 26.5 20 37 C 18 26.5 13.5 22 3 20 C 13.5 18 18 13.5 20 3 Z" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case 'orb':
      return (
        <svg viewBox="0 0 40 40" className="h-9 w-9">
          <circle cx="20" cy="20" r="15" fill="none" stroke={stroke} strokeWidth="1.4" />
          <path d="M 5 24 A 15.5 15.5 0 0 1 35 24" fill="none" stroke={stroke} strokeWidth="1.4" />
          <circle cx="20" cy="15" r="2.4" fill={stroke} />
        </svg>
      );
    case 'compass':
      return (
        <svg viewBox="0 0 40 40" className="h-9 w-9">
          <circle cx="20" cy="20" r="16" fill="none" stroke={stroke} strokeWidth="1.4" />
          <polygon points="20,9.5 24.2,22 20,26.5 15.8,22" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case 'aperture':
      return (
        <svg viewBox="0 0 40 40" className="h-9 w-9">
          <circle cx="20" cy="20" r="16" fill="none" stroke={stroke} strokeWidth="1.4" />
          <line x1="20" y1="4" x2="24.4" y2="16.4" stroke={stroke} strokeWidth="1.4" />
          <line x1="33.9" y1="28" x2="21.8" y2="21.4" stroke={stroke} strokeWidth="1.4" />
          <line x1="6.1" y1="28" x2="18.2" y2="21.4" stroke={stroke} strokeWidth="1.4" />
          <circle cx="20" cy="20" r="6" fill="none" stroke={stroke} strokeWidth="1.4" />
        </svg>
      );
    default: // radar — needle rotates 20° on chip hover
      return (
        <svg viewBox="0 0 40 40" className="h-9 w-9">
          <path d="M 36 20 A 16 16 0 1 1 20 4" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M 29.5 20 A 9.5 9.5 0 1 1 20 10.5" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          <g className="origin-[20px_20px] transition-transform duration-300 ease-out group-hover:rotate-[20deg]">
            <line x1="20" y1="20" x2="31.5" y2="8.5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          </g>
          <circle cx="20" cy="20" r="1.8" fill={stroke} />
        </svg>
      );
  }
}

const ENGINES = [
  { name: 'ChatGPT', glyph: 'hexagon' },
  { name: 'Gemini', glyph: 'star' },
  { name: 'Claude', glyph: 'orb' },
  { name: 'Perplexity', glyph: 'compass' },
  { name: 'Google AI Overviews', glyph: 'aperture' },
  { name: 'AI Search', glyph: 'radar' },
];

/* ------------------------------ pinned story ------------------------------- */

const STEPS = [
  {
    num: '01',
    label: 'Measure',
    copy: 'Daily scans run your priority buyer prompts through all six engines and capture exactly what buyers see.',
  },
  {
    num: '02',
    label: 'Understand',
    copy: 'Every number drills down to the raw AI response. Misrepresentation alerts flag wrong facts with severity.',
  },
  {
    num: '03',
    label: 'Act',
    copy: 'An impact-ranked roadmap and 30/60/90-day plan turn findings into fixes — then the next scan proves they worked.',
  },
];

function MockMeasure({ active }: { active: boolean }) {
  return (
    <div className="action-card w-full max-w-md !p-5">
      <p className="font-label text-ares-muted">Visibility Dashboard</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Score', value: '72' },
          { label: 'Mention rate', value: '48%' },
          { label: 'Citation rate', value: '34%' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-ares border border-ares-border2 bg-ares-surface p-3">
            <p className="text-[9px] uppercase tracking-[0.08em] text-ares-muted">{kpi.label}</p>
            <p className="font-display-num mt-1 text-[22px]">{kpi.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] text-ares-muted">
          <span className="uppercase tracking-[0.08em]">ChatGPT</span>
          <span className="text-ares-primary">78</span>
        </div>
        <div className="bar-track mt-1.5">
          <div
            className="bar-fill"
            style={{ width: active ? '78%' : '0%' }}
          />
        </div>
      </div>
    </div>
  );
}

function MockUnderstand({ active }: { active: boolean }) {
  const alphas = [0.9, 0.62, 0.34, 0.78, 0.12, 0.5, 0.28, 0.84, 0.08, 0.44, 0.7, 0.2, 0.56, 0.16, 0.92, 0.38, 0.66, 0.24, 0.1, 0.48, 0.74, 0.3, 0.58, 0.86, 0.14, 0.4, 0.68, 0.22, 0.52, 0.8];
  return (
    <div className="w-full max-w-md space-y-3">
      <div className="action-card !p-5">
        <p className="font-label text-ares-muted">Prompt × Engine Heatmap</p>
        <div className="mt-4 grid grid-cols-6 gap-1.5">
          {alphas.map((a, i) => (
            <div
              key={i}
              className="h-7 rounded-ares transition-all duration-500"
              style={{
                backgroundColor: `rgba(50,137,174,${active ? a : 0.05})`,
                transitionDelay: `${i * 30}ms`,
                transform: active ? 'scale(1)' : 'scale(0.9)',
                opacity: active ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      </div>
      <div className="action-card flex items-start gap-3 border-l-[3px] !border-l-ares-primary !p-4">
        <Icon icon={icons.dangerTriangle} width={18} height={18} className="mt-0.5 shrink-0 text-ares-primary" />
        <div>
          <p className="text-[12px] font-normal text-ares-text">Wrong service area stated</p>
          <p className="mt-0.5 text-[10px] font-light text-ares-muted">
            Engines affected: ChatGPT, Perplexity · Severity: High
          </p>
        </div>
      </div>
    </div>
  );
}

function MockAct({ active }: { active: boolean }) {
  const phases = [
    { label: '30 days — Stabilize', items: ['Fix service-area facts', 'Claim missing citations'] },
    { label: '60 days — Build', items: ['Publish pricing page', 'Seed comparison content'] },
    { label: '90 days — Expand', items: ['Grow prompt coverage', 'Re-benchmark competitors'] },
  ];
  return (
    <div className="action-card w-full max-w-md !p-5">
      <p className="font-label text-ares-muted">30 / 60 / 90-Day Plan</p>
      <div className="mt-4 space-y-4">
        {phases.map((phase, pi) => (
          <div
            key={phase.label}
            className="transition-all duration-500"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(12px)',
              transitionDelay: `${pi * 100}ms`,
            }}
          >
            <p className="text-[10px] font-normal uppercase tracking-[0.08em] text-ares-tertiary">
              {phase.label}
            </p>
            <ul className="mt-1.5 space-y-1">
              {phase.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[11px] font-light text-ares-secondarytext">
                  <Icon icon={icons.checkCircle} width={13} height={13} className="shrink-0 text-ares-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- FAQ content ------------------------------- */

const FAQS = [
  {
    q: 'How is this different from Profound or Peec?',
    a: 'Prompt-sampling tools estimate visibility from a hand-picked basket of prompts. AI Search IQ pairs that monitoring with first-party, server-side measurement of every AI crawl, citation fetch, and referred visit on your actual site — proof, not estimates.',
  },
  {
    q: 'What exactly do you monitor?',
    a: 'Your 12 priority buyer prompts, executed daily across six AI engines — ChatGPT, Gemini, Claude, Perplexity, Google AI Overviews, and AI Search. We capture the full response a real user would see: whether you are mentioned, how you are described, which sources are cited, and how competitors rank beside you.',
  },
  {
    q: 'How is the AI Visibility Score calculated?',
    a: 'It is a 0–100 composite of mention rate, representation accuracy, citation strength, and competitor position, weighted per engine and rolled up daily. Every component drills down to the raw scan data behind it — no black box.',
  },
  {
    q: 'Do you fix the problems or just report them?',
    a: 'Both. Findings arrive as an impact-ranked action plan with the exact fix, the affected engines, and a 30/60/90-day sequence. The next daily scan then verifies whether the fix worked — measure, act, re-measure.',
  },
  {
    q: 'Can my agency manage multiple clients?',
    a: 'Yes. AI Search IQ is multi-tenant by design: each client is a tenant with its own scans, reports, and team seats. One flat price per tenant, unlimited seats — no prompt credits or per-engine add-ons.',
  },
  {
    q: 'What happens after the $399 report?',
    a: 'The initial report is a complete baseline: scores across six engines, competitor benchmarks, citation gaps, alerts, and your first 30/60/90-day plan. Continue into the $1,000/month platform only if the data earns it — daily monitoring, monthly reports, and the copilot.',
  },
];

/* ---------------------------------- page ----------------------------------- */

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const pinRef = useRef<HTMLElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const needleRef = useRef<SVGGElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const reduced = useRef(prefersReducedMotion());

  // Lenis smooth scroll (marketing pages only)
  useEffect(() => {
    if (reduced.current) return;
    const lenis = new Lenis({ duration: 1.1 });
    lenis.on('scroll', ScrollTrigger.update);
    const update = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, []);

  useGSAP(
    () => {
      if (reduced.current) return;

      /* Hero: H1 word-split reveal */
      const split = new SplitText(h1Ref.current, { type: 'words' });
      gsap.fromTo(
        split.words,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: EASE, stagger: 0.07 }
      );
      gsap.fromTo(
        '[data-hero-fade]',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: EASE, stagger: 0.1, delay: 0.3 }
      );
      gsap.fromTo(
        '[data-hero-scanline]',
        { scaleX: 0 },
        { scaleX: 1, duration: 0.7, ease: EASE, delay: 0.4 }
      );
      gsap.fromTo(
        '[data-hero-visual]',
        { scale: 0.96, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.7, ease: EASE, delay: 0.2 }
      );

      /* Standard reveals */
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: EASE,
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          }
        );
      });
      gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
        gsap.fromTo(
          Array.from(group.children),
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: EASE,
            stagger: 0.09,
            scrollTrigger: { trigger: group, start: 'top 85%', once: true },
          }
        );
      });
      gsap.utils.toArray<HTMLElement>('[data-scanline]').forEach((el) => {
        gsap.fromTo(
          el,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 0.7,
            ease: EASE,
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          }
        );
      });

      /* S5 pinned Measure → Understand → Act */
      const panels = panelRefs.current.filter(Boolean) as HTMLDivElement[];
      gsap.set(panels[1], { opacity: 0, y: 20 });
      gsap.set(panels[2], { opacity: 0, y: 20 });
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinRef.current,
          start: 'top 96px',
          end: '+=200%',
          pin: true,
          scrub: 0.5,
          onUpdate: (self) => {
            setActiveStep(Math.min(2, Math.floor(self.progress * 3)));
          },
        },
      });
      tl.to(panels[0], { opacity: 0, y: -20, duration: 0.4, ease: 'none' }, 0.8)
        .to(panels[1], { opacity: 1, y: 0, duration: 0.4, ease: 'none' }, 0.8)
        .to(panels[1], { opacity: 0, y: -20, duration: 0.4, ease: 'none' }, 1.8)
        .to(panels[2], { opacity: 1, y: 0, duration: 0.4, ease: 'none' }, 1.8)
        .to({}, { duration: 0.6 });

      /* S7 report cover parallax */
      gsap.fromTo(
        '[data-cover-parallax]',
        { y: 0 },
        {
          y: -20,
          ease: 'none',
          scrollTrigger: { trigger: '[data-cover-parallax]', start: 'top bottom', end: 'bottom top', scrub: true },
        }
      );

      /* S11 radar needle sweep on entry */
      if (needleRef.current) {
        gsap.fromTo(
          needleRef.current,
          { rotate: -90, transformOrigin: '24px 24px' },
          {
            rotate: 0,
            duration: 0.9,
            ease: EASE,
            scrollTrigger: { trigger: needleRef.current, start: 'top 80%', once: true },
          }
        );
      }

      return () => {
        split.revert();
      };
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef}>
      {/* S2 — Hero */}
      <section className="noise-overlay relative overflow-hidden">
        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 lg:min-h-[640px] lg:grid-cols-12 lg:py-0">
          <div className="lg:col-span-7">
            <p data-hero-fade className="font-label flex items-center gap-2 text-ares-primary">
              <Icon icon={icons.radar2} width={16} height={16} />
              AI VISIBILITY — MEASURED, NOT ESTIMATED
            </p>
            <h1
              ref={h1Ref}
              className="font-display mt-6"
              style={{ fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1.02 }}
            >
              How AI sees your business.
            </h1>
            <div data-hero-scanline className="mt-6 h-px w-32 origin-left bg-ares-primary" />
            <p
              data-hero-fade
              className="mt-6 max-w-[480px] text-[13px] font-light leading-[22px] text-ares-secondarytext"
            >
              Prompt monitoring shows how AI talks about your brand. Server-side analytics show
              what AI actually does on your site — every training crawl, every live citation
              fetch, every referred visit. AI Search IQ is the only platform that does both.
            </p>
            <div data-hero-fade className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={`${LOGIN_PATH}?intent=report`} className="btn-primary">
                Request your AI Visibility Report
              </Link>
              <Link to="/sample-report" className="btn-secondary">
                View a sample report
              </Link>
            </div>
            <p data-hero-fade className="mt-6 text-[10px] font-light tracking-[0.04em] text-ares-muted">
              Six AI engines monitored · Daily scans · $399 initial report
            </p>
          </div>
          <div className="relative lg:col-span-5" data-hero-visual>
            <div className="rounded-ares border border-ares-border bg-ares-card p-8 shadow-paper">
              <img src="/hero-visual.svg" alt="Radar arcs across six AI engines" className="w-full" />
            </div>
            <FloatingKpiTile />
          </div>
        </div>
      </section>

      {/* S3 — Problem statement */}
      <section className="mx-auto max-w-3xl px-6 py-32 text-center">
        <p className="font-label text-ares-muted" data-reveal>
          The blind spot
        </p>
        <h2
          className="font-display mt-4 text-ares-tertiary"
          style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}
          data-reveal
        >
          You rank on Google. But what does AI say about you?
        </h2>
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3" data-reveal-group>
          {[
            { num: 61, suffix: '%', text: 'of buyers under 45 start vendor research in an AI assistant' },
            { num: 0, suffix: '', text: 'tools in your SEO stack show what AI engines claim about your business' },
            { num: 1, suffix: '', text: 'wrong fact (service area, founding year, pricing) can quietly cost you the shortlist' },
          ].map((stat) => (
            <div key={stat.text} className="kpi-tile !p-5 text-left">
              <p className="font-display-num text-[32px]">
                <CountUp value={stat.num} suffix={stat.suffix} duration={0.9} />
              </p>
              <p className="mt-2 text-[11px] font-light leading-[18px] text-ares-secondarytext">
                {stat.text}
              </p>
            </div>
          ))}
        </div>
        <div data-scanline className="mx-auto mt-14 h-px w-24 origin-center bg-ares-primary" />
        <p
          className="mx-auto mt-8 max-w-xl text-[13px] font-light leading-[22px] text-ares-secondarytext"
          data-reveal
        >
          AI engines state wrong service areas, wrong founding years, and missing pricing — and most
          monitoring counts even a wrong mention as good news. We measure representation, not just
          presence.
        </p>
      </section>

      {/* S4 — Engine coverage strip */}
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
      </section>

      {/* S5 — Measure → Understand → Act (pinned) */}
      <section ref={pinRef} className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="font-label text-ares-primary">How it works</p>
            <h2 className="font-display mt-4 text-ares-tertiary" style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>
              Measure. Understand. Act.
            </h2>
            <div className="mt-10 space-y-8">
              {STEPS.map((step, i) => (
                <div key={step.num} className="flex gap-5">
                  <span
                    className={cn(
                      'font-display-num text-[24px] transition-colors duration-300',
                      activeStep === i ? 'text-ares-primary' : 'text-ares-muted'
                    )}
                  >
                    {step.num}
                  </span>
                  <div>
                    <p
                      className={cn(
                        'font-label transition-colors duration-300',
                        activeStep === i ? 'text-ares-primary' : 'text-ares-muted'
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="mt-2 max-w-sm text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
                      {step.copy}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative flex min-h-[420px] items-center justify-center lg:col-span-7">
            <div ref={(el) => { panelRefs.current[0] = el; }} className="absolute flex w-full justify-center">
              <MockMeasure active={activeStep === 0} />
            </div>
            <div ref={(el) => { panelRefs.current[1] = el; }} className="absolute flex w-full justify-center">
              <MockUnderstand active={activeStep === 1} />
            </div>
            <div ref={(el) => { panelRefs.current[2] = el; }} className="absolute flex w-full justify-center">
              <MockAct active={activeStep === 2} />
            </div>
          </div>
        </div>
      </section>

      {/* S6 — Platform features grid */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeader eyebrow="The platform" title="Perception in the answer. Proof on your server." />
        <p
          className="mt-6 max-w-2xl text-[13px] font-light leading-[22px] text-ares-secondarytext"
          data-reveal
        >
          Other platforms sample prompts and estimate. AI Search IQ pairs that perception
          monitoring with first-party, server-side measurement of what AI actually does on your
          site — three signals no prompt-sampling tool can see.
        </p>
        <p className="font-label mt-12 text-ares-primary" data-reveal>
          Perception + Proof
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3" data-reveal-group>
          {[
            {
              icon: icons.radar2,
              title: 'Training crawls',
              body: 'GPTBot, ClaudeBot, PerplexityBot reading your pages for the next model.',
            },
            {
              icon: icons.documentText,
              title: 'Conversation citations',
              body: 'ChatGPT-User, Claude-User, Perplexity-User fetching your page while answering a real customer.',
            },
            {
              icon: icons.graphUp,
              title: 'Referral visits',
              body: 'People clicking through from AI answers — a channel GA4 cannot see.',
            },
          ].map((card) => (
            <div key={card.title} className="action-card group !p-6">
              <Icon
                icon={card.icon}
                width={22}
                height={22}
                className="text-ares-secondarytext transition-colors duration-200 group-hover:text-ares-primary"
              />
              <h3 className="mt-4 text-[15px] font-normal text-ares-tertiary">{card.title}</h3>
              <p className="mt-2 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
                {card.body}
              </p>
            </div>
          ))}
        </div>
        <p className="font-label mt-12 text-ares-muted" data-reveal>
          The modules
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-reveal-group>
          {[
            {
              icon: icons.chart2,
              title: 'AI Visibility Dashboard',
              body: 'Six KPIs and a 0–100 composite score across every engine, with deltas vs. your last scan.',
              href: '/platform#dashboard',
            },
            {
              icon: icons.eye,
              title: 'Prompt Monitoring',
              body: 'Your 12 priority buyer prompts × 6 engines, visualized as a visibility heatmap. Click any cell for the raw answer.',
              href: '/platform#monitoring',
            },
            {
              icon: icons.usersGroupRounded,
              title: 'Competitive Intelligence',
              body: 'A leaderboard of your real competitors, plus SERP overlap, keyword gaps, and backlink comparison.',
              href: '/platform#competitors',
            },
            {
              icon: icons.dangerTriangle,
              title: 'Misrepresentation Alerts',
              body: 'Wrong service area? Wrong founding year? Severity-tiered alerts with the exact fix and affected engines.',
              href: '/platform#alerts',
            },
            {
              icon: icons.target,
              title: 'Action Plans',
              body: 'Impact × effort roadmap cards auto-sequenced into a 30/60/90-day plan: Stabilize, Build, Expand.',
              href: '/platform#action-plan',
            },
            {
              icon: icons.chatRoundDots,
              title: 'Ask AI Search IQ',
              body: 'A copilot that answers questions about your own data — every claim cited to the scan behind it.',
              href: '/platform#copilot',
            },
          ].map((feature) => (
            <Link key={feature.title} to={feature.href} className="action-card group !p-6">
              <Icon
                icon={feature.icon}
                width={22}
                height={22}
                className="text-ares-secondarytext transition-colors duration-200 group-hover:text-ares-primary"
              />
              <h3 className="mt-4 text-[15px] font-normal text-ares-tertiary">{feature.title}</h3>
              <p className="mt-2 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
                {feature.body}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* S7 — Sample report teaser */}
      <section className="border-y border-ares-border bg-ares-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 py-24 lg:grid-cols-12">
          <div className="lg:col-span-5" data-cover-parallax>
            <div className="group mx-auto max-w-sm">
              <Link to="/sample-report">
                <img
                  src="/report-cover.png"
                  alt="Sample AI Visibility Report cover"
                  className="w-full -rotate-2 rounded-ares shadow-paper transition-transform duration-300 ease-out group-hover:rotate-0"
                />
              </Link>
            </div>
          </div>
          <div className="lg:col-span-7" data-reveal>
            <p className="font-label text-ares-primary">The deliverable</p>
            <h2 className="font-display mt-4 text-ares-tertiary" style={{ fontSize: 'clamp(24px, 3.2vw, 32px)' }}>
              A report your board can read.
            </h2>
            <p className="mt-5 max-w-lg text-[13px] font-light leading-[22px] text-ares-secondarytext">
              The same AI Visibility Intelligence report our clients know — cover to action plan in
              ten pages — now generated monthly from live scan data.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                'Visibility score & engine breakdown',
                'Competitor benchmarks',
                'Citation gaps',
                '30/60/90-day plan',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[12px] font-light text-ares-secondarytext">
                  <Icon icon={icons.checkCircle} width={15} height={15} className="shrink-0 text-ares-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/sample-report" className="btn-primary mt-8">
              Explore the sample report
            </Link>
          </div>
        </div>
      </section>

      {/* S8 — Why we're different */}
      <section className="bg-ares-tertiary py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeader
            eyebrow="Why AI Search IQ"
            title="Built for local & service businesses — and the agencies that run them."
            light
          />
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3" data-reveal-group>
            {[
              {
                title: 'The full loop',
                body: 'Measure → act → re-measure. Monitoring-only tools stop at the chart; we ship the plan and the follow-up benchmark.',
              },
              {
                title: 'The whole stack',
                body: 'AI visibility unified with Google Business Profile, Search Console, GA4, backlinks, and Lighthouse. No incumbent combines them.',
              },
              {
                title: 'Flat, honest pricing',
                body: 'One tenant, one price, unlimited seats. No prompt credits, no per-engine add-ons, no seat math.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-ares border border-white/[0.12] bg-white/[0.03] p-6 transition-colors duration-200 hover:border-ares-primary/60"
              >
                <h3 className="text-[15px] font-normal text-white">{card.title}</h3>
                <p className="mt-3 text-[12px] font-light leading-[19.5px] text-white/60">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* S9 — Pricing teaser */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <SectionHeader eyebrow="Pricing" title="Simple. Flat. Per company." center />
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2" data-reveal-group>
          <div className="action-card !p-8">
            <p className="font-label text-ares-muted">Initial AI Visibility Report</p>
            <p className="font-display-num mt-4 text-[40px]">
              <CountUp value={399} prefix="$" duration={1.1} />
            </p>
            <p className="mt-1 text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted">
              one-time, per company
            </p>
            <p className="mt-5 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
              A complete baseline audit: scores across six engines, competitor benchmarks, citation
              gaps, alerts, and your first 30/60/90-day plan.
            </p>
          </div>
          <div className="action-card !p-8">
            <p className="font-label text-ares-muted">AI Search IQ Platform</p>
            <p className="font-display-num mt-4 text-[40px]">
              <CountUp value={1000} prefix="$" duration={1.1} />
            </p>
            <p className="mt-1 text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted">
              per month · per tenant · unlimited seats
            </p>
            <p className="mt-5 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
              Daily monitoring, alerts, monthly reports, the copilot, and every integration. Your
              whole team, included.
            </p>
          </div>
        </div>
        <p className="mt-6 text-center text-[11px] font-light text-ares-muted" data-reveal>
          Agencies &amp; resellers: Enterprise white-label puts your logo and name on the portal and
          reports — <a href="mailto:hello@aisearchiq.net" className="text-ares-primaryDark underline-offset-2 hover:underline">talk to us</a>.
        </p>
        <div className="mt-10 text-center" data-reveal>
          <p className="text-[13px] font-light text-ares-secondarytext">
            Start with the report. Continue only if the data earns it.
          </p>
          <Link to="/pricing" className="btn-primary mt-5">
            See full pricing
          </Link>
        </div>
      </section>

      {/* S10 — FAQ strip */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-24">
        <SectionHeader eyebrow="FAQ" title="Questions, answered." center eyebrowTone="muted" />
        <AccordionPrimitive.Root type="single" collapsible className="mt-10" data-reveal>
          {FAQS.map((faq, i) => (
            <AccordionPrimitive.Item
              key={faq.q}
              value={`faq-${i}`}
              className="mb-2 rounded-ares border border-ares-border bg-ares-card"
            >
              <AccordionPrimitive.Header className="flex">
                <AccordionPrimitive.Trigger className="group flex flex-1 items-center justify-between gap-4 px-5 py-4 text-left text-[13px] font-normal text-ares-tertiary transition-colors duration-200 hover:text-ares-primary">
                  {faq.q}
                  <Icon
                    icon={icons.altArrowDown}
                    width={16}
                    height={16}
                    className="shrink-0 text-ares-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
                  />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <p className="px-5 pb-5 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
                  {faq.a}
                </p>
              </AccordionPrimitive.Content>
            </AccordionPrimitive.Item>
          ))}
        </AccordionPrimitive.Root>
      </section>

      {/* S11 — Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-ares bg-ares-tertiary px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center">
            <svg viewBox="0 0 48 48" className="h-12 w-12">
              <g fill="none" stroke="#3289AE" strokeWidth="1.6" strokeLinecap="round">
                <path d="M 42.5 24 A 18.5 18.5 0 1 1 24 5.5" />
                <path d="M 36.2 24 A 12.2 12.2 0 1 1 24 11.8" />
                <path d="M 30 24 A 6 6 0 1 1 24 18" />
              </g>
              <g ref={needleRef}>
                <line x1="24" y1="24" x2="37.8" y2="10.2" stroke="#3289AE" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="37.8" cy="10.2" r="2.4" fill="#3289AE" />
              </g>
              <circle cx="24" cy="24" r="2" fill="#3289AE" />
            </svg>
          </div>
          <p className="font-label mt-6 text-ares-primary">Next step</p>
          <h2
            className="font-display mx-auto mt-4 max-w-2xl text-white"
            style={{ fontSize: 'clamp(30px, 4.5vw, 44px)' }}
            data-reveal
          >
            Find out how AI sees you.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[13px] font-light leading-[22px] text-white/70">
            Request your initial AI Visibility Report. Baseline in days, plan included.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to={`${LOGIN_PATH}?intent=report`} className="btn-primary">
              Request your AI Visibility Report
            </Link>
            <Link to={LOGIN_PATH} className="btn-secondary-dark">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
