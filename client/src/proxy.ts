import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function getJwtExpiryDate(token: string): Date | undefined {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof decoded?.exp === 'number') {
      return new Date(decoded.exp * 1000);
    }
  } catch {}
  return undefined;
}

function getRefreshUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:9999/api';
  const baseWithSlash = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL('token/refresh/', baseWithSlash);
}

async function refreshAccessToken(refresh: string): Promise<string | null> {
  try {
    const response = await fetch(getRefreshUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { access?: string };
    return data.access ?? null;
  } catch {
    return null;
  }
}

function applyAccessCookie(response: NextResponse, access: string, secure: boolean) {
  const expires = getJwtExpiryDate(access);
  response.cookies.set('access', access, {
    path: '/',
    expires: expires ?? undefined,
    sameSite: 'lax',
    secure,
  });
}

export default async function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const hostname = host.split(':')[0];
  const rootDomain = process.env.ROOT_DOMAIN ?? 'operoncrm.uz';

  const [subdomain] = hostname.split('.');

  const pathname = request.nextUrl.pathname;

  const isLoginPath = pathname === '/login';
  const isPublic = pathname.startsWith('/_next/') || pathname.startsWith('/favicon.ico');

  let access = request.cookies.get('access')?.value;
  const refresh = request.cookies.get('refresh')?.value;
  const secure = request.nextUrl.protocol === 'https:';
  let refreshedAccess: string | null = null;

  if (!access && refresh && !isLoginPath && !isPublic) {
    refreshedAccess = await refreshAccessToken(refresh);
    if (refreshedAccess) {
      access = refreshedAccess;
    }
  }

  if (!access && !isLoginPath && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
    const response = NextResponse.redirect(url);
    response.cookies.set('access', '', { path: '/', maxAge: 0 });
    response.cookies.set('refresh', '', { path: '/', maxAge: 0 });
    return response;
  }

  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    const response = NextResponse.next();
    if (refreshedAccess) {
      applyAccessCookie(response, refreshedAccess, secure);
    }
    return response;
  }

  if (subdomain === 'admin' || subdomain === 'agent') {
    const dest = new URL(`/${subdomain}${pathname}`, request.url);
    dest.search = request.nextUrl.search;
    const response = NextResponse.rewrite(dest);
    if (refreshedAccess) {
      applyAccessCookie(response, refreshedAccess, secure);
    }
    return response;
  }

  const dest = new URL(`/tenant/${subdomain}${pathname}`, request.url);
  dest.search = request.nextUrl.search;
  const response = NextResponse.rewrite(dest);
  if (refreshedAccess) {
    applyAccessCookie(response, refreshedAccess, secure);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
