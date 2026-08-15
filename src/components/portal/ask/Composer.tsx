import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';

/**
 * Bottom-anchored composer (ask.md §S4): auto-growing textarea (Enter sends,
 * Shift+Enter newline), primary send button, grounding microcopy, and an
 * optional dismissible context chip.
 */
export default function Composer({
  disabled,
  contextLabel,
  onDismissContext,
  onSend,
}: {
  disabled: boolean;
  contextLabel?: string | null;
  onDismissContext?: () => void;
  onSend: (question: string) => void;
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const send = () => {
    const q = value.trim();
    if (!q || disabled) return;
    onSend(q);
    setValue('');
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="border-t border-ares-border bg-ares-surface p-4">
      {contextLabel && (
        <div className="mb-2 flex">
          <span className="badge-pill text-ares-muted">
            Context: {contextLabel}
            <button
              type="button"
              aria-label="Dismiss context"
              onClick={onDismissContext}
              className="ml-0.5 text-ares-muted transition-colors duration-200 hover:text-ares-primary"
            >
              <Icon icon={icons.closeCircle} width={11} height={11} />
            </button>
          </span>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow();
          }}
          onKeyDown={onKeyDown}
          placeholder="Ask about your scores, competitors, alerts, or plan…"
          aria-label="Ask AI Search IQ a question"
          className="max-h-[140px] flex-1 resize-none rounded-ares border border-ares-border bg-ares-card px-3 py-2.5 text-[12px] font-light leading-5 text-ares-text placeholder:text-ares-muted focus:border-ares-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={disabled || value.trim().length === 0}
          aria-label="Send question"
          className="btn-primary !px-3 !py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon icon={icons.plain2} width={16} height={16} />
        </button>
      </div>
      <p className="mt-2 text-[9px] font-light text-ares-muted">
        Grounded in your tenant&apos;s data only · Answers cite their sources
      </p>
    </div>
  );
}
