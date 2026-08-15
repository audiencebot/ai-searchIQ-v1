import { useNavigate } from 'react-router';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { icons } from '@/lib/icons';
import type { CitationRef } from './types';

/**
 * Inline citation chip (ask.md §S3): small badge-pill with a primary border
 * and document icon, appended after the claim it grounds. Click navigates to
 * the portal view behind the citation.
 */
export default function CitationChip({ citation, index }: { citation: CitationRef; index: number }) {
  const navigate = useNavigate();
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: 0.1 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => navigate(citation.path)}
      title={`Open evidence: ${citation.label}`}
      className="mx-0.5 inline-flex translate-y-[-1px] items-center gap-1 rounded-ares border border-ares-primary/60 bg-ares-card px-1.5 py-px align-middle text-[9px] font-light uppercase tracking-[0.08em] text-ares-primary transition-colors duration-200 hover:bg-ares-primary hover:text-white"
    >
      <Icon icon={icons.documentText} width={10} height={10} />
      {citation.label}
    </motion.button>
  );
}
