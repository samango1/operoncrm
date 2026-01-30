'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getPlatformRoleFromCookie } from '@/lib/role';
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
      const role = getPlatformRoleFromCookie();
      if (!active) return;

      if (role && allowedRoles.includes(role)) {
        setStatus('allowed');
        return;
      }

      if (role) {
        router.replace(`${areaPrefix}/not-allowed`);
        return;
      }

      router.replace(`${areaPrefix}/login`);
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
