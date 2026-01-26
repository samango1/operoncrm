'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getUsersMe } from '@/lib/api';
import type { PlatformRole } from '@/types/api/users';

type GuardStatus = 'loading' | 'allowed';

interface RoleGuardProps {
  allowedRoles: PlatformRole[];
  children: React.ReactNode;
}

export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<GuardStatus>('loading');

  useEffect(() => {
    let active = true;
    const areaPrefix = pathname?.startsWith('/admin') ? '/admin' : pathname?.startsWith('/agent') ? '/agent' : '';

    if (pathname?.endsWith('/login') || pathname?.endsWith('/not-allowed')) {
      setStatus('allowed');
      return () => {
        active = false;
      };
    }

    const ensureRole = async () => {
      try {
        const user = await getUsersMe();
        if (!active) return;

        if (allowedRoles.includes(user.platform_role)) {
          setStatus('allowed');
          return;
        }

        router.replace('/not-allowed');
      } catch {
        if (!active) return;
        router.replace(`${areaPrefix}/login`);
      }
    };

    ensureRole();

    return () => {
      active = false;
    };
  }, [allowedRoles, pathname, router]);

  if (status !== 'allowed') {
    return null;
  }

  return <>{children}</>;
}
