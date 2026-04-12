import * as Localization from 'expo-localization';
import en from './locales/en.json';
import es from './locales/es.json';

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

const tables: Record<string, typeof en> = { en, es };

/** Non-hook translation for contexts / tasks (matches I18nProvider logic). */
export function resolveT(key: string, vars?: Record<string, string | number>): string {
  const code = Localization.getLocales?.()[0]?.languageCode;
  const locale = code === 'es' ? 'es' : 'en';
  const table = tables[locale] || en;
  const raw = getNested(table as unknown as Record<string, unknown>, key) ?? getNested(en as unknown as Record<string, unknown>, key) ?? key;
  return applyVars(raw, vars);
}
