import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Requires login
const AUTH_ROUTES = [
  '/dashboard', '/appointments', '/book', '/profile',
  '/schedule', '/casos', '/pacientes', '/admin',
  '/patients',
];

// Requires MEDICO or SECRETARIA
const STAFF_ROUTES = ['/casos', '/pacientes', '/patients', '/schedule', '/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for login and static paths
  if (pathname.startsWith('/login') || pathname.startsWith('/onboarding') || 
      pathname.startsWith('/_next') || pathname.startsWith('/api') ||
      pathname.includes('.') || pathname === '/') {
    return NextResponse.next();
  }

  // For now, allow all authenticated routes - the auth is handled client-side
  // This can be improved later with proper server-side session handling
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};