import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { HistoryItem } from './types';

function formatDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

/**
 * Left rail (ask.md §S1): conversation history, hairline-separated rows,
 * "+ New conversation" button. Deleting is local-only (MVP history is
 * fixture-backed — no delete endpoint exists).
 */
export default function HistoryRail({
  items,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  items: HistoryItem[];
  activeId: number | null;
  onSelect: (item: HistoryItem) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ares-border p-4">
        <p className="font-label text-ares-primary">Conversations</p>
        <button type="button" onClick={onNew} className="btn-secondary mt-3 w-full !py-2 text-[11px]">
          <Icon icon={icons.addCircle} width={14} height={14} />
          New conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <p className="p-4 text-[11px] font-light text-ares-muted">No past conversations yet.</p>
        )}
        <ul>
          {items.map((item, i) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'group relative border-b border-ares-border',
                activeId === item.id && 'bg-ares-primary/[0.06]'
              )}
            >
              {activeId === item.id && (
                <span className="absolute left-0 top-0 h-full w-[2px] bg-ares-primary" />
              )}
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full flex-col gap-0.5 px-4 py-3 text-left"
              >
                <span className="line-clamp-2 text-[11px] font-light leading-4 text-ares-secondarytext">
                  {item.title}
                </span>
                <span className="text-[10px] font-light text-ares-muted">{formatDate(item.date)}</span>
              </button>
              <button
                type="button"
                aria-label={`Delete "${item.title}"`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                className="absolute right-2 top-2 hidden text-ares-muted transition-colors duration-200 hover:text-ares-primary group-hover:block"
              >
                <Icon icon={icons.closeCircle} width={15} height={15} />
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
