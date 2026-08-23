// Pricing — /pricing (design: pricing.md)
import { useRef } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import { Icon } from '@iconify/react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { icons } from '@/lib/icons';
import { LOGIN_PATH } from '@/const';
import {
  CountUp,
  DarkCtaPanel,
  EASE,
  SectionHeader,
  SplitWords,
  prefersReducedMotion,
  useInViewOnce,
  useLenis,
  useStandardReveals,
} from '@/components/marketing/shared';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/* --------------------------------- content ---------------------------------- */

const REPORT_FEATURES = [
  'Full audit across ChatGPT, Gemini, Claude, Perplexity, Google AI Overviews, AI Search',
  'AI Visibility Score with published component weights',
  'Competitor benchmark vs. your top 3 rivals',
  'Citation & source gap analysis',
  'Misrepresentation alerts with severity and fixes',
  'Your first 30/60/90-day action plan',
  'Delivered as a board-ready PDF + portal workspace',
];

const PLATFORM_FEATURES = [
  'Daily scans: 12 priority prompts × 6 engines',
  'Live dashboard with deltas vs. every scan',
  'Prompt × engine visibility heatmap',
  'Competitor leaderboard + DataForSEO research',
  'Misrepresentation alerts with verified resolution',
  'Monthly AI Visibility Report, auto-generated',
  '"Ask AI Search IQ" copilot over your data',
  'GBP, Search Console, GA4, Lighthouse integrations',
  'Unlimited seats — invite your whole team',
];

const MINI_STATS = [
  { value: 6, suffix: '', label: 'AI engines monitored' },
  { value: 12, suffix: '', label: 'Priority prompts' },
  { value: null, text: 'Daily', label: 'Scan cadence' },
  { value: null, text: 'Unlimited', label: 'Seats' },
];

const COMPARISON = [
  { aspect: 'Engines included', ours: '6 of 6', theirs: '3, rest paid add-ons' },
  { aspect: 'Refresh cadence', ours: 'Daily', theirs: '72-hour default' },
  { aspect: 'Seats', ours: 'Unlimited', theirs: 'Capped per tier' },
  {
    aspect: 'Local-SEO stack integrations',
    ours: 'GBP / GSC / GA4 / DataForSEO / Lighthouse',
    theirs: 'None / partial',
  },
  { aspect: 'Action plan', ours: 'Auto-generated 30/60/90', theirs: 'Charts only' },
  { aspect: 'Pricing unit', ours: 'Per company, flat', theirs: 'Prompt credits + per-engine add-ons' },
];

const AUDIENCES = [
  {
    title: 'Local & service businesses',
    body: 'You win on trust. Make sure AI tells your story right — right service areas, right facts, right shortlist.',
  },
  {
    title: 'Professional services',
    body: 'Firms live on referrals. Now referrals start in AI answers; measure your share of them.',
  },
  {
    title: 'Agencies',
    body: 'Multi-client workspaces, client-ready reports, and unlimited seats at a flat per-tenant price.',
  },
];

const FAQS = [
  {
    q: 'Is the $399 report a trial?',
    a: "No; it's a complete, standalone baseline audit. The monthly platform continues from it.",
  },
  {
    q: 'What counts as a tenant?',
    a: 'One company workspace: its prompts, competitors, integrations, reports, and members.',
  },
  {
    q: 'Do seats cost extra?',
    a: 'Never. Unlimited members per tenant.',
  },
  {
    q: 'Can I add more prompts or engines?',
    a: 'Prompt sets are curated with you at onboarding; engine expansion is operator-configured, not an upsell.',
  },
  {
    q: 'Can agencies run multiple clients?',
    a: 'Yes — one tenant per client, consolidated in one login. White-label reporting on the roadmap.',
  },
  {
    q: 'Can I cancel?',
    a: 'Anytime. Your report and scan history remain exportable.',
  },
];

/* --------------------------------- pieces ----------------------------------- */

