import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/qr-code' || (pathname !== '/' && pathname !== '/qr-code/' && pathname.endsWith('/'))) {
    // Use the native URL so NextURL does not normalize the required trailing slash.
    const url = new URL(request.url);
    url.pathname = pathname === '/qr-code' ? '/qr-code/' : pathname.replace(/\/+$/, '');
    return NextResponse.redirect(url, 308);
  }

  const response = NextResponse.next();

  // MVP: фіксуємо українську як єдину активну мову.
  response.headers.set('x-app-locale', 'uk');
  response.headers.set('x-canonical-path', request.nextUrl.pathname);

  return response;
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)']
};
