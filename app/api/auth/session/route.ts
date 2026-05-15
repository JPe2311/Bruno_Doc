import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const SESSION_DURATION_SECONDS = 24 * 60 * 60; // 1 day

// Firebase public keys — no service account needed
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

// Get Project ID from env fallback
const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
  process.env.FIREBASE_PROJECT_ID || 
  'brunodoctor-e59ec'; // Hardcoded fallback based on your config

interface FirebaseClaims {
  uid: string;
  email?: string;
  sub: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, role } = body as { idToken?: string; role?: string };

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Token missing' }, { status: 400 });
    }

    // Verify the Firebase ID token cryptographically
    // Added clockTolerance: 5 (seconds) to prevent 401 errors due to small time skews
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
      clockTolerance: 10, 
    });

    const claims = payload as unknown as FirebaseClaims;
    const uid = claims.uid ?? claims.sub;
    const email = claims.email ?? '';

    // Validate role: only known roles; default to PACIENTE
    const validRoles = ['MEDICO', 'SECRETARIA', 'PACIENTE'];
    const safeRole = validRoles.includes(role ?? '') ? role! : 'PACIENTE';

    // Create a signed session JWT (Next.js Edge compatible)
    const token = await new SignJWT({ uid, email, role: safeRole })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
      .sign(JWT_SECRET);

    const response = NextResponse.json({ success: true, role: safeRole });
    response.cookies.set('__session', token, {
      httpOnly: true,
      secure: true, // Always true since we use HTTPS or Vercel
      sameSite: 'lax', // Lax is better for OIDC flows
      maxAge: SESSION_DURATION_SECONDS,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Session API Error:', err.message);
    return NextResponse.json({ error: 'Unauthorized', details: err.message }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('__session', '', { maxAge: 0, path: '/' });
  return response;
}
