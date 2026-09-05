import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';
import { Reveal, Skeleton, useCountUp } from '@/components/portal/dashboard/shared';
import { cn } from '@/lib/utils';
import {
  CLASS_COLORS,
  CLASS_DESCRIPTIONS,
  CLASS_LABELS,
  type BotClass,
  type Summary,
} from './shared';

const ORDER: BotClass[] = ['training_crawl', 'citation_fetch', 'referral_visit'];

function TrendChip({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="badge-pill text-ares-muted">no prior data</span>;
  }
  const up = pct >= 0;
  return (
    <span
      className={cn(
        'badge-pill',
        up ? 'border-ares-primary text-ares-primary' : 'text-ares-muted'
      )}
    >
      <Icon icon={up ? icons.arrowUpLinear : icons.arrowDownLinear} width={11} height={11} />
      {up ? '+' : ''}
      {pct}% vs prior
    </span>
  );
}

function KpiCard({
  botClass,
  value,
  trend,
  delay,
  onSelect,
}: {
  botClass: BotClass;
  value: number;
  trend: number | null;
  delay: number;
  onSelect: (botClass: BotClass) => void;
}) {
  const display = useCountUp(value, 900, delay * 1000);
  return (
    <Reveal delay={delay} className="action-card p-5">
      <button type="button" onClick={() => onSelect(botClass)} className="block w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="font-label text-ares-muted">{CLASS_LABELS[botClass]}</p>
          <span
            className="h-[6px] w-[6px] rounded-full"
            style={{ background: CLASS_COLORS[botClass] }}
          />
        </div>
        <p className="font-display mt-3 text-[34px] leading-none text-ares-text">
          {display.toLocaleString()}
        </p>
        <p className="mt-2 text-[11px] font-light leading-snug text-ares-muted">
          {CLASS_DESCRIPTIONS[botClass]}
        </p>
        <div className="mt-3">
          <TrendChip pct={trend} />
        </div>
      </button>
    </Reveal>
  );
}

/** S2 — KPI cards: 30d totals per signal + trend vs prior period. */
export function KpiCards({
  data,
  isLoading,
  onSelect,
}: {
  data: Summary | undefined;
  isLoading: boolean;
  onSelect: (botClass: BotClass) => void;
}) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ORDER.map((c) => (
          <Skeleton key={c} className="h-[168px]" />
        ))}
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ORDER.map((c, i) => (
          <KpiCard
            key={c}
            botClass={c}
            value={data.totals[c]}
            trend={data.trend[c]}
            delay={i * 0.08}
            onSelect={onSelect}
          />
        ))}
      </div>
      {data.verified.pct !== null && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-light text-ares-muted">
          <Icon icon={icons.shieldCheck} width={13} height={13} className="text-ares-primary" />
          {data.verified.pct}% of captured requests IP-verified against vendor bot ranges —
          unverified (spoofed-UA) hits are kept out of headline metrics.
        </p>
      )}
    </div>
  );
}
