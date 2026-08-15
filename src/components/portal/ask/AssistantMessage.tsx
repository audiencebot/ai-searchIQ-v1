import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import CitationChip from './CitationChip';
import type { ChatMessage } from './types';

type AssistantMsg = Extract<ChatMessage, { role: 'assistant' }>;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Three-dot terracotta pulse (ask.md §S3 typing state, 1.2s loop). */
export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <Icon icon={icons.radar2} width={16} height={16} className="mt-0.5 shrink-0 text-ares-primary" />
      <div className="flex items-center gap-1.5 py-1.5" aria-label="AI Search IQ is thinking">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-ares-primary"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Assistant block (ask.md §S3): un-bubbled editorial style with radar avatar,
 * inline citation chips, per-answer footer (helpful / not-helpful / copy /
 * timestamp) and suggested follow-up chips.
 */
export default function AssistantMessage({
  message,
  onFeedback,
  onFollowUp,
}: {
  message: AssistantMsg;
  onFeedback: (id: string, feedback: 'up' | 'down') => void;
  onFollowUp: (question: string) => void;
}) {
  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      toast('Copied to clipboard');
    } catch {
      toast('Copy failed — select the text instead');
    }
  };

  const sendFeedback = (feedback: 'up' | 'down') => {
    if (message.feedback === feedback) return;
    onFeedback(message.id, feedback);
    toast('Thanks — logged for review');
  };

  const isRefusal = message.kind === 'refusal';
  const isInsufficient = message.kind === 'insufficient';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="flex items-start gap-2.5"
    >
      <Icon icon={icons.radar2} width={16} height={16} className="mt-0.5 shrink-0 text-ares-primary" />
      <div className="min-w-0 flex-1">
        {isRefusal ? (
          /* Cross-tenant / off-limits probe → refusal card (.alert-row info) */
          <div className="rounded-ares border border-ares-border border-l-[3px] border-l-ares-muted bg-ares-card p-4">
            <div className="flex items-start gap-2.5">
              <Icon icon={icons.infoCircle} width={18} height={18} className="mt-0.5 shrink-0 text-ares-muted" />
              <p className="font-body text-[12px] leading-5 text-ares-secondarytext">{message.text}</p>
            </div>
          </div>
        ) : (
          <div className="font-body text-[12px] leading-5 text-ares-secondarytext">
            {isInsufficient && (
              <span className="mb-2 flex items-center gap-1.5 text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted">
                <Icon icon={icons.infoCircle} width={12} height={12} />
                Insufficient data
              </span>
            )}
            <p>
              {message.text}
              {message.citations.length > 0 && (
                <span className="inline">
                  {' '}
                  {message.citations.map((c, i) => (
                    <CitationChip key={`${c.label}-${i}`} citation={c} index={i} />
                  ))}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Per-answer footer */}
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => sendFeedback('up')}
            aria-label="Helpful"
            className={cn(
              'flex items-center justify-center transition-colors duration-200',
              message.feedback === 'up' ? 'text-ares-primary' : 'text-ares-muted hover:text-ares-primary'
            )}
          >
            <Icon icon={icons.likeLinear} width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={() => sendFeedback('down')}
            aria-label="Not helpful"
            className={cn(
              'flex items-center justify-center transition-colors duration-200',
              message.feedback === 'down' ? 'text-ares-primary' : 'text-ares-muted hover:text-ares-primary'
            )}
          >
            <Icon icon={icons.dislikeLinear} width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={copyAnswer}
            className="flex items-center gap-1 text-[10px] font-light uppercase tracking-[0.08em] text-ares-muted transition-colors duration-200 hover:text-ares-primary"
          >
            <Icon icon={icons.copyLinear} width={12} height={12} />
            Copy
          </button>
          <span className="text-[10px] font-light text-ares-muted">{formatTime(message.at)}</span>
        </div>

        {/* Suggested follow-ups */}
        {message.followUps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.followUps.map((q, i) => (
              <motion.button
                key={q}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.15 + i * 0.06, ease: EASE }}
                onClick={() => onFollowUp(q)}
                className="badge-pill text-ares-secondarytext transition-colors duration-200 hover:border-ares-primary hover:text-ares-primary"
              >
                {q}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
