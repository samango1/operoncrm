import { decodeJwtPayload } from '@/lib/jwt';
import { enMessages, type I18nKey } from '@/i18n/messages.en';
import { ruMessages } from '@/i18n/messages.ru';

export type { I18nKey } from '@/i18n/messages.en';

export const LOCALES = ['en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: Locale = 'en';
const LANG_COOKIE_NAME = 'lang';
const ACCESS_COOKIE_NAME = 'access';
const LANG_JWT_CLAIM = 'lang';

type TranslationParams = Record<string, string | number | boolean | null | undefined>;

const dictionaries: Record<Locale, Record<I18nKey, string>> = {
  en: enMessages,
  ru: ruMessages,
};

const listeners = new Set<() => void>();
let initialized = false;
let currentLocale: Locale = DEFAULT_LOCALE;

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

function readLocaleFromAccessToken(token: string | null | undefined): Locale | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== 'object') return null;
  const lang = payload[LANG_JWT_CLAIM];
  return isLocale(lang) ? lang : null;
}

function resolveInitialLocale(): Locale {
  const byCookie = readCookie(LANG_COOKIE_NAME);
  if (isLocale(byCookie)) return byCookie;

  const byToken = readLocaleFromAccessToken(readCookie(ACCESS_COOKIE_NAME));
  if (byToken) return byToken;

  return DEFAULT_LOCALE;
}

function applyHtmlLang(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

function ensureInitialized() {
  if (initialized) return;
  currentLocale = resolveInitialLocale();
  initialized = true;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = params[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

export function getLocale(): Locale {
  ensureInitialized();
  return currentLocale;
}

export function setLocale(nextLocale: Locale, opts?: { persist?: boolean }) {
  ensureInitialized();
  if (!isLocale(nextLocale)) return;

  const changed = nextLocale !== currentLocale;
  currentLocale = nextLocale;

  if (opts?.persist !== false) writeCookie(LANG_COOKIE_NAME, nextLocale);
  applyHtmlLang(nextLocale);

  if (changed) listeners.forEach((listener) => listener());
}

export function syncLocaleFromAccessToken(accessToken: string | null | undefined, opts?: { persist?: boolean }) {
  const tokenLocale = readLocaleFromAccessToken(accessToken);
  if (!tokenLocale) return;
  setLocale(tokenLocale, opts);
}

export function ensureI18nInitialized() {
  ensureInitialized();
  applyHtmlLang(currentLocale);
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: I18nKey, params?: TranslationParams): string {
  const locale = getLocale();
  const template = dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key;
  return interpolate(template, params);
}