function Checklist({ items, staggerFrom }: { items: string[]; staggerFrom: boolean }) {
  return (
    <ul className="mt-6 space-y-2.5">
      {items.map((item, i) => (
        <li
          key={item}
          className="flex items-start gap-2.5 text-[12px] font-light leading-[18px] text-ares-secondarytext transition-all duration-500"
          style={{
            opacity: staggerFrom ? 1 : 0,
            transform: staggerFrom ? 'translateY(0)' : 'translateY(8px)',
            transitionDelay: `${i * 50}ms`,
          }}
        >
          <Icon icon={icons.checkCircle} width={15} height={15} className="mt-0.5 shrink-0 text-ares-primary" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------- page ------------------------------------ */

export default function Pricing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { ref: cardsRef, inView: cardsInView } = useInViewOnce<HTMLDivElement>(0.2);
  useLenis();
  useStandardReveals(rootRef);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      // Cards rise 60px, staggered 150ms
      const cards = gsap.utils.toArray<HTMLElement>('[data-price-card]');
      if (cards.length) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 60 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: EASE,
            stagger: 0.15,
            scrollTrigger: { trigger: cardsRef.current, start: 'top 80%', once: true },
          }
        );
      }
      // Card 2 primary border draws in once (800ms)
      const highlighted = rootRef.current?.querySelector('[data-price-card-highlight]');
      if (highlighted) {
        gsap.fromTo(
          highlighted,
          { borderColor: 'rgba(203,77,34,0)' },
          {
            borderColor: 'rgba(203,77,34,1)',
            duration: 0.8,
            ease: 'power2.inOut',
            scrollTrigger: { trigger: highlighted, start: 'top 80%', once: true },
          }
        );
      }
      // Comparison table rows stagger
      const rows = gsap.utils.toArray<HTMLElement>('[data-cmp-row]');
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
            scrollTrigger: { trigger: '[data-cmp-table]', start: 'top 85%', once: true },
          }
        );
      }
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef}>
      {/* S1 — Header */}
      <section className="noise-overlay relative">
        <div className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-32 text-center">
          <p className="font-label text-ares-primary" data-reveal>
            Pricing
          </p>
          <SplitWords
            className="font-display mx-auto mt-6"
            style={{ fontSize: 'clamp(36px, 5.5vw, 56px)' }}
          >
            One company. One price.
          </SplitWords>
          <div data-scanline className="mx-auto mt-6 h-px w-32 origin-center bg-ares-primary" />
          <p
            className="mx-auto mt-6 max-w-[560px] text-[13px] font-light leading-[22px] text-ares-secondarytext"
            data-reveal
          >
            Start with a $399 baseline report. Continue at $1,000 per month when the data earns it.
            Unlimited seats, all six engines, every module — no credits, no add-ons, no seat math.
          </p>
        </div>
      </section>

      {/* S2 — Pricing cards */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div ref={cardsRef} className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          {/* Card 1 — Initial report */}
          <div data-price-card className="action-card flex flex-col !p-10">
            <p className="font-label text-ares-muted">Step 01 · Baseline</p>
            <p className="mt-2 text-[15px] font-normal text-ares-tertiary">Initial AI Visibility Report</p>
            <p className="font-display-num mt-6 text-[48px]">
              <CountUp value={399} prefix="$" duration={1.0} />
            </p>
            <p className="mt-1 text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted">
              one-time · per company
            </p>
            <div className="section-rule mt-6" />
            <Checklist items={REPORT_FEATURES} staggerFrom={cardsInView} />
            <div className="mt-8 flex-1" />
            <Link to={`${LOGIN_PATH}?intent=report`} className="btn-secondary w-full">
              Request your report
            </Link>
          </div>

          {/* Card 2 — Platform */}
          <div
            data-price-card
            data-price-card-highlight
            className="action-card relative flex flex-col border !p-10"
            style={{ borderColor: 'rgba(203,77,34,0)' }}
          >
            <span className="badge-pill absolute right-6 top-6 text-ares-primary">
              Continuous visibility
            </span>
            <p className="font-label text-ares-muted">Step 02 · Monitoring</p>
            <p className="mt-2 text-[15px] font-normal text-ares-tertiary">AI Search IQ Platform</p>
            <p className="font-display-num mt-6 text-[48px]">
              <CountUp value={1000} prefix="$" duration={1.0} />
            </p>
            <p className="mt-1 text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted">
              per month · per tenant
            </p>
            <div className="section-rule mt-6" />
            <Checklist items={PLATFORM_FEATURES} staggerFrom={cardsInView} />
            <div className="mt-8 flex-1" />
            <Link to={`${LOGIN_PATH}?intent=report`} className="btn-primary w-full">
              Start with the report
            </Link>
          </div>
        </div>
        <p
          className="mt-10 text-center text-[13px] font-normal leading-[22px] text-ares-secondarytext"
          data-reveal
        >
          Less than an agency retainer. More proof than any prompt-sampling tool.
        </p>
        <p
          className="mx-auto mt-4 max-w-2xl text-center text-[10px] font-light leading-[16px] text-ares-muted"
          data-reveal
        >
          The platform is a continuation of the report — your $399 baseline seeds the tenant, so day
          one already shows real data. Cancel anytime; your scan history stays exportable.
        </p>
      </section>

      {/* S3 — Included in every plan */}
      <section className="border-y border-ares-border bg-ares-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 lg:grid-cols-4" data-reveal-group>
          {MINI_STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display-num text-[20px]">
                {stat.value != null ? <CountUp value={stat.value} duration={0.9} /> : stat.text}
              </p>
              <p className="font-label mt-2 text-ares-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* S4 — Comparison table */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <SectionHeader
          eyebrow="Why flat wins"
          title="No credit math. No tiered gatekeeping."
          titleSize="clamp(24px, 3vw, 32px)"
        />
        <div className="mt-12 overflow-x-auto rounded-ares border border-ares-border bg-ares-card" data-reveal>
          <table className="data-table" data-cmp-table>
            <thead>
              <tr>
                <th className="w-1/3">Capability</th>
                <th style={{ backgroundColor: 'rgba(203,77,34,0.04)' }}>AI Search IQ</th>
                <th>Typical AI visibility tools</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.aspect} data-cmp-row>
                  <td className="text-ares-secondarytext">{row.aspect}</td>
                  <td className="font-normal text-ares-primary" style={{ backgroundColor: 'rgba(203,77,34,0.04)' }}>
                    {row.ours}
                  </td>
                  <td className="text-ares-secondarytext">{row.theirs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* S5 — Who it's for */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <SectionHeader eyebrow="Who it's for" title="Built for businesses that win on trust." titleSize="clamp(24px, 3vw, 32px)" />
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3" data-reveal-group>
          {AUDIENCES.map((a) => (
            <div key={a.title} className="action-card !p-6">
              <h3 className="text-[15px] font-normal text-ares-tertiary">{a.title}</h3>
              <p className="mt-3 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
                {a.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* S6 — Pricing FAQ */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <SectionHeader eyebrow="Pricing FAQ" title="Questions, answered." center eyebrowTone="muted" />
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

      {/* S7 — Final CTA */}
      <DarkCtaPanel
        eyebrow="Next step"
        title="Get your baseline."
        body="A complete AI visibility audit for $399 — scores, benchmarks, gaps, and your first 30/60/90-day plan."
        titleSize="clamp(28px, 4vw, 40px)"
      >
        <Link to={`${LOGIN_PATH}?intent=report`} className="btn-primary">
          Request the $399 report
        </Link>
        <a href="mailto:hello@ai-search-iq.io" className="btn-secondary-dark">
          Talk to us
        </a>
      </DarkCtaPanel>
    </div>
  );
}
