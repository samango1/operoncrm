'use client';

import { useEffect } from 'react';

import { ensureI18nInitialized } from '@/i18n';

interface I18nProviderProps {
  children: React.ReactNode;
}

export default function I18nProvider({ children }: I18nProviderProps) {
  useEffect(() => {
    ensureI18nInitialized();
  }, []);

  return <>{children}</>;
}
