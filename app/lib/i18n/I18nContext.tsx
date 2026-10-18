import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { messages, type LocaleKey } from './locales';

export type DisplayMode = 'vi' | 'en';

type I18nContextValue = {
  mode: DisplayMode;
  setMode: (m: DisplayMode) => void;
  t: (key: LocaleKey) => string;
  pair: (key: LocaleKey) => { vi: string; en: string };
};

const STORAGE_KEY = 'wc-display-mode';

export function readStoredMode(): DisplayMode {
  if (typeof window === 'undefined') return 'vi';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en') return 'en';
  if (saved === 'vi') return 'vi';
  // legacy "bilingual" or unknown → Vietnamese default
  return 'vi';
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DisplayMode>(readStoredMode);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.lang = mode === 'en' ? 'en' : 'vi';
  }, [mode]);

  const setMode = (m: DisplayMode) => setModeState(m);

  const pair = (key: LocaleKey) => messages[key];

  const t = (key: LocaleKey) => {
    const p = messages[key];
    if (mode === 'en') return p.en;
    return p.vi;
  };

  return (
    <I18nContext.Provider value={{ mode, setMode, t, pair }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
