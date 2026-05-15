import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Requires login
const AUTH_ROUTES = [
  '/dashboard', '/appointments', '/book', '/profile',
  '/schedule', '/casos', '/pacientes', '/admin',
  '/patients', '/onboarding',
];

// Requires MEDICO or SECRETARIA
const STAFF_ROUTES = ['/casos', '/pacientes', '/patients', '/schedule', '/admin'];

// Redirect to /dashboard if already logged in
const GUEST_ROUTES = ['/login'];

interface SessionPayload {
  uid: string;
  email: string;
  role: string;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('__session')?.value;

  let payload: SessionPayload | null = null;

  if (sessionCookie) {
    try {
      const { payload: verified } = await jwtVerify(sessionCookie, JWT_SECRET);
      payload = verified as SessionPayload;
    } catch {
      // Expired or tampered token — clear cookie and redirect to login
      const res = NextResponse.redirect(new URL('/login', request.url));
      res.cookies.set('__session', '', { maxAge: 0, path: '/' });
      return res;
    }
  }

  const isAuthenticated = payload !== null;
  const isStaff = payload?.role === 'MEDICO' || payload?.role === 'SECRETARIA';

  // Guest-only: redirect authenticated users to dashboard
  if (GUEST_ROUTES.some((p) => pathname.startsWith(p)) && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Auth-required: redirect unauthenticated to login
  if (AUTH_ROUTES.some((p) => pathname.startsWith(p)) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Staff-only: redirect patients away
  if (STAFF_ROUTES.some((p) => pathname.startsWith(p)) && isAuthenticated && !isStaff) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const response = NextResponse.next();
  // Minimal security headers (full set in next.config.ts)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};