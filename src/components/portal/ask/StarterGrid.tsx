import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { icons } from '@/lib/icons';
import type { StarterPrompt } from './types';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Empty state for a new conversation (ask.md §S2): radar glyph, display
 * heading, grounding note, and the 2×2 starter prompt grid. Clicking a card
 * sends the prompt.
 */
export default function StarterGrid({
  starters,
  tenantName,
  onPick,
}: {
  starters: StarterPrompt[];
  tenantName: string;
  onPick: (question: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6 px-4 py-10 text-center">
      <motion.span
        initial={{ rotate: -35, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 1.1, ease: EASE }}
        className="origin-bottom-left text-ares-primary"
      >
        <Icon icon={icons.radar2} width={32} height={32} />
      </motion.span>
      <div>
        <h2 className="font-display text-[24px]">Ask your data anything.</h2>
        <p className="mt-2 text-[12px] font-light text-ares-muted">
          Answers are grounded in {tenantName}&apos;s scans, reports, and roadmap — every claim
          carries a citation.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {starters.map((s, i) => (
          <motion.button
            key={s.id}
            type="button"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 + i * 0.08, ease: EASE }}
            onClick={() => onPick(s.question)}
            className="action-card flex flex-col items-start gap-2 text-left"
          >
            <span className="text-[9px] font-light uppercase tracking-[0.1em] text-ares-muted">
              {s.category ?? 'Question'}
            </span>
            <span className="text-[12px] font-light leading-5 text-ares-secondarytext">
              {s.question}
            </span>
            <span className="mt-auto flex items-center gap-1 text-[10px] font-light uppercase tracking-[0.08em] text-ares-primary">
              Ask
              <Icon icon={icons.arrowRight} width={11} height={11} />
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
