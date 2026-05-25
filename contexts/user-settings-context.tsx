'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import type { OddsFormat } from '@/lib/types';
import { getBrowserTimezone } from '@/lib/utils/timezone';

interface UserSettings {
  timezone: string;
  oddsFormat: OddsFormat;
  theme: 'light' | 'dark' | 'system';
}

interface UserSettingsContextType {
  settings: UserSettings;
  setTimezone: (timezone: string) => void;
  setOddsFormat: (format: OddsFormat) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  isLoaded: boolean;
}

const defaultSettings: UserSettings = {
  timezone: 'UTC',
  oddsFormat: 'decimal',
  theme: 'system',
};

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'betcheza_settings';
const LEGACY_KEY = 'bz_prefs';

function UserSettingsInner({ children }: { children: ReactNode }) {
  const { setTheme: setNextTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let loaded: Partial<UserSettings> = {};
    try {
      const main = localStorage.getItem(STORAGE_KEY);
      if (main) loaded = { ...loaded, ...JSON.parse(main) };
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const lp = JSON.parse(legacy);
        if (lp.oddsFormat && !loaded.oddsFormat) loaded.oddsFormat = lp.oddsFormat;
        if (lp.timezone && !loaded.timezone) loaded.timezone = lp.timezone;
      }
    } catch { /* ignore */ }

    const browserTimezone = getBrowserTimezone();
    const savedTheme = (loaded.theme as 'light' | 'dark' | 'system') || 'system';

    setSettings({
      ...defaultSettings,
      ...loaded,
      timezone: (loaded.timezone && loaded.timezone !== 'UTC') ? loaded.timezone : browserTimezone,
      theme: savedTheme,
    });

    // Apply theme via next-themes so it handles the class toggling correctly
    setNextTheme(savedTheme);
    setIsLoaded(true);
  }, [setNextTheme]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}');
      localStorage.setItem(LEGACY_KEY, JSON.stringify({
        ...legacy,
        oddsFormat: settings.oddsFormat,
        timezone: settings.timezone,
      }));
    } catch { /* ignore */ }
    // NOTE: do NOT dispatch a synthetic StorageEvent here — that would
    // re-trigger our own storage handler below, causing an infinite
    // re-render loop.  Native cross-tab sync works automatically because
    // localStorage.setItem() already fires 'storage' in OTHER tabs.
  }, [settings, isLoaded]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY && e.key !== LEGACY_KEY) return;
      if (!e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed.theme) setNextTheme(parsed.theme);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [setNextTheme]);

  const setTimezone = useCallback((timezone: string) => {
    setSettings(prev => ({ ...prev, timezone }));
  }, []);

  const setOddsFormat = useCallback((oddsFormat: OddsFormat) => {
    setSettings(prev => ({ ...prev, oddsFormat }));
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    setSettings(prev => ({ ...prev, theme }));
    setNextTheme(theme);
  }, [setNextTheme]);

  return (
    <UserSettingsContext.Provider value={{ settings, setTimezone, setOddsFormat, setTheme, isLoaded }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  return <UserSettingsInner>{children}</UserSettingsInner>;
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
}
