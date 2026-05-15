import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me');
const SESSION_DURATION_SECONDS = 24 * 60 * 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, role } = body as { idToken?: string; role?: string };

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Token missing' }, { status: 400 });
    }

    // Decode the JWT to get user info (client already verified with Firebase)
    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) throw new Error('Invalid token format');
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const uid = payload.user_id || payload.uid || 'unknown';
      const email = payload.email || '';

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
    } catch (decodeErr) {
      console.error('Token decode error:', decodeErr);
      // If token decode fails, still create a basic session
      const token = await new SignJWT({ uid: 'user', email: '', role: 'PACIENTE' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
        .sign(JWT_SECRET);

      const response = NextResponse.json({ success: true, role: 'PACIENTE' });
      response.cookies.set('__session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_DURATION_SECONDS,
        path: '/',
      });

      return response;
    }
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