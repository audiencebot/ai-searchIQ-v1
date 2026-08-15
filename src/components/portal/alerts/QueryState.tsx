import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';

/** Brand loading block — quiet paper skeleton bars. */
export function LoadingBlock({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={className ?? 'rounded-ares border border-ares-border bg-ares-card p-5'}>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded-ares bg-ares-secondary"
            style={{ width: `${88 - i * 14}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Brand error block — hairline card, terracotta icon, retry action. */
export function ErrorBlock({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-ares border border-ares-border bg-ares-card p-5">
      <div className="flex items-start gap-3">
        <Icon
          icon={icons.dangerTriangle}
          width={18}
          height={18}
          className="mt-0.5 shrink-0 text-ares-primaryDark"
        />
        <div className="min-w-0 flex-1">
          <p className="font-label text-ares-primaryDark">Could not load</p>
          <p className="mt-1 text-[12px] font-light leading-[19.5px] text-ares-secondarytext">
            {message ?? 'The scan dossier failed to load. Please try again.'}
          </p>
          {onRetry && (
            <button className="btn-secondary mt-3 !px-3 !py-1.5 text-[10px]" onClick={onRetry}>
              <Icon icon={icons.refresh} width={13} height={13} />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
