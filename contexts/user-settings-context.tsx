'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
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

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount — merge both keys so legacy prefs are respected
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
    setSettings({
      ...defaultSettings,
      timezone: browserTimezone,
      ...loaded,
    });
    setIsLoaded(true);
  }, []);

  // Save to STORAGE_KEY + keep bz_prefs in sync whenever settings change
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
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  }, [settings, isLoaded]);

  // Listen for storage events so multiple tabs + settings page stay in sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY && e.key !== LEGACY_KEY) return;
      if (!e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Apply theme
  useEffect(() => {
    if (!isLoaded) return;
    const root = document.documentElement;
    if (settings.theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemDark);
    } else {
      root.classList.toggle('dark', settings.theme === 'dark');
    }
  }, [settings.theme, isLoaded]);

  const setTimezone = useCallback((timezone: string) => {
    setSettings(prev => ({ ...prev, timezone }));
  }, []);

  const setOddsFormat = useCallback((oddsFormat: OddsFormat) => {
    setSettings(prev => ({ ...prev, oddsFormat }));
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    setSettings(prev => ({ ...prev, theme }));
  }, []);

  return (
    <UserSettingsContext.Provider value={{ settings, setTimezone, setOddsFormat, setTheme, isLoaded }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
}
