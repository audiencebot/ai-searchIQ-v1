import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ErrorCard, Reveal, Skeleton, fmtDate, fmtDateLong } from '@/components/portal/dashboard/shared';
import { CLASS_COLORS, CLASS_LABELS, type BotClass, type Timeseries } from './shared';

type Point = Timeseries['points'][number] & { label: string };

function ChannelTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Point; dataKey: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-ares border border-ares-border bg-ares-card p-3 shadow-paper">
      <p className="font-label text-ares-muted">{fmtDateLong(point.date)}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-[11px] font-light">
            <span
              className="h-[2px] w-3 rounded-ares"
              style={{ background: CLASS_COLORS[entry.dataKey as BotClass] }}
            />
            <span className="text-ares-secondarytext">
              {CLASS_LABELS[entry.dataKey as BotClass] ?? entry.dataKey}
            </span>
            <span className="ml-auto pl-3 font-normal text-ares-primary">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** S3 — stacked-area daily volume by signal class (brand palette v2). */
export function ChannelChart({
  days,
  data,
  isLoading,
  isError,
  onRetry,
}: {
  days: number;
  data: Timeseries | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const chartRows = useMemo<Point[]>(
    () => (data?.points ?? []).map((p) => ({ ...p, label: fmtDate(p.date) })),
    [data]
  );

  return (
    <Reveal delay={0.1} className="action-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-label text-ares-primary">AI request stream — daily</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CLASS_LABELS) as BotClass[]).map((c) => (
            <span key={c} className="badge-pill text-ares-muted">
              <span className="h-[2px] w-3 rounded-ares" style={{ background: CLASS_COLORS[c] }} />
              {CLASS_LABELS[c]}
            </span>
          ))}
        </div>
      </div>

      {isLoading && <Skeleton className="mt-6 h-[280px] w-full" />}
      {isError && (
        <ErrorCard className="mt-6 border-0" message="Channel data unavailable." onRetry={onRetry} />
      )}
      {data && chartRows.length > 0 && (
        <div className="mt-6 h-[280px] w-full" key={days}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartRows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="rgba(189,234,255,0.45)" strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#344148', fontFamily: 'Inter', fontWeight: 300 }}
                tickLine={false}
                axisLine={{ stroke: '#BDEAFF' }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#344148', fontFamily: 'Inter', fontWeight: 300 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChannelTooltip />}
                cursor={{ stroke: '#3289AE', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              {(Object.keys(CLASS_LABELS) as BotClass[]).map((c) => (
                <Area
                  key={c}
                  type="monotone"
                  dataKey={c}
                  stackId="channel"
                  stroke={CLASS_COLORS[c]}
                  fill={CLASS_COLORS[c]}
                  fillOpacity={0.35}
                  strokeWidth={1.5}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Reveal>
  );
}
