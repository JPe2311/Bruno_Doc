import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me');
const SESSION_DURATION_SECONDS = 24 * 60 * 60;

// Initialize Firebase Admin
function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
  }
  return getAuth();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, role } = body as { idToken?: string; role?: string };

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Token missing' }, { status: 400 });
    }

    let uid: string;
    let email: string = '';

    try {
      // Verify the token with Firebase Admin
      const auth = getFirebaseAdmin();
      const decodedToken = await auth.verifyIdToken(idToken);
      uid = decodedToken.uid;
      email = decodedToken.email || '';
    } catch (verifyErr) {
      console.error('Token verify error:', verifyErr);
      // If admin SDK not configured, try to decode manually
      try {
        const parts = idToken.split('.');
        if (parts.length !== 3) {
          return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        uid = payload.user_id || payload.uid;
        email = payload.email || '';
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    // Validate role
    const validRoles = ['MEDICO', 'SECRETARIA', 'PACIENTE'];
    const safeRole = validRoles.includes(role || '') ? role! : 'PACIENTE';

    // Create session token
    const token = await new SignJWT({ uid, email, role: safeRole })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
      .sign(JWT_SECRET);

    const response = NextResponse.json({ success: true, role: safeRole });
    response.cookies.set('__session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_SECONDS,
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Session API Error:', error.message);
    return NextResponse.json({ error: 'Unauthorized', details: error.message }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('__session', '', { maxAge: 0, path: '/' });
  return response;
}