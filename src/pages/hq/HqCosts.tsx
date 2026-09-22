import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/portal/alerts/PageHeader';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';
import { PLAN_LABELS, type PlanTier } from '@contracts/constants';

type RangeKey = '7d' | '30d' | '90d' | 'all';

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

// Profit cue: positive uses signal #83D6FA; negative uses a warm muted tone
// kept desaturated to sit inside the navy/icy palette.
const PROFIT_POSITIVE = '#83D6FA';
const PROFIT_NEGATIVE = '#B0815B';

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function rangeParams(key: RangeKey): { from?: Date; to?: Date } {
  const def = RANGES.find((r) => r.key === key)!;
  if (def.days === null) return {};
  const to = new Date();
  const from = new Date(to.getTime() - def.days * 24 * 60 * 60 * 1000);
  return { from, to };
}

/** HQ Costs (Phase 1.5 §B): per-client revenue vs DataForSEO spend. */
export default function HqCosts() {
  const [range, setRange] = useState<RangeKey>('30d');
  const params = useMemo(() => rangeParams(range), [range]);
  const costs = trpc.hq.costs.useQuery(params);

  // Row selection — default: all selected (re-applied when data changes).
  const [selected, setSelected] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (costs.data) setSelected(new Set(costs.data.map((r) => r.tenantId)));
  }, [costs.data]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows = costs.data ?? [];
  const selectedRows = rows.filter((r) => selected.has(r.tenantId));
  const totals = selectedRows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.monthlyRevenue,
      cost: acc.cost + r.costTotal,
      profit: acc.profit + r.profit,
    }),
    { revenue: 0, cost: 0, profit: 0 }
  );
  const margin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : null;

  const exportCsv = () => {
    const header = ['Client', 'Plan', 'Status', 'Audit paid', 'Revenue', 'DataForSEO spend', 'Emails', 'Cost total', 'Profit'];
    const lines = selectedRows.map((r) =>
      [
        r.name,
        PLAN_LABELS[r.plan as PlanTier] ?? r.plan,
        r.status,
        r.auditPaid ? 'yes' : 'no',
        r.monthlyRevenue.toFixed(2),
        r.dataForSeoSpend.toFixed(4),
        String(r.emailCount),
        r.costTotal.toFixed(2),
        r.profit.toFixed(2),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hq-costs-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pb-24">
      <PageHeader eyebrow="HQ · Costs" title="Revenue vs delivery cost per client">
        <div className="flex items-center gap-1 rounded-ares border border-ares-border bg-ares-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                'rounded-ares px-3 py-1.5 text-[11px] font-light transition-colors',
                range === r.key
                  ? 'bg-ares-primary/[0.12] text-ares-primaryDark'
                  : 'text-ares-muted hover:text-ares-text'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          className="btn-secondary px-4 py-2 text-[12px]"
          disabled={selectedRows.length === 0}
          onClick={exportCsv}
        >
          <Icon icon={icons.downloadMinimalistic} width={14} height={14} />
          Export CSV
        </button>
      </PageHeader>

      {costs.isLoading && <LoadingBlock rows={6} />}
      {costs.error && <ErrorBlock message={costs.error.message} onRetry={() => costs.refetch()} />}

      {costs.data && (
        <div className="overflow-x-auto rounded-ares border border-ares-border bg-ares-card">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-ares-border">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-ares-primary"
                    aria-label="Select all clients"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={() =>
                      setSelected(
                        selected.size === rows.length
                          ? new Set()
                          : new Set(rows.map((r) => r.tenantId))
                      )
                    }
                  />
                </th>
                {['Client', 'Plan', 'Revenue', 'DataForSEO spend', 'Emails', 'Cost total', 'Profit'].map((h) => (
                  <th key={h} className="font-label px-4 py-3 text-ares-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.tenantId}
                  className={cn(
                    'border-b border-ares-border/50 last:border-0 hover:bg-ares-pageBg/60',
                    !selected.has(r.tenantId) && 'opacity-50'
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ares-primary"
                      aria-label={`Select ${r.name}`}
                      checked={selected.has(r.tenantId)}
                      onChange={() => toggle(r.tenantId)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/clients/${r.tenantId}`}
                      className="font-normal text-ares-text hover:text-ares-primary"
                    >
                      {r.name}
                    </Link>
                    <p className="text-[10px] font-light text-ares-muted">{r.status}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-pill text-ares-primaryDark">
                      {PLAN_LABELS[r.plan as PlanTier] ?? r.plan}
                    </span>
                    {r.plan === 'report' && (
                      <p className="mt-1 text-[10px] font-light text-ares-muted">
                        {r.auditPaid ? 'Audit paid' : 'Audit unpaid'}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ares-secondarytext">
                    {money(r.monthlyRevenue)}
                    {r.revenueNote === 'custom' && (
                      <span className="ml-1 text-[10px] text-ares-muted">(custom)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ares-secondarytext">
                    ${r.dataForSeoSpend.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-ares-secondarytext">{r.emailCount}</td>
                  <td className="px-4 py-3 text-ares-secondarytext">{money(r.costTotal)}</td>
                  <td className="px-4 py-3">
                    <span
                      className="font-normal"
                      style={{ color: r.profit >= 0 ? PROFIT_POSITIVE : PROFIT_NEGATIVE }}
                    >
                      {r.profit >= 0 ? '+' : '−'}{money(Math.abs(r.profit))}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-ares-muted">
                    No clients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sticky totals bar */}
      {costs.data && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ares-border bg-ares-tertiary text-white">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-1 px-6 py-3 text-[12px] font-light">
            <span>
              <span className="text-white/50">Selected</span>{' '}
              <span className="font-normal">{selectedRows.length}</span>
              <span className="text-white/50">/{rows.length} clients</span>
            </span>
            <span>
              <span className="text-white/50">Revenue</span>{' '}
              <span className="font-normal">{money(totals.revenue)}</span>
            </span>
            <span>
              <span className="text-white/50">Cost</span>{' '}
              <span className="font-normal">{money(totals.cost)}</span>
            </span>
            <span>
              <span className="text-white/50">Profit</span>{' '}
              <span
                className="font-normal"
                style={{ color: totals.profit >= 0 ? PROFIT_POSITIVE : PROFIT_NEGATIVE }}
              >
                {totals.profit >= 0 ? '+' : '−'}{money(Math.abs(totals.profit))}
              </span>
            </span>
            <span>
              <span className="text-white/50">Margin</span>{' '}
              <span className="font-normal">{margin === null ? '—' : `${margin.toFixed(1)}%`}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
