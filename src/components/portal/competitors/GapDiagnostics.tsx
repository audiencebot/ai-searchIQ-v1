import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type CompetitorRef = { brandId: number; name: string };

/**
 * Per-competitor gap diagnostics (competitors.md §S3): tab group with
 * headline stats + prompts where the competitor appears and Northwind doesn't.
 */
export default function GapDiagnostics({
  competitors,
  value,
  onValueChange,
}: {
  competitors: CompetitorRef[];
  value: number;
  onValueChange: (brandId: number) => void;
}) {
  const navigate = useNavigate();
  const query = trpc.competitors.gapDiagnostics.useQuery(
    { brandId: value },
    { enabled: competitors.length > 0 }
  );

  return (
    <section className="rounded-ares border border-ares-border bg-ares-card p-4 md:p-6">
      <p className="font-label mb-4 text-ares-primary">Gap diagnostics · per competitor</p>

      <Tabs
        value={String(value)}
        onValueChange={(v) => onValueChange(Number(v))}
        className="gap-5"
      >
        <TabsList className="inline-flex h-auto w-full items-end justify-start gap-6 rounded-none border-b border-ares-border bg-transparent p-0">
          {competitors.map((c) => (
            <TabsTrigger
              key={c.brandId}
              value={String(c.brandId)}
              className="-mb-px h-auto flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-2.5 text-[12px] font-light uppercase tracking-[0.04em] text-ares-muted shadow-none transition-colors duration-200 hover:text-ares-primary focus-visible:ring-0 data-[state=active]:border-ares-primary data-[state=active]:bg-transparent data-[state=active]:text-ares-primary data-[state=active]:shadow-none"
            >
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {competitors.map((c) => (
          <TabsContent key={c.brandId} value={String(c.brandId)} className="flex-none">
            <AnimatePresence mode="wait">
              {query.isLoading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3 py-2"
                >
                  <div className="h-16 animate-pulse rounded-ares bg-ares-secondary/60" />
                  <div className="h-28 animate-pulse rounded-ares bg-ares-secondary/60" />
                </motion.div>
              )}
              {query.isError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2.5 rounded-ares border border-ares-border bg-ares-card p-4 text-[12px] text-ares-secondarytext"
                >
                  <Icon
                    icon={icons.dangerTriangle}
                    width={16}
                    height={16}
                    className="shrink-0 text-ares-primaryDark"
                  />
                  Gap diagnostics couldn't be loaded. Try again after the next scan.
                </motion.div>
              )}
              {query.data && (
                <motion.div
                  key={query.data.brandId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="grid gap-6 lg:grid-cols-[280px_1fr]"
                >
                  {/* Left: stat row */}
                  <div className="space-y-5">
                    <div>
                      <p className="font-label mb-1.5 text-ares-muted">
                        Appears where you're absent
                      </p>
                      <p className="font-display-num text-[24px]">
                        {query.data.gapShare ?? '—'}
                        {query.data.gapShare !== null && '%'}
                      </p>
                      <p className="mt-1 text-[10px] text-ares-muted">
                        of {query.data.gapCategory?.replace(/_/g, ' ') ?? 'monitored'} prompts
                      </p>
                    </div>
                    <div className="section-rule" />
                    <div>
                      <p className="font-label mb-1.5 text-ares-muted">Their strongest category</p>
                      <p className="font-body text-ares-secondarytext">
                        {query.data.strongestCategory ?? '—'}{' '}
                        {query.data.strongestCategoryStat && (
                          <span className="text-ares-primary">
                            ({query.data.strongestCategoryStat})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right: prompts table */}
                  <div>
                    <p className="font-label mb-2 text-ares-muted">
                      Prompts where {query.data.name} appears and Northwind doesn't
                    </p>
                    <div className="overflow-x-auto rounded-ares border border-ares-border">
                      <table className="data-table min-w-[480px]">
                        <thead>
                          <tr>
                            <th>Prompt</th>
                            <th className="w-40">Engine</th>
                            <th className="w-28">Their position</th>
                          </tr>
                        </thead>
                        <tbody>
                          {query.data.promptsWhereAbsent.map((p, i) => (
                            <motion.tr
                              key={`${p.promptId}:${p.engine}`}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: i * 0.04 }}
                              className="group cursor-pointer transition-colors duration-150 hover:bg-ares-primary/[0.04]"
                              onClick={() => navigate('/app/monitoring')}
                              title="View response in Prompt Monitoring"
                            >
                              <td className="text-ares-secondarytext">
                                <span className="flex items-center gap-2">
                                  {p.prompt}
                                  <Icon
                                    icon={icons.eye}
                                    width={13}
                                    height={13}
                                    className="shrink-0 text-ares-link opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                                  />
                                </span>
                              </td>
                              <td className="text-ares-muted">{p.engineLabel}</td>
                              <td className="font-normal text-ares-primary">
                                {p.theirPosition ? `#${p.theirPosition}` : '—'}
                              </td>
                            </motion.tr>
                          ))}
                          {query.data.promptsWhereAbsent.length === 0 && (
                            <tr>
                              <td colSpan={3} className="text-center text-ares-muted">
                                No gap prompts in the latest scan.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Insight line spans both columns */}
                  {query.data.insight && (
                    <p className="border-l-2 border-ares-primary pl-3 text-[12px] leading-[19.5px] text-ares-secondarytext lg:col-span-2">
                      {query.data.insight}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
