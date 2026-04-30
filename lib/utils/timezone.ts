/**
 * Get the user's timezone from the browser
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Format a date in the user's timezone
 */
export function formatInTimezone(
  date: Date | string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };
  
  return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
}

/**
 * Format time only (e.g., "15:30")
 */
export function formatTime(date: Date | string, timezone: string): string {
  return formatInTimezone(date, timezone, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format date only (e.g., "Apr 18", or "Apr 18, 2024" if not the current year).
 *
 * Pass `{ year: true }` to always include the year (e.g. for H2H rows where
 * games can be years apart and the year is essential context). Pass
 * `{ year: false }` to never include the year.
 */
export function formatDate(
  date: Date | string,
  timezone: string,
  options: { year?: boolean } = {},
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const showYear = options.year ?? (dateObj.getFullYear() !== new Date().getFullYear());
  return formatInTimezone(date, timezone, {
    month: 'short',
    day: 'numeric',
    ...(showYear ? { year: 'numeric' as const } : {}),
  });
}

/**
 * Format full datetime (e.g., "Apr 18, 2024, 15:30")
 */
export function formatDateTime(date: Date | string, timezone: string): string {
  return formatInTimezone(date, timezone, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format relative time (e.g., "in 2 hours", "45 mins ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);
  
  if (Math.abs(diffMins) < 1) {
    return 'now';
  }
  
  if (Math.abs(diffMins) < 60) {
    if (diffMins > 0) {
      return `in ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
    }
    return `${Math.abs(diffMins)} min${Math.abs(diffMins) !== 1 ? 's' : ''} ago`;
  }
  
  if (Math.abs(diffHours) < 24) {
    if (diffHours > 0) {
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }
    return `${Math.abs(diffHours)} hour${Math.abs(diffHours) !== 1 ? 's' : ''} ago`;
  }
  
  if (diffDays > 0) {
    return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }
  return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago`;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string, timezone: string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  const dateStr = formatInTimezone(dateObj, timezone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const todayStr = formatInTimezone(now, timezone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  return dateStr === todayStr;
}

/**
 * Check if a date is tomorrow
 */
export function isTomorrow(date: Date | string, timezone: string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateStr = formatInTimezone(dateObj, timezone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const tomorrowStr = formatInTimezone(tomorrow, timezone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  return dateStr === tomorrowStr;
}

/**
 * Get day label (Today, Tomorrow, or formatted date)
 */
export function getDayLabel(date: Date | string, timezone: string): string {
  if (isToday(date, timezone)) return 'Today';
  if (isTomorrow(date, timezone)) return 'Tomorrow';
  return formatDate(date, timezone);
}

/**
 * Common timezones list
 */
export const commonTimezones = [
  { value: 'Africa/Nairobi', label: 'East Africa Time (EAT)' },
  { value: 'Africa/Lagos', label: 'West Africa Time (WAT)' },
  { value: 'Africa/Cairo', label: 'Eastern European Time (EET)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Europe/Moscow', label: 'Moscow Time (MSK)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
];
