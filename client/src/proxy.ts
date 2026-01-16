import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const hostname = host.split(':')[0];
  const rootDomain = process.env.ROOT_DOMAIN ?? 'operoncrm.uz';

  const [subdomain] = hostname.split('.');

  const pathname = request.nextUrl.pathname;

  const isLoginPath = pathname === '/login';
  const isPublic = pathname.startsWith('/_next/') || pathname.startsWith('/favicon.ico');

  const access = request.cookies.get('access')?.value;

  if (!access && !isLoginPath && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return NextResponse.next();
  }

  if (subdomain === 'admin' || subdomain === 'agent') {
    const dest = new URL(`/${subdomain}${pathname}`, request.url);
    dest.search = request.nextUrl.search;
    return NextResponse.rewrite(dest);
  }

  const dest = new URL(`/tenant/${subdomain}${pathname}`, request.url);
  dest.search = request.nextUrl.search;
  return NextResponse.rewrite(dest);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
