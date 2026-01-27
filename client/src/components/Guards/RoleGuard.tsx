'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { decodeJwtPayload } from '@/lib/jwt';
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

    const resolveRoleFromToken = (): PlatformRole | null => {
      if (typeof document === 'undefined') return null;
      const match = document.cookie.match(/(?:^|; )access=([^;]+)/);
      const token = match ? decodeURIComponent(match[1]) : null;
      const payload = decodeJwtPayload(token);
      if (!payload) return null;
      const role = payload.platform_role || payload.role;
      if (role === 'admin' || role === 'agent' || role === 'member') return role;
      if (payload.is_admin === true) return 'admin';
      if (payload.is_agent === true) return 'agent';
      return null;
    };

    const ensureRole = async () => {
      const role = resolveRoleFromToken();
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
