'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings({
          ...defaultSettings,
          ...parsed,
        });
      } catch {
        // Invalid JSON, use defaults
      }
    } else {
      // Auto-detect timezone
      const browserTimezone = getBrowserTimezone();
      setSettings(prev => ({ ...prev, timezone: browserTimezone }));
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  // Apply theme
  useEffect(() => {
    if (!isLoaded) return;

    const root = document.documentElement;
    const theme = settings.theme;

    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [settings.theme, isLoaded]);

  const setTimezone = (timezone: string) => {
    setSettings(prev => ({ ...prev, timezone }));
  };

  const setOddsFormat = (oddsFormat: OddsFormat) => {
    setSettings(prev => ({ ...prev, oddsFormat }));
  };

  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    setSettings(prev => ({ ...prev, theme }));
  };

  return (
    <UserSettingsContext.Provider
      value={{
        settings,
        setTimezone,
        setOddsFormat,
        setTheme,
        isLoaded,
      }}
    >
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
