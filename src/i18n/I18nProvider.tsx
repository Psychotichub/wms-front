import React, { createContext, useCallback, useContext, useMemo } from 'react';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import es from './locales/es.json';

type LocaleTable = typeof en;

const tables: Record<string, LocaleTable> = { en, es };

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function applyVars(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.keys(vars).reduce((acc, k) => {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
    return acc.replace(re, String(vars[k]));
  }, template);
}

type I18nContextValue = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
};

const I18nContext = createContext<I18nContextValue>({
  t: (key) => key,
  locale: 'en'
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useMemo(() => {
    const code = Localization.getLocales?.()[0]?.languageCode;
    return code === 'es' ? 'es' : 'en';
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const table = tables[locale] || en;
      const raw =
        getNested(table as unknown as Record<string, unknown>, key) ??
        getNested(en as unknown as Record<string, unknown>, key) ??
        key;
      return applyVars(raw, vars);
    },
    [locale]
  );

  const value = useMemo(() => ({ t, locale }), [t, locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
