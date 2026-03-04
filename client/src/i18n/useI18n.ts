'use client';

import { useSyncExternalStore } from 'react';

import { getLocale, setLocale, subscribeLocale, t } from '@/i18n';

export function useI18n() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, () => 'en');
  return { locale, setLocale, t };
}
