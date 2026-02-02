export type PreferenceCookies = {
  get: (name: string) => string | undefined;
  set: (
    name: string,
    value: string,
    options?: {
      path?: string;
      expires?: Date;
      maxAge?: number;
      domain?: string;
      sameSite?: 'lax' | 'strict' | 'none';
      secure?: boolean;
    }
  ) => void;
  remove?: (name: string, options?: { path?: string }) => void;
};

const PREF_PREFIX = 'pref';

const prefKey = (suffix: string) => `${PREF_PREFIX}.${suffix}`;

export const preferencesKeys = {
  optionalSection: (id: string) => prefKey(`optional.${id}`),
  transactionExtra: prefKey('transaction.extra'),
};

export const preferenceIds = {
  optionalSection: {
    clientFormExtra: 'client-form-extra',
    companyFormExtra: 'company-form-extra',
    productFormExtra: 'product-form-extra',
    userFormPassword: 'user-form-password',
  },
};

export type TransactionExtraPreference = 'client' | 'details' | null;

const writePref = (cookies: PreferenceCookies, key: string, value: string | null) => {
  if (value === null) {
    cookies.remove?.(key, { path: '/' });
    return;
  }
  cookies.set(key, value, { path: '/' });
};

export const readOptionalSectionOpen = (cookies: PreferenceCookies, id: string, fallback = false): boolean => {
  const raw = cookies.get(preferencesKeys.optionalSection(id));
  if (raw === '1') return true;
  if (raw === '0') return false;
  return fallback;
};

export const writeOptionalSectionOpen = (cookies: PreferenceCookies, id: string, open: boolean) => {
  writePref(cookies, preferencesKeys.optionalSection(id), open ? '1' : '0');
};

export const readTransactionExtra = (cookies: PreferenceCookies): TransactionExtraPreference => {
  const raw = cookies.get(preferencesKeys.transactionExtra);
  if (raw === 'client' || raw === 'details') return raw;
  return null;
};

export const writeTransactionExtra = (cookies: PreferenceCookies, value: TransactionExtraPreference) => {
  writePref(cookies, preferencesKeys.transactionExtra, value);
};
