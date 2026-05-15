'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [clicked, setClicked] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(user.fullName ? '/dashboard' : '/onboarding');
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    if (clicked) return;
    setClicked(true);
    setErrorMsg('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Ventana cerrada. Intente de nuevo.');
      } else if (e.code === 'auth/popup-blocked') {
        setErrorMsg('Permita ventanas emergentes para este sitio e intente de nuevo.');
      } else {
        setErrorMsg('Error al iniciar sesión. Intente de nuevo.');
      }
      setClicked(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 40%, #f8fafc 100%)',
      }}
    >
      {/* Decorative blobs */}
      <div style={{
        position: 'fixed', top: '-10%', right: '-5%',
        width: '480px', height: '480px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-15%', left: '-8%',
        width: '560px', height: '560px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56,189,248,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        padding: '3rem 2.5rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.75rem' }}>
          <div style={{ position: 'relative', width: '180px', height: '52px' }}>
            <Image src="/logo_bruno.png" alt="Bruno Doctor" fill className="object-contain" />
          </div>
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.375rem' }}>
          Bienvenido
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '2rem' }}>
          Sistema de gestión médica seguro
        </p>

        {/* Error */}
        {errorMsg && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '10px', padding: '0.75rem 1rem',
            marginBottom: '1.25rem', fontSize: '0.8125rem', color: '#b91c1c',
          }}>
            {errorMsg}
          </div>
        )}

        {/* Google button */}
        <button
          onClick={handleLogin}
          disabled={clicked}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            width: '100%', padding: '0.75rem 1.25rem',
            background: clicked ? '#f8fafc' : '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '0.9375rem', fontWeight: 500, color: '#1e293b',
            cursor: clicked ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'all 0.15s ease',
            opacity: clicked ? 0.65 : 1,
          }}
          onMouseEnter={(e) => { if (!clicked) { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#cbd5e1'; } }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; }}
        >
          {/* Google icon */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {clicked ? 'Iniciando sesión...' : 'Continuar con Google'}
        </button>

        {/* Security note */}
        <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
          <svg width="13" height="13" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Acceso protegido · Datos cifrados
          </span>
        </div>
      </div>
    </main>
  );
}
