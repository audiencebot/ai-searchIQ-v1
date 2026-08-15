import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { ErrorCard, Reveal, Skeleton, fmtDate, fmtDateLong, type RouterOutputs } from './shared';

type TrendData = RouterOutputs['dashboard']['trend'] | undefined;
type Point = NonNullable<TrendData>['points'][number];

const SERIES = [
  { key: 'composite', label: 'Composite', color: '#CB4D22', width: 2 },
  { key: 'mentionRate', label: 'Mention rate', color: '#8A7A6E', width: 1.5 },
  { key: 'recommendationShare', label: 'Recommendation share', color: '#7A6458', width: 1.5 },
  { key: 'citationStrength', label: 'Citation strength', color: '#B33F19', width: 1.5 },
  { key: 'promptCoverage', label: 'Prompt coverage', color: '#3E2923', width: 1.5 },
  { key: 'sentimentAccuracy', label: 'Sentiment accuracy', color: '#C89B7B', width: 1.5 },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Point & { label: string }; dataKey: string; value: number; color: string }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-ares border border-ares-border bg-ares-card p-3 shadow-paper">
      <p className="font-label text-ares-muted">{fmtDateLong(point.date)} scan</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-[11px] font-light">
            <span className="h-[2px] w-3 rounded-ares" style={{ background: entry.color }} />
            <span className="text-ares-secondarytext">
              {SERIES.find((s) => s.key === entry.dataKey)?.label ?? entry.dataKey}
            </span>
            <span className="ml-auto pl-3 font-normal text-ares-primary">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** S4 — full-width Recharts trend card with toggleable series chips. */
export function TrendChart({
  days,
  data,
  isLoading,
  isError,
  onRetry,
}: {
  days: number;
  data: TrendData;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [active, setActive] = useState<SeriesKey[]>(['composite', 'mentionRate', 'recommendationShare']);

  const chartRows = useMemo(
    () => (data?.points ?? []).map((p) => ({ ...p, label: fmtDate(p.date) })),
    [data]
  );
  const baselineLabel = chartRows.at(0)?.label;

  const toggle = (key: SeriesKey) =>
    setActive((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Reveal delay={0.15} className="action-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-label text-ares-primary">Visibility trend</p>
        <div className="flex flex-wrap gap-1.5">
          {SERIES.map((s) => {
            const on = active.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                className={cn(
                  'badge-pill transition-colors duration-200',
                  on
                    ? 'border-ares-primary text-ares-primary'
                    : 'text-ares-muted hover:text-ares-secondarytext'
                )}
              >
                <span
                  className="h-[2px] w-3 rounded-ares"
                  style={{ background: on ? s.color : '#EAE0D6' }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && <Skeleton className="mt-6 h-[280px] w-full" />}
      {isError && (
        <ErrorCard className="mt-6 border-0" message="Trend data unavailable." onRetry={onRetry} />
      )}
      {data && chartRows.length < 2 && (
        <div className="mt-6 flex h-[280px] flex-col items-center justify-center gap-3 rounded-ares border border-ares-border bg-ares-card">
          <p className="font-body text-ares-muted">
            Trend unlocks after your second scan.
          </p>
        </div>
      )}
      {data && chartRows.length >= 2 && (
        <div className="mt-6 h-[280px] w-full" key={days}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#EBE3DC" strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#8A7A6E', fontFamily: 'Inter', fontWeight: 300 }}
                tickLine={false}
                axisLine={{ stroke: '#EAE0D6' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#8A7A6E', fontFamily: 'Inter', fontWeight: 300 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: '#CB4D22', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              {baselineLabel && (
                <ReferenceLine
                  x={baselineLabel}
                  stroke="#8A7A6E"
                  strokeDasharray="4 3"
                  label={{
                    value: 'Baseline',
                    position: 'insideTopLeft',
                    fontSize: 10,
                    fill: '#8A7A6E',
                    fontFamily: 'Inter',
                  }}
                />
              )}
              {SERIES.filter((s) => active.includes(s.key)).map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={s.width}
                  dot={false}
                  activeDot={{ r: 3, fill: s.color, stroke: '#FDFBF9' }}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Reveal>
  );
}
