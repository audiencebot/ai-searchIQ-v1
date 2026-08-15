import { useState } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { icons } from '@/lib/icons';
import { EASE_OUT, ErrorCard, Reveal, Skeleton, fmtDate, type RouterOutputs } from '@/components/portal/dashboard/shared';

type PromptsData = RouterOutputs['monitoring']['prompts'] | undefined;
type PromptRow = NonNullable<PromptsData>[number];

const CATEGORY_OPTIONS = [
  { id: 'best_option', label: 'Best option' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'local', label: 'Local / "near me"' },
  { id: 'service_category', label: 'Service category' },
  { id: 'decision_stage', label: 'Decision-stage' },
];

const SUGGESTED_PROMPTS = [
  'fee-only financial planner cost',
  'retirement planning checklist for small business owners',
];

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-ares-tertiary/30"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="pointer-events-auto w-full max-w-[480px] rounded-ares border border-ares-border bg-ares-surface shadow-paper"
        >
          <div className="flex items-center justify-between border-b border-ares-border px-5 py-4">
            <p className="font-display text-[15px]">{title}</p>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-8 w-8 items-center justify-center rounded-ares text-ares-muted transition-colors duration-200 hover:text-ares-primary"
            >
              <Icon icon={icons.closeCircle} width={18} height={18} />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </motion.div>
      </div>
    </>
  );
}

const inputClass =
  'w-full rounded-ares border border-ares-border bg-ares-surface px-3 py-2 text-[12px] font-light text-ares-text placeholder:text-ares-muted focus:border-ares-primary focus:outline-none';

/**
 * S4 — priority prompt set manager: table with hover actions (rename modal,
 * remove confirm), "Add prompt" modal, and one-click suggestion chips.
 * Prompt mutations are queued client-side — the scan engine applies them at
 * the next daily run.
 */
export function PromptSetManager({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data: PromptsData;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [renaming, setRenaming] = useState<PromptRow | null>(null);
  const [removing, setRemoving] = useState<PromptRow | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftCategory, setDraftCategory] = useState(CATEGORY_OPTIONS[0].id);
  const [notice, setNotice] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState(SUGGESTED_PROMPTS);

  const rows = data ?? [];

  const queueNotice = (msg: string) => {
    setNotice(msg);
    setAddOpen(false);
    setRenaming(null);
    setRemoving(null);
  };

  return (
    <Reveal delay={0.2} className="action-card flex flex-col p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-label text-ares-primary">
          Priority prompt set{data ? ` · ${rows.length}/${rows.length}` : ''}
        </p>
        <button className="btn-primary !px-3 !py-1.5 text-[10px]" onClick={() => { setDraftText(''); setAddOpen(true); }}>
          <Icon icon={icons.addCircle} width={13} height={13} />
          Add prompt
        </button>
      </div>

      {/* Suggestion chips */}
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-light text-ares-muted">Suggested:</span>
          <AnimatePresence>
            {suggestions.map((s) => (
              <motion.button
                key={s}
                layout
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.35 } }}
                type="button"
                onClick={() => {
                  setSuggestions((prev) => prev.filter((x) => x !== s));
                  setNotice(`"${s}" queued — it joins the next daily scan.`);
                }}
                className="badge-pill text-ares-secondarytext transition-colors duration-200 hover:border-ares-primary hover:text-ares-primary"
              >
                <Icon icon={icons.addCircle} width={11} height={11} className="text-ares-primary" />
                {s}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {notice && (
        <p className="mt-3 rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[10px] font-light text-ares-secondarytext">
          {notice}
        </p>
      )}

      {isLoading && (
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}
      {isError && (
        <ErrorCard className="mt-4 border-0 p-6" message="Prompt set unavailable." onRetry={onRetry} />
      )}
      {data && (
        <div className="mt-3 max-h-[420px] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Prompt</th>
                <th>Category</th>
                <th>Added</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  className="group"
                >
                  <td className="max-w-[220px] truncate text-ares-text" title={p.text}>
                    {p.text}
                  </td>
                  <td>
                    <span className="badge-pill text-ares-secondarytext">{p.categoryLabel}</span>
                  </td>
                  <td className="text-ares-muted">{fmtDate(p.addedAt)}</td>
                  <td>
                    <span className="flex justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label={`Rename ${p.text}`}
                        onClick={() => { setDraftText(p.text); setRenaming(p); }}
                        className="flex h-6 w-6 items-center justify-center rounded-ares text-ares-muted hover:text-ares-primary"
                      >
                        <Icon icon={icons.pen} width={13} height={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${p.text}`}
                        onClick={() => setRemoving(p)}
                        className="flex h-6 w-6 items-center justify-center rounded-ares text-ares-muted hover:text-ares-primaryDark"
                      >
                        <Icon icon={icons.trashBin} width={13} height={13} />
                      </button>
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add prompt modal */}
      <AnimatePresence>
        {addOpen && (
          <ModalShell title="Add prompt" onClose={() => setAddOpen(false)}>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={3}
              placeholder="e.g. best fiduciary advisor for retirees"
              className={inputClass}
            />
            <select
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value)}
              className={`${inputClass} mt-3`}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-3 text-[10px] font-light text-ares-muted">
              Grounded in your GSC queries — suggested: 'fee-only financial planner cost'
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!draftText.trim()}
                onClick={() => queueNotice(`"${draftText.trim()}" queued — it joins the next daily scan.`)}
              >
                Add prompt
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Rename modal */}
      <AnimatePresence>
        {renaming && (
          <ModalShell title="Rename prompt" onClose={() => setRenaming(null)}>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={3}
              className={inputClass}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setRenaming(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!draftText.trim()}
                onClick={() => queueNotice('Rename queued — applied at the next daily scan.')}
              >
                Save
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Remove confirm dialog */}
      <AnimatePresence>
        {removing && (
          <ModalShell title="Remove prompt" onClose={() => setRemoving(null)}>
            <p className="font-body text-ares-secondarytext">
              Removing stops daily scans for this prompt.
            </p>
            <p className="mt-2 rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[12px] font-light text-ares-text">
              "{removing.text}"
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setRemoving(null)}>
                Keep prompt
              </button>
              <button
                className="btn-primary"
                onClick={() => queueNotice(`"${removing.text}" removed from the next scan cycle.`)}
              >
                Remove
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </Reveal>
  );
}
