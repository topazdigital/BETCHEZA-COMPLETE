'use client';

import { cn } from '@/lib/utils';
import { liveStatusLabel } from '@/lib/utils/live-status';

interface LiveIndicatorProps {
  minute?: number;
  /** Match status (e.g. 'live' | 'halftime' | 'extra_time' | 'penalties') */
  status?: string;
  /** Sport slug used to format the label (e.g. 'soccer', 'tennis', 'basketball'). */
  sportSlug?: string;
  className?: string;
}

export function LiveIndicator({ minute, status = 'live', sportSlug = 'soccer', className }: LiveIndicatorProps) {
  const label = liveStatusLabel(sportSlug, status, minute);
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-live"></span>
      </span>
      <span className="font-semibold text-live">{label}</span>
    </div>
  );
}
