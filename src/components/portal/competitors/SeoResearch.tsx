import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CompetitorRef } from './GapDiagnostics';

const fmtVolume = (v: number) => v.toLocaleString('en-US');

/** HH:mm from an ISO timestamp (local time). */
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Data provenance badge — live / cached / sample, per competitors.md §S4. */
function DataSourceBadge({
  dataSource,
  fetchedAt,
}: {
  dataSource: 'live' | 'cache' | 'sample';
  fetchedAt: string | null;
}) {
  const label =
    dataSource === 'live'
      ? `Live data${fetchedAt ? ` · ${fmtTime(fetchedAt)}` : ''}`
      : dataSource === 'cache'
        ? `Cached${fetchedAt ? ` · ${fmtTime(fetchedAt)}` : ''}`
        : 'Sample data';
  return (
    <span
      className={cn(
        'badge-pill',
        dataSource === 'live' && 'border-ares-primary/40 text-ares-primary',
        dataSource === 'cache' && 'text-ares-secondarytext',
        dataSource === 'sample' && 'text-ares-muted'
      )}
    >
      {label}
    </span>
  );
}

/**
 * DataForSEO research views (competitors.md §S4): SERP overlap, keyword gaps,
 * backlinks — one click from each competitor via the chip selector.
 */
export default function SeoResearch({
  competitors,
  value,
  onValueChange,
  onToast,
}: {
  competitors: CompetitorRef[];
  value: number;
  onValueChange: (brandId: number) => void;
  onToast: (msg: string) => void;
}) {
  const query = trpc.competitors.seoResearch.useQuery(
    { brandId: value },
    { enabled: competitors.length > 0 }
  );
  const data = query.data && query.data.available ? query.data : null;

  return (
    <section className="rounded-ares border border-ares-border bg-ares-card p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="font-label text-ares-primary">Research · DataForSEO</p>
          {query.data && (
            <DataSourceBadge dataSource={query.data.dataSource} fetchedAt={query.data.fetchedAt} />
          )}
        </div>
        {/* Competitor selector chips */}
        <div className="flex flex-wrap items-center gap-2">
          {competitors.map((c) => (
            <button
              key={c.brandId}
              type="button"
              onClick={() => onValueChange(c.brandId)}
              className={cn(
                'badge-pill transition-colors duration-150',
                c.brandId === value
                  ? 'border-ares-primary text-ares-primary'
                  : 'text-ares-muted hover:border-ares-primary hover:text-ares-primary'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading && (
        <div className="space-y-3">
          <div className="h-8 animate-pulse rounded-ares bg-ares-secondary/60" />
          <div className="h-36 animate-pulse rounded-ares bg-ares-secondary/60" />
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
          Research data couldn't be loaded right now.
        </div>
      )}
      {query.data && !data && (
        <div className="rounded-ares border border-ares-border p-4 text-[12px] text-ares-muted">
          No DataForSEO research cached for {query.data.name} yet — it refreshes weekly.
        </div>
      )}

      {data && (
        <Tabs defaultValue="serp" className="gap-5">
          <TabsList className="inline-flex h-auto w-full items-end justify-start gap-6 rounded-none border-b border-ares-border bg-transparent p-0">
            {[
              { v: 'serp', label: 'SERP overlap' },
              { v: 'keywords', label: 'Keyword gaps' },
              { v: 'backlinks', label: 'Backlinks' },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="-mb-px h-auto flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-2.5 text-[12px] font-light uppercase tracking-[0.04em] text-ares-muted shadow-none transition-colors duration-200 hover:text-ares-primary focus-visible:ring-0 data-[state=active]:border-ares-primary data-[state=active]:bg-transparent data-[state=active]:text-ares-primary data-[state=active]:shadow-none"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* SERP overlap */}
          <TabsContent value="serp" className="flex-none">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Keyword</th>
                    <th className="w-28">Northwind pos.</th>
                    <th className="w-28">{data.name} pos.</th>
                    <th className="w-24 text-right">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {data.serpOverlap.map((r, i) => (
                    <motion.tr
                      key={r.keyword}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                    >
                      <td className="text-ares-secondarytext">{r.keyword}</td>
                      <td
                        className={cn(
                          r.tenantPos < r.competitorPos
                            ? 'font-normal text-ares-primary'
                            : 'text-ares-secondarytext'
                        )}
                      >
                        {r.tenantPos}
                      </td>
                      <td
                        className={cn(
                          r.competitorPos < r.tenantPos
                            ? 'font-normal text-ares-primary'
                            : 'text-ares-secondarytext'
                        )}
                      >
                        {r.competitorPos}
                      </td>
                      <td className="text-right text-ares-muted">{fmtVolume(r.volume)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Keyword gaps */}
          <TabsContent value="keywords" className="flex-none">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Keyword</th>
                    <th className="w-24">{data.name} pos.</th>
                    <th className="w-24 text-right">Volume</th>
                    <th className="w-24">Difficulty</th>
                    <th className="w-32" />
                  </tr>
                </thead>
                <tbody>
                  {data.keywordGaps.map((r, i) => (
                    <motion.tr
                      key={r.keyword}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="group"
                    >
                      <td className="text-ares-secondarytext">{r.keyword}</td>
                      <td className="font-normal text-ares-primary">{r.competitorPos}</td>
                      <td className="text-right text-ares-muted">{fmtVolume(r.volume)}</td>
                      <td>
                        <span
                          className={cn(
                            r.difficulty === 'High' && 'text-ares-primaryDark',
                            r.difficulty === 'Medium' && 'text-ares-primary',
                            r.difficulty === 'Low' && 'text-ares-muted'
                          )}
                        >
                          {r.difficulty}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => onToast('Prompt suggested — pending acceptance')}
                          className="text-[10px] uppercase tracking-[0.08em] text-ares-link transition-colors duration-150 hover:text-ares-primary"
                        >
                          + Add as prompt
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Backlinks */}
          <TabsContent value="backlinks" className="flex-none">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p className="text-[12px] text-ares-secondarytext">
                Referring domains:{' '}
                <span className="font-display-num text-[20px]">
                  {data.backlinks.competitorReferringDomains}
                </span>{' '}
                <span className="text-ares-muted">{data.name}</span>
              </p>
              <p className="text-[12px] text-ares-secondarytext">
                vs{' '}
                <span className="font-display-num text-[20px]">
                  {data.backlinks.tenantReferringDomains}
                </span>{' '}
                <span className="text-ares-muted">Northwind</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th className="w-24">Authority</th>
                    <th className="w-48">Links to</th>
                    <th className="w-36" />
                  </tr>
                </thead>
                <tbody>
                  {data.backlinks.rows.map((r, i) => {
                    const isGap = r.linksTo.length >= 2;
                    return (
                      <motion.tr
                        key={r.domain}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                      >
                        <td className="text-ares-secondarytext">
                          <span className="flex items-center gap-2">
                            {r.domain}
                            {isGap && (
                              <motion.span
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.15, delay: 0.2 + i * 0.04 }}
                                className="badge-pill border-ares-primary/40 text-ares-primary"
                              >
                                Citation gap
                              </motion.span>
                            )}
                          </span>
                        </td>
                        <td
                          className={cn(
                            r.authority === 'High' && 'text-ares-primaryDark',
                            r.authority === 'Medium' && 'text-ares-primary',
                            r.authority === 'Low' && 'text-ares-muted'
                          )}
                        >
                          {r.authority}
                        </td>
                        <td className="text-ares-muted">
                          {r.linksTo.map((n) => n.replace(' Capital', '').replace(' Partners', '').replace(' Group', '')).join(', ')}
                        </td>
                        <td className="text-right">
                          {isGap && (
                            <button
                              type="button"
                              onClick={() => onToast('Added to roadmap as a suggested card')}
                              className="text-[10px] uppercase tracking-[0.08em] text-ares-link transition-colors duration-150 hover:text-ares-primary"
                            >
                              + Add to roadmap
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <p className="mt-4 text-[10px] text-ares-muted">{data.cachedNote}</p>
        </Tabs>
      )}
    </section>
  );
}
