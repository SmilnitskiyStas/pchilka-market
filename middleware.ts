import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // MVP: фіксуємо українську як єдину активну мову.
  response.headers.set('x-app-locale', 'uk');
  response.headers.set('x-canonical-path', request.nextUrl.pathname);

  return response;
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)']
};
