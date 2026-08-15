import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

const ENGINE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
  ai_overviews: 'Google AI Overviews',
  ai_search: 'AI Search',
};

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

const TYPE_LABELS: Record<string, string> = {
  directory: 'Directory',
  article: 'Article',
  listing: 'Listing',
  reviews: 'Reviews',
  knowledge: 'Knowledge',
};

/**
 * Source detail drawer (citations.md §S3 row click): 460px right drawer with
 * source meta, "Why it matters", citation instances, and a recommended-action
 * block for missing sources.
 */
export default function SourceDrawer({
  sourceId,
  onClose,
  onToast,
}: {
  sourceId: number | null;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const query = trpc.citations.sourceDetail.useQuery(
    { sourceId: sourceId ?? 0 },
    { enabled: sourceId !== null }
  );
  const detail = query.data ?? null;
  const source = detail?.source ?? null;
  const missing = source?.status === 'missing';

  return (
    <AnimatePresence>
      {sourceId !== null && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-ares-tertiary/30"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 460 }}
            animate={{ x: 0 }}
            exit={{ x: 460 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-ares-border bg-ares-surface"
          >
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b border-ares-border px-5">
              <div className="flex items-center gap-2.5">
                <Icon icon={icons.linkLinear} width={18} height={18} className="text-ares-primary" />
                <span className="font-display text-[15px]">Source detail</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close source detail"
                className="flex h-8 w-8 items-center justify-center rounded-ares text-ares-muted transition-colors duration-200 hover:text-ares-primary"
              >
                <Icon icon={icons.closeCircle} width={18} height={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {query.isLoading && (
                <div className="space-y-3">
                  <div className="h-6 w-48 animate-pulse rounded-ares bg-ares-secondary/60" />
                  <div className="h-20 animate-pulse rounded-ares bg-ares-secondary/60" />
                  <div className="h-32 animate-pulse rounded-ares bg-ares-secondary/60" />
                </div>
              )}
              {query.isError && (
                <div className="flex items-center gap-2.5 rounded-ares border border-ares-border p-4 text-[12px] text-ares-secondarytext">
                  <Icon
                    icon={icons.dangerTriangle}
                    width={16}
                    height={16}
                    className="shrink-0 text-ares-primaryDark"
                  />
                  Source detail couldn't be loaded.
                </div>
              )}
              {source && (
                <div className="space-y-6">
                  {/* Meta */}
                  <div>
                    <h3 className="font-display text-[18px]">{source.name}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="badge-pill text-ares-muted">
                        {TYPE_LABELS[source.type] ?? source.type}
                      </span>
                      <span className="badge-pill text-ares-muted">
                        {source.authority} authority
                      </span>
                      <span
                        className={cn(
                          'badge-pill',
                          missing
                            ? 'border-ares-primary/40 font-normal text-ares-primary'
                            : 'text-ares-secondarytext'
                        )}
                      >
                        {missing ? 'Missing' : 'Present'}
                      </span>
                    </div>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-ares-link transition-colors duration-150 hover:text-ares-primary"
                      >
                        <Icon icon={icons.globalLinear} width={13} height={13} />
                        {source.url.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>

                  {/* Why it matters */}
                  {source.whyItMatters && (
                    <div>
                      <p className="font-label mb-2 text-ares-primary">Why it matters</p>
                      <p className="text-[12px] leading-[19.5px] text-ares-secondarytext">
                        {source.whyItMatters}
                      </p>
                    </div>
                  )}

                  {/* Citation instances */}
                  <div>
                    <p className="font-label mb-2 text-ares-muted">Citation instances</p>
                    {detail && detail.instances.length > 0 ? (
                      <div className="overflow-x-auto rounded-ares border border-ares-border">
                        <table className="data-table min-w-[380px]">
                          <thead>
                            <tr>
                              <th className="w-16">Scan date</th>
                              <th className="w-24">Engine</th>
                              <th>URL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.instances.map((c) => (
                              <tr key={c.id}>
                                <td className="text-ares-muted">{fmtDate(c.createdAt)}</td>
                                <td className="text-ares-secondarytext">
                                  {ENGINE_LABELS[c.engine] ?? c.engine}
                                </td>
                                <td className="max-w-[180px] truncate text-ares-link">
                                  {c.citedUrl.replace(/^https?:\/\//, '')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="rounded-ares border border-ares-border p-3 text-[11px] text-ares-muted">
                        No citations recorded from this source yet.
                      </p>
                    )}
                  </div>

                  {/* Recommended action for missing sources */}
                  {missing && (
                    <div className="rounded-ares border border-ares-border border-l-[3px] border-l-ares-primary bg-ares-card p-4">
                      <div className="flex items-start gap-2.5">
                        <Icon
                          icon={icons.infoCircle}
                          width={18}
                          height={18}
                          className="mt-0.5 shrink-0 text-ares-primary"
                        />
                        <div>
                          <p className="font-label mb-1 text-ares-muted">Recommended action</p>
                          <p className="text-[12px] leading-[19.5px] text-ares-secondarytext">
                            Claim and complete this listing; AI engines weight it heavily for
                            professional-services queries.
                          </p>
                          <button
                            type="button"
                            className="btn-primary mt-3 !px-4 !py-2"
                            onClick={() => onToast('Added to roadmap as a suggested card')}
                          >
                            <Icon icon={icons.addCircle} width={14} height={14} />
                            Add to roadmap
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
