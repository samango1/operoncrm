'use client';

import { decodeJwtPayload } from '@/lib/jwt';
import type { PlatformRole } from '@/types/api/users';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(^|; )' + name.replace(/([.*+?^=!:${}()|[\]\\/\\\\])/g, '\\$1') + '=([^;]*)')
  );
  return match ? decodeURIComponent(match[2]) : null;
}

export function getPlatformRoleFromCookie(): PlatformRole | null {
  const token = getCookie('access');
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const role = payload.platform_role || payload.role;
  if (role === 'admin' || role === 'agent' || role === 'member') return role;
  if (payload.is_admin === true) return 'admin';
  if (payload.is_agent === true) return 'agent';
  return null;
}
