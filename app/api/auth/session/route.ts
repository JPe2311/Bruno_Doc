import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const SESSION_DURATION_SECONDS = 24 * 60 * 60; // 1 day

// Firebase public keys — no service account needed
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);
const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';

interface FirebaseClaims {
  uid: string;
  email?: string;
  sub: string;
}

/**
 * POST /api/auth/session
 * Verifies a Firebase ID token using Firebase's public JWKS (no service account required),
 * then issues an HttpOnly session cookie containing uid, email and role.
 * The role is sent by the client (already fetched from Firestore after login).
 * Firestore security rules enforce role-based access independently.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, role } = body as { idToken?: string; role?: string };

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    // Verify the Firebase ID token cryptographically using Firebase's public JWKS
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    const claims = payload as unknown as FirebaseClaims;
    const uid = claims.uid ?? claims.sub;
    const email = claims.email ?? '';

    // Validate role: only known roles are accepted; default to PACIENTE
    const validRoles = ['MEDICO', 'SECRETARIA', 'PACIENTE'];
    const safeRole = validRoles.includes(role ?? '') ? role! : 'PACIENTE';

    // Create a signed session JWT
    const token = await new SignJWT({ uid, email, role: safeRole })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
      .sign(JWT_SECRET);

    const response = NextResponse.json({ success: true });
    response.cookies.set('__session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_DURATION_SECONDS,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
}

/** DELETE /api/auth/session — Clears the session cookie */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('__session', '', { maxAge: 0, path: '/' });
  return response;
}
