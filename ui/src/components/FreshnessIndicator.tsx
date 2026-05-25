import { clsx } from 'clsx';
import { Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  lastUpdated?: Date;
  isOnline?: boolean;
  className?: string;
}

export function FreshnessIndicator({ lastUpdated, isOnline = true, className }: Props) {
  const isStale = lastUpdated
    ? Date.now() - lastUpdated.getTime() > 30 * 60 * 1000
    : false;

  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 text-[10px]',
        isStale ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]',
        className
      )}
    >
      {isOnline ? (
        <Wifi size={10} className={clsx(isStale ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]')} />
      ) : (
        <WifiOff size={10} className="text-[var(--color-error)]" />
      )}
      {lastUpdated ? (
        <span>
          Data updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
          {isStale && ' — may be outdated'}
        </span>
      ) : (
        <span>Fetching live data...</span>
      )}
    </div>
  );
}
