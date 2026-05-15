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
      // Login successful - onAuthStateChanged will handle redirect
      // If no redirect happens in 5 seconds, reset button
      setTimeout(() => {
        if (clicked) {
          setClicked(false);
        }
      }, 5000);
    } catch (err: unknown) {
      const error = err as { code?: string };
      console.error(err);
      setErrorMsg(error.code === 'auth/popup-closed-by-user' ? 'Inicio de sesión cancelado.' : 'Error al conectar con Google. Intenta de nuevo.');
      setClicked(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        
        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-80 h-80 bg-sky-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        
        {/* Medical cross pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="medical-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M30 10v40M10 30h40" stroke="white" strokeWidth="2" fill="none"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#medical-pattern)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          {/* Logo - Large */}
          <div className="relative w-32 h-32">
            <Image src="/logo_bruno.png" alt="Bruno Doctor" fill className="object-contain" />
          </div>

          {/* Main Text */}
          <div className="max-w-lg">
            <h1 className="text-5xl xl:text-6xl font-bold text-white leading-tight mb-6">
              Tu gestión médica, <span className="text-sky-400">simplificada</span>
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed">
              Administra pacientes, citas y reportes de forma segura y eficiente. 
              Todo lo que necesitas en un solo lugar.
            </p>
            
            {/* Features */}
            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Citas online</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Reportes pdf</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Gestión de pacientes</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Datos seguros</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-slate-500 text-sm">
            © 2026 Bruno Doctor. Todos los derechos reservados.
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="relative w-20 h-20 mb-4">
              <Image src="/logo_bruno.png" alt="Bruno Doctor" fill className="object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Bruno Doctor</h2>
            <p className="text-slate-500">Sistema Médico Integral</p>
          </div>

          {/* Welcome Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 xl:p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-100 mb-4">
                <svg className="w-8 h-8 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Bienvenido</h3>
              <p className="text-slate-500">Ingresa con tu cuenta de Google para continuar</p>
            </div>

            {errorMsg && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-red-700">{errorMsg}</p>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={clicked}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-white border-2 border-slate-200 px-5 py-4 text-base font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {clicked ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continuar con Google</span>
                </>
              )}
            </button>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-xs font-medium">Conexión segura con Google</span>
              </div>
            </div>
          </div>

          {/* Help Text */}
          <p className="mt-6 text-center text-slate-400 text-sm">
            ¿Necesitas ayuda? Contacta al administrador del sistema
          </p>
        </div>
      </div>
    </div>
  );
}