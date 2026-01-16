'use client';

import { useCookies as originalUseCookies } from 'next-client-cookies';

export function useCookies() {
  const cookies = originalUseCookies();
  return {
    get: (name: string) => cookies.get(name),
    remove: (name: string, options?: { path?: string }) => cookies.remove(name, options),
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
    ) => cookies.set(name, value, options),
  };
}
