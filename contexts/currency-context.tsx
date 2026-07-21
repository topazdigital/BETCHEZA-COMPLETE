'use client';

/**
 * CurrencyContext
 * ---------------
 * Detects the user's country/currency once on mount (IP-based → timezone fallback → localStorage cache)
 * and makes `fmt(kesAmount)`, `toLocal(kes)`, `toKes(local)`, and `countryCode` available globally.
 *
 * Internal prices everywhere stay in KES; only the UI display converts.
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  getCurrencyForCountry,
  detectCountryCode,
  kesToLocal,
  localToKes,
  getDepositMethodsForCountry,
  type CurrencyInfo,
  type DepositMethodDef,
} from '@/lib/geo-currency';

const CACHE_KEY = 'bz_geo_cc';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — short enough that VPN switches don't persist

interface CurrencyContextValue {
  /** ISO-3166-1 alpha-2 country code, e.g. "KE", "NG", "FR" */
  countryCode: string;
  /** Full currency info for the detected country */
  currency: CurrencyInfo;
  /**
   * Format a KES amount in the user's local currency.
   * e.g. fmt(5000) → "KES 5,000" (Kenya) or "NGN 18,500" (Nigeria) or "EUR 30" (France)
   */
  fmt: (kesAmount: number) => string;
  /** Convert a KES amount to the user's local currency (raw number) */
  toLocal: (kes: number) => number;
  /** Convert a local-currency amount back to KES (raw number) */
  toKes: (local: number) => number;
  /** Ordered list of deposit methods for the detected country */
  payMethods: DepositMethodDef[];
  /** True once the async detection has resolved */
  ready: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [countryCode, setCountryCode] = useState('KE');
  const [currency, setCurrency] = useState<CurrencyInfo>(getCurrencyForCountry('KE'));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function applyCode(cc: string) {
      setCountryCode(cc);
      setCurrency(getCurrencyForCountry(cc));
      setReady(true);
    }

    async function detect() {
      // 1. Apply cached value immediately for fast first render (if fresh)
      let cachedCc = '';
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { cc, ts } = JSON.parse(cached) as { cc: string; ts: number };
          if (cc && Date.now() - ts < CACHE_TTL_MS) {
            cachedCc = cc;
            if (!cancelled) applyCode(cc);
          }
        }
      } catch {}

      // 2. Always fetch fresh from API to validate (handles VPN switches)
      let freshCc = '';
      try {
        const res = await fetch('/api/geo', { credentials: 'omit', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json().catch(() => ({})) as { country?: string };
          freshCc = data.country ?? '';
        }
      } catch {}

      // 3. Fall back to timezone if API failed
      if (!freshCc) freshCc = detectCountryCode();

      // 4. Update state + cache if different from what we already applied
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cc: freshCc, ts: Date.now() })); } catch {}

      if (!cancelled && freshCc !== cachedCc) {
        applyCode(freshCc);
      } else if (!cancelled && !cachedCc) {
        applyCode(freshCc);
      }
    }

    detect();
    return () => { cancelled = true; };
  }, []);

  const fmt = useCallback((kesAmount: number): string => {
    const local = kesToLocal(kesAmount, currency);
    const decimals = currency.decimals ?? 0;
    return `${currency.code} ${local.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }, [currency]);

  const toLocal = useCallback((kes: number) => kesToLocal(kes, currency), [currency]);
  const toKes = useCallback((local: number) => localToKes(local, currency), [currency]);
  const payMethods = getDepositMethodsForCountry(countryCode);

  return (
    <CurrencyContext.Provider value={{ countryCode, currency, fmt, toLocal, toKes, payMethods, ready }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within <CurrencyProvider>');
  return ctx;
}
