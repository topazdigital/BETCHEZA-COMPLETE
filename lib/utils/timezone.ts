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
  // Build the format options directly (no inherited hour/minute from formatInTimezone defaults).
  const fmtOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    ...(showYear ? { year: 'numeric' as const } : {}),
  };
  return new Intl.DateTimeFormat('en-US', fmtOptions).format(dateObj);
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

/** Format a Date as "YYYY-MM-DD" in the given timezone — date-only, no time. */
function dateOnlyString(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string, timezone: string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateOnlyString(dateObj, timezone) === dateOnlyString(new Date(), timezone);
}

/**
 * Check if a date is tomorrow
 */
export function isTomorrow(date: Date | string, timezone: string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateOnlyString(dateObj, timezone) === dateOnlyString(tomorrow, timezone);
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
 * Common timezones list (short, for legacy compat)
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

/**
 * All IANA timezones with human-readable labels, grouped by region.
 * Suitable for a searchable picker.
 */
export const ALL_TIMEZONES: { value: string; label: string; group: string }[] = [
  // ── Africa ──────────────────────────────────────────────────────────
  { value: 'Africa/Abidjan',       label: 'Abidjan (GMT+0)',             group: 'Africa' },
  { value: 'Africa/Accra',         label: 'Accra (GMT+0)',               group: 'Africa' },
  { value: 'Africa/Addis_Ababa',   label: 'Addis Ababa (EAT +3)',        group: 'Africa' },
  { value: 'Africa/Algiers',       label: 'Algiers (CET +1)',            group: 'Africa' },
  { value: 'Africa/Cairo',         label: 'Cairo (EET +2)',              group: 'Africa' },
  { value: 'Africa/Casablanca',    label: 'Casablanca (WET +0/+1)',      group: 'Africa' },
  { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam (EAT +3)',      group: 'Africa' },
  { value: 'Africa/Douala',        label: 'Douala (WAT +1)',             group: 'Africa' },
  { value: 'Africa/Harare',        label: 'Harare (CAT +2)',             group: 'Africa' },
  { value: 'Africa/Johannesburg',  label: 'Johannesburg (SAST +2)',      group: 'Africa' },
  { value: 'Africa/Kampala',       label: 'Kampala (EAT +3)',            group: 'Africa' },
  { value: 'Africa/Khartoum',      label: 'Khartoum (CAT +2)',           group: 'Africa' },
  { value: 'Africa/Kigali',        label: 'Kigali (CAT +2)',             group: 'Africa' },
  { value: 'Africa/Lagos',         label: 'Lagos (WAT +1)',              group: 'Africa' },
  { value: 'Africa/Lusaka',        label: 'Lusaka (CAT +2)',             group: 'Africa' },
  { value: 'Africa/Maputo',        label: 'Maputo (CAT +2)',             group: 'Africa' },
  { value: 'Africa/Monrovia',      label: 'Monrovia (GMT+0)',            group: 'Africa' },
  { value: 'Africa/Nairobi',       label: 'Nairobi (EAT +3)',            group: 'Africa' },
  { value: 'Africa/Tunis',         label: 'Tunis (CET +1)',              group: 'Africa' },
  // ── America ─────────────────────────────────────────────────────────
  { value: 'America/Anchorage',    label: 'Anchorage (AKST -9)',         group: 'Americas' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART -3)', group: 'Americas' },
  { value: 'America/Bogota',       label: 'Bogotá (COT -5)',             group: 'Americas' },
  { value: 'America/Caracas',      label: 'Caracas (VET -4)',            group: 'Americas' },
  { value: 'America/Chicago',      label: 'Chicago (CT -6/-5)',          group: 'Americas' },
  { value: 'America/Denver',       label: 'Denver (MT -7/-6)',           group: 'Americas' },
  { value: 'America/Guatemala',    label: 'Guatemala City (CST -6)',     group: 'Americas' },
  { value: 'America/Halifax',      label: 'Halifax (AT -4/-3)',          group: 'Americas' },
  { value: 'America/Havana',       label: 'Havana (CST -5)',             group: 'Americas' },
  { value: 'America/Jamaica',      label: 'Kingston (EST -5)',           group: 'Americas' },
  { value: 'America/Lima',         label: 'Lima (PET -5)',               group: 'Americas' },
  { value: 'America/Los_Angeles',  label: 'Los Angeles (PT -8/-7)',      group: 'Americas' },
  { value: 'America/Mexico_City',  label: 'Mexico City (CST -6/-5)',     group: 'Americas' },
  { value: 'America/New_York',     label: 'New York (ET -5/-4)',         group: 'Americas' },
  { value: 'America/Panama',       label: 'Panama (EST -5)',             group: 'Americas' },
  { value: 'America/Phoenix',      label: 'Phoenix (MST -7)',            group: 'Americas' },
  { value: 'America/Puerto_Rico',  label: 'Puerto Rico (AST -4)',        group: 'Americas' },
  { value: 'America/Santiago',     label: 'Santiago (CLT -4/-3)',        group: 'Americas' },
  { value: 'America/Sao_Paulo',    label: 'São Paulo (BRT -3)',          group: 'Americas' },
  { value: 'America/St_Johns',     label: 'St. John\'s (NST -3:30)',     group: 'Americas' },
  { value: 'America/Toronto',      label: 'Toronto (ET -5/-4)',          group: 'Americas' },
  { value: 'America/Vancouver',    label: 'Vancouver (PT -8/-7)',        group: 'Americas' },
  // ── Asia ────────────────────────────────────────────────────────────
  { value: 'Asia/Almaty',          label: 'Almaty (ALMT +6)',            group: 'Asia' },
  { value: 'Asia/Baghdad',         label: 'Baghdad (AST +3)',            group: 'Asia' },
  { value: 'Asia/Bangkok',         label: 'Bangkok (ICT +7)',            group: 'Asia' },
  { value: 'Asia/Colombo',         label: 'Colombo (IST +5:30)',         group: 'Asia' },
  { value: 'Asia/Dhaka',           label: 'Dhaka (BST +6)',              group: 'Asia' },
  { value: 'Asia/Dubai',           label: 'Dubai (GST +4)',              group: 'Asia' },
  { value: 'Asia/Ho_Chi_Minh',     label: 'Ho Chi Minh (ICT +7)',        group: 'Asia' },
  { value: 'Asia/Hong_Kong',       label: 'Hong Kong (HKT +8)',          group: 'Asia' },
  { value: 'Asia/Jakarta',         label: 'Jakarta (WIB +7)',            group: 'Asia' },
  { value: 'Asia/Jerusalem',       label: 'Jerusalem (IST +2)',          group: 'Asia' },
  { value: 'Asia/Kabul',           label: 'Kabul (AFT +4:30)',           group: 'Asia' },
  { value: 'Asia/Karachi',         label: 'Karachi (PKT +5)',            group: 'Asia' },
  { value: 'Asia/Kathmandu',       label: 'Kathmandu (NPT +5:45)',       group: 'Asia' },
  { value: 'Asia/Kolkata',         label: 'Kolkata (IST +5:30)',         group: 'Asia' },
  { value: 'Asia/Kuala_Lumpur',    label: 'Kuala Lumpur (MYT +8)',       group: 'Asia' },
  { value: 'Asia/Kuwait',          label: 'Kuwait (AST +3)',             group: 'Asia' },
  { value: 'Asia/Makassar',        label: 'Makassar (WITA +8)',          group: 'Asia' },
  { value: 'Asia/Manila',          label: 'Manila (PHT +8)',             group: 'Asia' },
  { value: 'Asia/Muscat',          label: 'Muscat (GST +4)',             group: 'Asia' },
  { value: 'Asia/Rangoon',         label: 'Yangon (MMT +6:30)',          group: 'Asia' },
  { value: 'Asia/Riyadh',          label: 'Riyadh (AST +3)',             group: 'Asia' },
  { value: 'Asia/Seoul',           label: 'Seoul (KST +9)',              group: 'Asia' },
  { value: 'Asia/Shanghai',        label: 'Shanghai (CST +8)',           group: 'Asia' },
  { value: 'Asia/Singapore',       label: 'Singapore (SGT +8)',          group: 'Asia' },
  { value: 'Asia/Taipei',          label: 'Taipei (CST +8)',             group: 'Asia' },
  { value: 'Asia/Tashkent',        label: 'Tashkent (UZT +5)',          group: 'Asia' },
  { value: 'Asia/Tehran',          label: 'Tehran (IRST +3:30)',         group: 'Asia' },
  { value: 'Asia/Tokyo',           label: 'Tokyo (JST +9)',              group: 'Asia' },
  { value: 'Asia/Ulaanbaatar',     label: 'Ulaanbaatar (ULAT +8)',       group: 'Asia' },
  // ── Atlantic / Indian ────────────────────────────────────────────────
  { value: 'Atlantic/Azores',      label: 'Azores (AZOT -1)',            group: 'Atlantic' },
  { value: 'Atlantic/Cape_Verde',  label: 'Cape Verde (CVT -1)',         group: 'Atlantic' },
  { value: 'Indian/Mauritius',     label: 'Mauritius (MUT +4)',          group: 'Indian Ocean' },
  { value: 'Indian/Maldives',      label: 'Maldives (MVT +5)',           group: 'Indian Ocean' },
  // ── Europe ──────────────────────────────────────────────────────────
  { value: 'Europe/Amsterdam',     label: 'Amsterdam (CET +1/+2)',       group: 'Europe' },
  { value: 'Europe/Athens',        label: 'Athens (EET +2/+3)',          group: 'Europe' },
  { value: 'Europe/Belgrade',      label: 'Belgrade (CET +1/+2)',        group: 'Europe' },
  { value: 'Europe/Berlin',        label: 'Berlin (CET +1/+2)',          group: 'Europe' },
  { value: 'Europe/Brussels',      label: 'Brussels (CET +1/+2)',        group: 'Europe' },
  { value: 'Europe/Bucharest',     label: 'Bucharest (EET +2/+3)',       group: 'Europe' },
  { value: 'Europe/Budapest',      label: 'Budapest (CET +1/+2)',        group: 'Europe' },
  { value: 'Europe/Copenhagen',    label: 'Copenhagen (CET +1/+2)',      group: 'Europe' },
  { value: 'Europe/Dublin',        label: 'Dublin (GMT/IST +0/+1)',      group: 'Europe' },
  { value: 'Europe/Helsinki',      label: 'Helsinki (EET +2/+3)',        group: 'Europe' },
  { value: 'Europe/Istanbul',      label: 'Istanbul (TRT +3)',           group: 'Europe' },
  { value: 'Europe/Kiev',          label: 'Kyiv (EET +2/+3)',            group: 'Europe' },
  { value: 'Europe/Lisbon',        label: 'Lisbon (WET +0/+1)',          group: 'Europe' },
  { value: 'Europe/London',        label: 'London (GMT/BST +0/+1)',      group: 'Europe' },
  { value: 'Europe/Madrid',        label: 'Madrid (CET +1/+2)',          group: 'Europe' },
  { value: 'Europe/Minsk',         label: 'Minsk (FET +3)',              group: 'Europe' },
  { value: 'Europe/Moscow',        label: 'Moscow (MSK +3)',             group: 'Europe' },
  { value: 'Europe/Oslo',          label: 'Oslo (CET +1/+2)',            group: 'Europe' },
  { value: 'Europe/Paris',         label: 'Paris (CET +1/+2)',           group: 'Europe' },
  { value: 'Europe/Prague',        label: 'Prague (CET +1/+2)',          group: 'Europe' },
  { value: 'Europe/Rome',          label: 'Rome (CET +1/+2)',            group: 'Europe' },
  { value: 'Europe/Sofia',         label: 'Sofia (EET +2/+3)',           group: 'Europe' },
  { value: 'Europe/Stockholm',     label: 'Stockholm (CET +1/+2)',       group: 'Europe' },
  { value: 'Europe/Vienna',        label: 'Vienna (CET +1/+2)',          group: 'Europe' },
  { value: 'Europe/Warsaw',        label: 'Warsaw (CET +1/+2)',          group: 'Europe' },
  { value: 'Europe/Zurich',        label: 'Zurich (CET +1/+2)',          group: 'Europe' },
  // ── Pacific ─────────────────────────────────────────────────────────
  { value: 'Pacific/Auckland',     label: 'Auckland (NZST +12/+13)',     group: 'Pacific' },
  { value: 'Pacific/Fiji',         label: 'Fiji (FJT +12)',              group: 'Pacific' },
  { value: 'Pacific/Guam',         label: 'Guam (ChST +10)',             group: 'Pacific' },
  { value: 'Pacific/Honolulu',     label: 'Honolulu (HST -10)',          group: 'Pacific' },
  { value: 'Pacific/Port_Moresby', label: 'Port Moresby (PGT +10)',      group: 'Pacific' },
  // ── Australia ───────────────────────────────────────────────────────
  { value: 'Australia/Adelaide',   label: 'Adelaide (ACST +9:30/+10:30)', group: 'Australia' },
  { value: 'Australia/Brisbane',   label: 'Brisbane (AEST +10)',         group: 'Australia' },
  { value: 'Australia/Darwin',     label: 'Darwin (ACST +9:30)',         group: 'Australia' },
  { value: 'Australia/Melbourne',  label: 'Melbourne (AEST +10/+11)',    group: 'Australia' },
  { value: 'Australia/Perth',      label: 'Perth (AWST +8)',             group: 'Australia' },
  { value: 'Australia/Sydney',     label: 'Sydney (AEST +10/+11)',       group: 'Australia' },
  // ── UTC ─────────────────────────────────────────────────────────────
  { value: 'UTC',                  label: 'UTC (±0)',                    group: 'UTC' },
];
