import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type SourceRow = {
  id: number;
  name: string;
  type: string;
  typeLabel: string;
  authority: 'high' | 'medium' | 'low';
  status: 'present' | 'missing';
  impact: 'high' | 'medium' | 'low' | null;
  url: string | null;
  whyItMatters: string | null;
};

type Filter = 'all' | 'missing' | 'present';

const PRESENT_ACTIONS: Record<string, string> = {
  reviews: 'View citations',
  listing: 'View listing',
  knowledge: 'View entry',
  article: 'View article',
  directory: 'View listing',
};

const AUTHORITY_DOTS: Record<string, number> = { high: 3, medium: 2, low: 1 };

function AuthorityCell({ authority }: { authority: 'high' | 'medium' | 'low' }) {
  const filled = AUTHORITY_DOTS[authority] ?? 0;
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          'capitalize',
          authority === 'high' && 'text-ares-secondarytext',
          authority === 'medium' && 'text-ares-secondarytext',
          authority === 'low' && 'text-ares-muted'
        )}
      >
        {authority}
      </span>
      <span className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              i < filled ? 'bg-ares-primary' : 'bg-ares-secondary'
            )}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * Source gap table (citations.md §S3): 22 monitored sources with filter
 * chips, authority meter, status styling, and row actions.
 */
export default function SourceTable({
  sources,
  onOpenSource,
  onToast,
}: {
  sources: SourceRow[];
  onOpenSource: (sourceId: number) => void;
  onToast: (msg: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const counts = {
    all: sources.length,
    missing: sources.filter((s) => s.status === 'missing').length,
    present: sources.filter((s) => s.status === 'present').length,
  };
  const rows = filter === 'all' ? sources : sources.filter((s) => s.status === filter);

  return (
    <section className="rounded-ares border border-ares-border bg-ares-card p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-label text-ares-primary">Monitored sources</p>
        <div className="flex items-center gap-2">
          {(['all', 'missing', 'present'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'badge-pill transition-colors duration-150',
                filter === f
                  ? 'border-ares-primary text-ares-primary'
                  : 'text-ares-muted hover:border-ares-primary hover:text-ares-primary'
              )}
            >
              {f === 'all' ? 'All' : f === 'missing' ? 'Missing' : 'Present'} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[720px]">
          <thead>
            <tr>
              <th>Source</th>
              <th className="w-28">Type</th>
              <th className="w-32">Authority</th>
              <th className="w-24">Status</th>
              <th className="w-24">Impact</th>
              <th className="w-36 text-right">Action</th>
            </tr>
          </thead>
          <AnimatePresence mode="wait" initial={false}>
            <motion.tbody
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {rows.map((s, i) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  className="cursor-pointer transition-colors duration-150 hover:bg-ares-primary/[0.04]"
                  onClick={() => onOpenSource(s.id)}
                >
                  <td className="text-ares-secondarytext">{s.name}</td>
                  <td className="text-ares-muted">{s.typeLabel}</td>
                  <td>
                    <AuthorityCell authority={s.authority} />
                  </td>
                  <td>
                    <span
                      className={cn(
                        s.status === 'missing'
                          ? 'font-normal text-ares-primary'
                          : 'text-ares-secondarytext'
                      )}
                    >
                      {s.status === 'missing' ? 'Missing' : 'Present'}
                    </span>
                  </td>
                  <td>
                    {s.impact ? (
                      <span
                        className={cn(
                          s.impact === 'high' && 'text-ares-primaryDark',
                          s.impact === 'medium' && 'text-ares-primary',
                          s.impact === 'low' && 'text-ares-muted'
                        )}
                      >
                        {s.impact[0].toUpperCase() + s.impact.slice(1)}
                      </span>
                    ) : (
                      <span className="text-ares-muted">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    {s.status === 'missing' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToast('Added to roadmap as a suggested card');
                        }}
                        className="text-[10px] uppercase tracking-[0.08em] text-ares-link transition-colors duration-150 hover:text-ares-primary"
                      >
                        + Add to roadmap
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSource(s.id);
                        }}
                        className="text-[10px] uppercase tracking-[0.08em] text-ares-link transition-colors duration-150 hover:text-ares-primary"
                      >
                        {PRESENT_ACTIONS[s.type] ?? 'View citations'}
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-ares-muted">
                    No sources match this filter.
                  </td>
                </tr>
              )}
            </motion.tbody>
          </AnimatePresence>
        </table>
      </div>
    </section>
  );
}
