/**
 * Geo + Currency utilities — shared between the onboarding modal and wallet.
 * All detection is client-side (timezone-based); no IP lookup required.
 */

export interface CountryDialCode {
  country: string;
  dialCode: string;
  flag: string;
  name: string;
}

/** Comprehensive phone country-code list, Africa-first then global. */
export const PHONE_COUNTRY_CODES: CountryDialCode[] = [
  // East Africa
  { country: 'KE', dialCode: '+254', flag: '🇰🇪', name: 'Kenya' },
  { country: 'TZ', dialCode: '+255', flag: '🇹🇿', name: 'Tanzania' },
  { country: 'UG', dialCode: '+256', flag: '🇺🇬', name: 'Uganda' },
  { country: 'RW', dialCode: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { country: 'ET', dialCode: '+251', flag: '🇪🇹', name: 'Ethiopia' },
  { country: 'ZM', dialCode: '+260', flag: '🇿🇲', name: 'Zambia' },
  { country: 'MW', dialCode: '+265', flag: '🇲🇼', name: 'Malawi' },
  { country: 'MZ', dialCode: '+258', flag: '🇲🇿', name: 'Mozambique' },
  { country: 'ZW', dialCode: '+263', flag: '🇿🇼', name: 'Zimbabwe' },
  // West Africa
  { country: 'NG', dialCode: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { country: 'GH', dialCode: '+233', flag: '🇬🇭', name: 'Ghana' },
  { country: 'SN', dialCode: '+221', flag: '🇸🇳', name: 'Senegal' },
  { country: 'CI', dialCode: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { country: 'CM', dialCode: '+237', flag: '🇨🇲', name: 'Cameroon' },
  // Southern Africa
  { country: 'ZA', dialCode: '+27',  flag: '🇿🇦', name: 'South Africa' },
  // North Africa
  { country: 'EG', dialCode: '+20',  flag: '🇪🇬', name: 'Egypt' },
  { country: 'MA', dialCode: '+212', flag: '🇲🇦', name: 'Morocco' },
  // Middle East
  { country: 'AE', dialCode: '+971', flag: '🇦🇪', name: 'UAE' },
  { country: 'SA', dialCode: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  // Europe
  { country: 'GB', dialCode: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
  { country: 'DE', dialCode: '+49',  flag: '🇩🇪', name: 'Germany' },
  { country: 'FR', dialCode: '+33',  flag: '🇫🇷', name: 'France' },
  { country: 'IT', dialCode: '+39',  flag: '🇮🇹', name: 'Italy' },
  { country: 'ES', dialCode: '+34',  flag: '🇪🇸', name: 'Spain' },
  { country: 'NL', dialCode: '+31',  flag: '🇳🇱', name: 'Netherlands' },
  { country: 'PT', dialCode: '+351', flag: '🇵🇹', name: 'Portugal' },
  { country: 'BE', dialCode: '+32',  flag: '🇧🇪', name: 'Belgium' },
  { country: 'SE', dialCode: '+46',  flag: '🇸🇪', name: 'Sweden' },
  { country: 'NO', dialCode: '+47',  flag: '🇳🇴', name: 'Norway' },
  // Americas
  { country: 'US', dialCode: '+1',   flag: '🇺🇸', name: 'United States' },
  { country: 'CA', dialCode: '+1',   flag: '🇨🇦', name: 'Canada' },
  { country: 'BR', dialCode: '+55',  flag: '🇧🇷', name: 'Brazil' },
  { country: 'MX', dialCode: '+52',  flag: '🇲🇽', name: 'Mexico' },
  // Asia-Pacific
  { country: 'AU', dialCode: '+61',  flag: '🇦🇺', name: 'Australia' },
  { country: 'NZ', dialCode: '+64',  flag: '🇳🇿', name: 'New Zealand' },
  { country: 'IN', dialCode: '+91',  flag: '🇮🇳', name: 'India' },
  { country: 'JP', dialCode: '+81',  flag: '🇯🇵', name: 'Japan' },
  { country: 'CN', dialCode: '+86',  flag: '🇨🇳', name: 'China' },
];

/** Maps IANA timezone → ISO-3166-1 alpha-2 country code. */
export function detectCountryCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // African timezones — exact match to prevent misdetection
    if (tz === 'Africa/Nairobi') return 'KE';
    if (tz === 'Africa/Kampala') return 'UG';
    if (tz === 'Africa/Dar_es_Salaam' || tz === 'Africa/Zanzibar') return 'TZ';
    if (tz === 'Africa/Lagos' || tz === 'Africa/Kano' || tz === 'Africa/Abuja') return 'NG';
    if (tz === 'Africa/Accra' || tz === 'Africa/Abidjan') return 'GH';
    if (tz === 'Africa/Johannesburg') return 'ZA';
    if (tz === 'Africa/Cairo' || tz === 'Africa/Tripoli') return 'EG';
    if (tz === 'Africa/Kigali') return 'RW';
    if (tz === 'Africa/Casablanca' || tz === 'Africa/El_Aaiun') return 'MA';
    if (tz === 'Africa/Addis_Ababa') return 'ET';
    if (tz === 'Africa/Lusaka') return 'ZM';
    if (tz === 'Africa/Blantyre') return 'MW';
    if (tz === 'Africa/Harare') return 'ZW';
    if (tz === 'Africa/Maputo') return 'MZ';
    if (tz === 'Africa/Douala') return 'CM';
    if (tz === 'Africa/Dakar') return 'SN';
    if (tz === 'Africa/Abidjan') return 'CI';
    // Middle East
    if (tz === 'Asia/Dubai') return 'AE';
    if (tz === 'Asia/Riyadh') return 'SA';
    // European timezones
    if (tz.startsWith('Europe/London')) return 'GB';
    if (tz.startsWith('Europe/Madrid')) return 'ES';
    if (tz.startsWith('Europe/Berlin') || tz.startsWith('Europe/Vienna') || tz.startsWith('Europe/Zurich')) return 'DE';
    if (tz.startsWith('Europe/Rome')) return 'IT';
    if (tz.startsWith('Europe/Paris')) return 'FR';
    if (tz.startsWith('Europe/Amsterdam') || tz.startsWith('Europe/Brussels')) return 'NL';
    if (tz.startsWith('Europe/Lisbon')) return 'PT';
    if (tz.startsWith('Europe/Istanbul')) return 'TR';
    if (tz.startsWith('Europe/Stockholm')) return 'SE';
    if (tz.startsWith('Europe/Oslo')) return 'NO';
    // Americas
    if (tz.startsWith('America/New_York') || tz.startsWith('America/Los_Angeles') || tz.startsWith('America/Chicago') || tz.startsWith('America/Denver')) return 'US';
    if (tz.startsWith('America/Toronto') || tz.startsWith('America/Vancouver')) return 'CA';
    if (tz.startsWith('America/Sao_Paulo') || tz.startsWith('America/Recife') || tz.startsWith('America/Manaus')) return 'BR';
    if (tz.startsWith('America/Mexico_City') || tz.startsWith('America/Monterrey')) return 'MX';
    // Asia-Pacific
    if (tz.startsWith('Australia/')) return 'AU';
    if (tz.startsWith('Asia/Shanghai') || tz.startsWith('Asia/Hong_Kong') || tz.startsWith('Asia/Chongqing')) return 'CN';
    if (tz.startsWith('Asia/Tokyo')) return 'JP';
    if (tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta')) return 'IN';
    if (tz.startsWith('Pacific/Auckland')) return 'NZ';
  } catch { /* ignore */ }
  return 'KE'; // Default to Kenya (site's home market)
}

/** Get the dial code object for a given country code. */
export function getDialCodeForCountry(countryCode: string): CountryDialCode {
  return (
    PHONE_COUNTRY_CODES.find(c => c.country === countryCode) ??
    PHONE_COUNTRY_CODES.find(c => c.country === 'KE')!
  );
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  /** How many units of this currency equal 1 KES (approx.) */
  rateFromKES: number;
  decimals: number;
}

/** Approximate exchange rates against KES (updated periodically). */
export const CURRENCIES: Record<string, CurrencyInfo> = {
  KES: { code: 'KES', symbol: 'KES', name: 'Kenyan Shilling',   rateFromKES: 1,       decimals: 0 },
  UGX: { code: 'UGX', symbol: 'UGX', name: 'Ugandan Shilling',  rateFromKES: 28,      decimals: 0 },
  TZS: { code: 'TZS', symbol: 'TZS', name: 'Tanzanian Shilling', rateFromKES: 20,      decimals: 0 },
  NGN: { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira',     rateFromKES: 12,      decimals: 0 },
  GHS: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi',      rateFromKES: 0.123,   decimals: 2 },
  ZAR: { code: 'ZAR', symbol: 'R',   name: 'South African Rand', rateFromKES: 0.138,   decimals: 2 },
  RWF: { code: 'RWF', symbol: 'RWF', name: 'Rwandan Franc',      rateFromKES: 8,       decimals: 0 },
  ETB: { code: 'ETB', symbol: 'Br',  name: 'Ethiopian Birr',     rateFromKES: 0.44,    decimals: 2 },
  GBP: { code: 'GBP', symbol: '£',   name: 'British Pound',      rateFromKES: 0.006,   decimals: 2 },
  EUR: { code: 'EUR', symbol: '€',   name: 'Euro',               rateFromKES: 0.0071,  decimals: 2 },
  USD: { code: 'USD', symbol: '$',   name: 'US Dollar',          rateFromKES: 0.0077,  decimals: 2 },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham',         rateFromKES: 0.028,   decimals: 2 },
  AUD: { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar',  rateFromKES: 0.012,   decimals: 2 },
  CAD: { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar',    rateFromKES: 0.0105,  decimals: 2 },
  INR: { code: 'INR', symbol: '₹',   name: 'Indian Rupee',       rateFromKES: 0.64,    decimals: 2 },
  BRL: { code: 'BRL', symbol: 'R$',  name: 'Brazilian Real',     rateFromKES: 0.043,   decimals: 2 },
};

/** Country → currency code */
const COUNTRY_CURRENCY: Record<string, string> = {
  KE: 'KES', TZ: 'TZS', UG: 'UGX', NG: 'NGN', GH: 'GHS',
  ZA: 'ZAR', RW: 'RWF', ET: 'ETB', ZM: 'ZMW', MW: 'MWK',
  MZ: 'MZN', ZW: 'USD', CM: 'XAF', SN: 'XOF', CI: 'XOF',
  GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  NL: 'EUR', PT: 'EUR', BE: 'EUR', SE: 'SEK', NO: 'NOK',
  US: 'USD', CA: 'CAD', AU: 'AUD', NZ: 'NZD', BR: 'BRL',
  MX: 'MXN', IN: 'INR', JP: 'JPY', CN: 'CNY',
  AE: 'AED', SA: 'SAR',
};

export function getCurrencyForCountry(countryCode: string): CurrencyInfo {
  const code = COUNTRY_CURRENCY[countryCode] ?? 'KES';
  return CURRENCIES[code] ?? CURRENCIES['KES'];
}

/** Convert KES amount → local currency amount (rounded to currency's decimals). */
export function kesToLocal(kesAmount: number, currency: CurrencyInfo): number {
  const raw = kesAmount * currency.rateFromKES;
  const factor = Math.pow(10, currency.decimals);
  return Math.round(raw * factor) / factor;
}

/** Convert local currency amount → KES. */
export function localToKes(localAmount: number, currency: CurrencyInfo): number {
  if (!currency.rateFromKES) return localAmount;
  return Math.round(localAmount / currency.rateFromKES);
}

/** Format a local-currency amount for display. */
export function fmtLocalCurrency(amount: number, currency: CurrencyInfo): string {
  return `${currency.symbol} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  })}`;
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

export type DepositMethodId =
  | 'mpesa'
  | 'mpesa_till'
  | 'mobile_money'
  | 'paystack'
  | 'card'
  | 'bank'
  | 'crypto';

export interface DepositMethodDef {
  id: DepositMethodId;
  label: string;
  icon: 'phone' | 'card' | 'bank' | 'bitcoin';
  help: string;
  /** If true, user must enter a phone number */
  needsPhone?: boolean;
  /** Placeholder for the phone field */
  phonePlaceholder?: string;
  /** Countries where this method should be shown first */
  primaryFor?: string[];
}

export const ALL_DEPOSIT_METHODS: DepositMethodDef[] = [
  {
    id: 'mpesa',
    label: 'M-Pesa STK',
    icon: 'phone',
    help: 'Instant prompt to your phone',
    needsPhone: true,
    phonePlaceholder: '07XX XXX XXX',
    primaryFor: ['KE', 'TZ'],
  },
  {
    id: 'mpesa_till',
    label: 'M-Pesa Till',
    icon: 'phone',
    help: 'Pay via Till number',
    primaryFor: ['KE'],
  },
  {
    id: 'mobile_money',
    label: 'Mobile Money',
    icon: 'phone',
    help: 'MTN / Airtel / Vodacom',
    needsPhone: true,
    phonePlaceholder: '07XX XXX XXX',
    primaryFor: ['UG', 'RW', 'ET', 'ZM', 'MW', 'MZ', 'GH', 'SN', 'CI', 'CM'],
  },
  {
    id: 'paystack',
    label: 'Paystack',
    icon: 'card',
    help: 'Card / Bank Transfer / USSD',
    primaryFor: ['NG', 'GH', 'ZA'],
  },
  {
    id: 'card',
    label: 'Card',
    icon: 'card',
    help: 'Visa / Mastercard / Verve',
    primaryFor: ['GB', 'US', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'PT', 'BE', 'AE', 'SA', 'BR', 'MX', 'IN'],
  },
  {
    id: 'bank',
    label: 'Bank Transfer',
    icon: 'bank',
    help: 'SWIFT / SEPA / local transfer',
  },
  {
    id: 'crypto',
    label: 'Crypto',
    icon: 'bitcoin',
    help: 'USDT / BTC / ETH',
  },
];

/**
 * Return deposit methods ordered for a given country.
 * Country-primary methods come first, then the rest.
 */
export function getDepositMethodsForCountry(countryCode: string): DepositMethodDef[] {
  const primary: DepositMethodDef[] = [];
  const secondary: DepositMethodDef[] = [];

  for (const m of ALL_DEPOSIT_METHODS) {
    if (m.primaryFor?.includes(countryCode)) {
      primary.push(m);
    } else {
      secondary.push(m);
    }
  }

  // Always show at least 2 options
  if (primary.length === 0) {
    // Non-specific country: card first, then bank, then crypto
    return ALL_DEPOSIT_METHODS.filter(m => ['card', 'bank', 'crypto'].includes(m.id));
  }

  // Combine: primary first, then fill in card/bank/crypto if not already in primary
  const combined = [...primary];
  for (const m of secondary) {
    if (['card', 'bank', 'crypto'].includes(m.id) && !combined.find(c => c.id === m.id)) {
      combined.push(m);
    }
  }
  return combined;
}

/** Returns true if the country can use M-Pesa or Mobile Money methods. */
export function countryHasMobileMoney(countryCode: string): boolean {
  return ['KE', 'TZ', 'UG', 'RW', 'GH', 'ET', 'ZM', 'MW', 'MZ', 'SN', 'CI', 'CM'].includes(countryCode);
}
