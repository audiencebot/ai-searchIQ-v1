// Shared marketing-page building blocks (Platform / Pricing / Sample Report).
// Mirrors the motion + token patterns established in src/pages/Home.tsx.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { cn } from '@/lib/utils';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

export const EASE = 'power3.out'; // ≈ cubic-bezier(0.22, 1, 0.36, 1)

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* --------------------------------- hooks ---------------------------------- */

/** Lenis smooth scroll synced with GSAP's ticker (marketing pages only). */
export function useLenis() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
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
}

/** IntersectionObserver helper: flips once when the element enters view. */
export function useInViewOnce<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView } as const;
}

/** Standard reveals: [data-reveal], [data-reveal-group], [data-scanline]. */
export function useStandardReveals(rootRef: React.RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
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
    },
    { scope: rootRef }
  );
}

/* ------------------------------- components -------------------------------- */

/** Number ticker: counts 0 → value on first scroll into view. */
export function CountUp({
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

/** Display heading with a word-level SplitText reveal (design.md §6). */
export function SplitWords({
  as: Tag = 'h1',
  className,
  style,
  children,
  delay = 0,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion() || !ref.current) return;
      const split = new SplitText(ref.current, { type: 'words' });
      gsap.fromTo(
        split.words,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: EASE, stagger: 0.08, delay }
      );
      return () => split.revert();
    },
    { scope: ref }
  );
  return (
    <Tag ref={ref as React.RefObject<never>} className={className} style={style}>
      {children}
    </Tag>
  );
}

/** Eyebrow + display heading + terracotta scan line. */
export function SectionHeader({
  eyebrow,
  eyebrowTone = 'primary',
  title,
  light = false,
  center = false,
  className,
  titleSize,
}: {
  eyebrow: string;
  eyebrowTone?: 'primary' | 'muted';
  title: string;
  light?: boolean;
  center?: boolean;
  className?: string;
  titleSize?: string;
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
        className={cn('font-display mt-4', light ? 'text-white' : 'text-ares-tertiary')}
        style={{ fontSize: titleSize ?? 'clamp(28px, 4vw, 40px)' }}
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

/* ------------------------------ engine glyphs ------------------------------ */

export function EngineGlyph({ kind }: { kind: string }) {
  const stroke = '#2D1B11';
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

export const ENGINES = [
  { name: 'ChatGPT', glyph: 'hexagon' },
  { name: 'Gemini', glyph: 'star' },
  { name: 'Claude', glyph: 'orb' },
  { name: 'Perplexity', glyph: 'compass' },
  { name: 'Google AI Overviews', glyph: 'aperture' },
  { name: 'AI Search', glyph: 'radar' },
];

/** Static radar brand mark (used in report cover / CTA panels). */
export function RadarMark({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} style={{ width: size, height: size }}>
      <g fill="none" stroke="#CB4D22" strokeWidth="1.6" strokeLinecap="round">
        <path d="M 42.5 24 A 18.5 18.5 0 1 1 24 5.5" />
        <path d="M 36.2 24 A 12.2 12.2 0 1 1 24 11.8" />
        <path d="M 30 24 A 6 6 0 1 1 24 18" />
      </g>
      <line x1="24" y1="24" x2="37.8" y2="10.2" stroke="#CB4D22" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="37.8" cy="10.2" r="2.4" fill="#CB4D22" />
      <circle cx="24" cy="24" r="2" fill="#CB4D22" />
    </svg>
  );
}

/** Dark terracotta CTA panel (mirrors home S11). */
export function DarkCtaPanel({
  eyebrow,
  title,
  body,
  children,
  titleSize = 'clamp(30px, 4.5vw, 44px)',
}: {
  eyebrow: string;
  title: string;
  body?: string;
  children: ReactNode;
  titleSize?: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="noise-overlay relative overflow-hidden rounded-ares bg-ares-tertiary px-6 py-16 text-center">
        <div className="relative z-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center">
            <RadarMark size={48} />
          </div>
          <p className="font-label mt-6 text-ares-primary">{eyebrow}</p>
          <SplitWords
            as="h2"
            className="font-display mx-auto mt-4 max-w-2xl text-white"
            style={{ fontSize: titleSize }}
          >
            {title}
          </SplitWords>
          {body && (
            <p className="mx-auto mt-4 max-w-md text-[13px] font-light leading-[22px] text-white/70" data-reveal>
              {body}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3" data-reveal>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
