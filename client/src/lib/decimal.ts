const DECIMAL_REGEX = /^\d+(\.\d+)?$/;

type DecimalFormatOptions = {
  minFractionDigits?: number;
  maxFractionDigits?: number;
  locale?: string;
  decimalSeparator?: string;
  groupSeparator?: string;
};

type LocaleSeparators = {
  group: string;
  decimal: string;
};

const localeSeparatorsCache = new Map<string, LocaleSeparators>();

const getLocaleSeparators = (locale?: string): LocaleSeparators => {
  const key = locale ?? 'default';
  const cached = localeSeparatorsCache.get(key);
  if (cached) return cached;

  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
    const group = parts.find((part) => part.type === 'group')?.value ?? ' ';
    const decimal = parts.find((part) => part.type === 'decimal')?.value ?? ',';
    const separators = { group, decimal };
    localeSeparatorsCache.set(key, separators);
    return separators;
  } catch {
    const fallback = { group: ' ', decimal: ',' };
    localeSeparatorsCache.set(key, fallback);
    return fallback;
  }
};

export const normalizeDecimalInput = (value: string): string => {
  if (value === null || value === undefined) return '';
  let normalized = String(value).trim();
  if (!normalized) return '';
  normalized = normalized.replace(/[\s\u00A0\u202F]+/g, '');

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  let separator: string | null = null;
  if (lastComma !== -1 || lastDot !== -1) {
    separator = lastComma > lastDot ? ',' : '.';
  }

  if (separator) {
    const parts = normalized.split(separator);
    const fracPart = parts.pop() ?? '';
    const intPart = parts.join('').replace(/[.,]/g, '');
    normalized = fracPart ? `${intPart}.${fracPart}` : intPart;
  }

  if (normalized.startsWith('.')) normalized = `0${normalized}`;
  if (normalized.endsWith('.')) normalized = normalized.slice(0, -1);
  return normalized;
};

export const maskDecimalInput = (value: string, options: { maxFractionDigits?: number } = {}): string => {
  if (value === null || value === undefined) return '';
  let raw = String(value);
  if (!raw) return '';

  raw = raw.replace(/,/g, '.').replace(/[\s\u00A0\u202F]+/g, '');
  raw = raw.replace(/[^\d.]/g, '');

  const lastDot = raw.lastIndexOf('.');
  if (lastDot === -1) {
    return raw;
  }

  const intPart = raw.slice(0, lastDot).replace(/\./g, '');
  let fracPart = raw.slice(lastDot + 1).replace(/\./g, '');
  if (options.maxFractionDigits !== undefined) {
    fracPart = fracPart.slice(0, options.maxFractionDigits);
  }

  const safeInt = intPart === '' ? '0' : intPart;
  return `${safeInt}.${fracPart}`;
};

export const isValidDecimal = (value: string, options: { maxFractionDigits?: number } = {}): boolean => {
  const normalized = normalizeDecimalInput(value);
  if (normalized === '' || !DECIMAL_REGEX.test(normalized)) return false;
  if (options.maxFractionDigits !== undefined) {
    const [, fracPart = ''] = normalized.split('.');
    if (fracPart.length > options.maxFractionDigits) return false;
  }
  return true;
};

export const toDecimalString = (value?: string | number | null): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

export const compareDecimalStrings = (a: string, b: string): number => {
  const na = normalizeDecimalInput(a);
  const nb = normalizeDecimalInput(b);
  if (!DECIMAL_REGEX.test(na) || !DECIMAL_REGEX.test(nb)) return 0;

  const [aiRaw, afRaw = ''] = na.split('.');
  const [biRaw, bfRaw = ''] = nb.split('.');

  const ai = aiRaw.replace(/^0+(?!$)/, '');
  const bi = biRaw.replace(/^0+(?!$)/, '');

  if (ai.length !== bi.length) return ai.length > bi.length ? 1 : -1;
  if (ai !== bi) return ai > bi ? 1 : -1;

  const maxFrac = Math.max(afRaw.length, bfRaw.length);
  const af = afRaw.padEnd(maxFrac, '0');
  const bf = bfRaw.padEnd(maxFrac, '0');
  if (af === bf) return 0;
  return af > bf ? 1 : -1;
};

export const formatDecimal = (value?: string | number | null, options: DecimalFormatOptions = {}): string => {
  if (value === undefined || value === null || value === '') return '';
  const raw = typeof value === 'number' ? String(value) : String(value).trim();
  const normalized = normalizeDecimalInput(raw);
  if (!DECIMAL_REGEX.test(normalized)) return String(value);

  const [intPart, fracPart = ''] = normalized.split('.');
  let trimmedFrac = fracPart;
  let maxFractionDigits = options.maxFractionDigits;
  const minFractionDigits = options.minFractionDigits;
  if (maxFractionDigits !== undefined && minFractionDigits !== undefined && minFractionDigits > maxFractionDigits) {
    maxFractionDigits = minFractionDigits;
  }
  if (maxFractionDigits !== undefined) {
    trimmedFrac = trimmedFrac.slice(0, maxFractionDigits);
  }
  if (minFractionDigits !== undefined) {
    trimmedFrac = trimmedFrac.padEnd(minFractionDigits, '0');
  }

  const { group, decimal } = getLocaleSeparators(options.locale);
  const groupSeparator = options.groupSeparator ?? group;
  const decimalSeparator = options.decimalSeparator ?? decimal;
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  return trimmedFrac ? `${grouped}${decimalSeparator}${trimmedFrac}` : grouped;
};

export const MONEY_FORMAT_OPTIONS = {
  minFractionDigits: 2,
  maxFractionDigits: 2,
  decimalSeparator: '.',
  groupSeparator: ' ',
} as const;

export const MEASURE_FORMAT_OPTIONS = {
  maxFractionDigits: 3,
  decimalSeparator: '.',
  groupSeparator: ' ',
} as const;

export const formatMoney = (value?: string | number | null): string => formatDecimal(value, MONEY_FORMAT_OPTIONS);

export const formatMeasure = (value?: string | number | null, options: { maxFractionDigits?: number } = {}): string =>
  formatDecimal(value, { ...MEASURE_FORMAT_OPTIONS, ...options });
