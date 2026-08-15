import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';

type Entry = { name: string; domain?: string };

/**
 * Manage competitors modal (competitors.md §S5): paper dialog with the current
 * list, remove buttons, and an add form. Scores recompute on the next scan.
 */
export default function ManageCompetitorsModal({
  open,
  competitors,
  onClose,
  onToast,
}: {
  open: boolean;
  competitors: Entry[];
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<Entry[]>([]);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

  const list = [
    ...competitors.filter((c) => !removed.includes(c.name)),
    ...added.filter((c) => !removed.includes(c.name)),
  ];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdded((prev) => [...prev, { name: trimmed, domain: domain.trim() || undefined }]);
    setName('');
    setDomain('');
    onToast('Competitor added — scores recompute on the next daily scan');
  };

  return (
    <AnimatePresence>
      {open && (
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
              role="dialog"
              aria-modal="true"
              aria-label="Manage competitors"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto w-full max-w-[560px] rounded-ares border border-ares-border bg-ares-surface p-6 shadow-paper"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-label mb-1 text-ares-primary">Monitoring set</p>
                  <h2 className="font-display text-[20px]">Manage competitors.</h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-ares text-ares-muted transition-colors duration-200 hover:text-ares-primary"
                >
                  <Icon icon={icons.closeCircle} width={18} height={18} />
                </button>
              </div>

              {/* Current list */}
              <ul className="divide-y divide-ares-border border-y border-ares-border">
                {list.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-ares-secondarytext">{c.name}</p>
                      {c.domain && (
                        <p className="truncate text-[10px] text-ares-muted">{c.domain}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${c.name}`}
                      onClick={() => setRemoved((prev) => [...prev, c.name])}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ares text-ares-muted transition-colors duration-150 hover:text-ares-primaryDark"
                    >
                      <Icon icon={icons.trashBinMinimalistic} width={15} height={15} />
                    </button>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="py-4 text-center text-[11px] text-ares-muted">
                    No competitors in the monitoring set.
                  </li>
                )}
              </ul>

              {/* Add form */}
              <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
                <label className="min-w-[160px] flex-1">
                  <span className="font-label mb-1 block text-ares-muted">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Competitor name"
                    className="w-full rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[12px] font-light text-ares-text outline-none transition-colors duration-150 placeholder:text-ares-muted focus:border-ares-primary"
                  />
                </label>
                <label className="min-w-[160px] flex-1">
                  <span className="font-label mb-1 block text-ares-muted">Domain</span>
                  <input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="example.com"
                    className="w-full rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[12px] font-light text-ares-text outline-none transition-colors duration-150 placeholder:text-ares-muted focus:border-ares-primary"
                  />
                </label>
                <button type="submit" className="btn-primary !px-4 !py-2">
                  <Icon icon={icons.addCircle} width={14} height={14} />
                  Add
                </button>
              </form>

              <p className="mt-5 text-[10px] leading-relaxed text-ares-muted">
                Competitor suggestions come from SERP overlap at onboarding. Scores recompute on
                the next daily scan.
              </p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
