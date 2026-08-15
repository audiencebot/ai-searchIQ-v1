import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

export function formatMonthLabel(month: string, isBaseline: boolean): string {
  const [y, m] = month.split('-').map(Number);
  const label = new Date(y, (m ?? 1) - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  return isBaseline ? `${label} (Baseline)` : label;
}

/**
 * Month dropdown for the report toolbar (report.md §S1). Selecting a past
 * month swaps the sheet stack to that month's frozen snapshot.
 */
export default function MonthSelector({
  months,
  selected,
  onSelect,
}: {
  months: string[];
  selected: string;
  onSelect: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const isBaseline = (month: string) => months[months.length - 1] === month && months.length > 1;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-ares border border-ares-border bg-ares-surface px-2.5 py-1.5 text-[11px] font-light text-ares-secondarytext transition-colors duration-200 hover:border-ares-primary hover:text-ares-primary"
      >
        {formatMonthLabel(selected, isBaseline(selected))}
        <Icon
          icon={icons.altArrowDown}
          width={12}
          height={12}
          className={cn('transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-40 mt-1 w-[180px] rounded-ares border border-ares-border bg-ares-surface py-1 shadow-paper"
          >
            {months.map((month) => (
              <li key={month}>
                <button
                  type="button"
                  role="option"
                  aria-selected={month === selected}
                  onClick={() => {
                    onSelect(month);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-light transition-colors duration-150',
                    month === selected
                      ? 'bg-ares-primary/[0.06] text-ares-primary'
                      : 'text-ares-secondarytext hover:text-ares-primary'
                  )}
                >
                  {formatMonthLabel(month, isBaseline(month))}
                  {month === selected && <Icon icon={icons.checkCircle} width={12} height={12} />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
