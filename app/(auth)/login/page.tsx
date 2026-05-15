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
      // Auth context will handle the redirection once user is detected
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.code === 'auth/popup-closed-by-user' ? 'Inicio de sesión cancelado.' : 'Ocurrió un error al conectar con Google.');
      setClicked(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left Pane - Visual/Branding (Hidden on mobile) */}
      <div className="relative hidden w-0 flex-1 lg:block overflow-hidden">
        {/* Deep, premium gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f2044] to-[#1a3a6e]" />
        
        {/* Subtle geometric pattern overlay for texture */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.05]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="premium-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M0 40L40 0H20L0 20M40 40V20L20 40" stroke="white" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#premium-pattern)" />
        </svg>

        {/* Ambient glows */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-500/20 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-sky-400/10 blur-[120px]" />

        {/* Content over the background */}
        <div className="absolute inset-0 flex flex-col justify-between p-16 xl:p-24">
          <div className="flex items-center gap-3">
            {/* Minimalist icon representation */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-widest text-white uppercase">Bruno Doctor</span>
          </div>

          <div className="mb-12 max-w-xl">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight mb-6">
              Excelencia clínica <br /> a tu alcance.
            </h1>
            <p className="text-lg text-blue-100/80 leading-relaxed font-light">
              Plataforma de gestión médica integral. Diseñada con estándares de máxima seguridad para profesionales de la salud y sus pacientes.
            </p>
          </div>
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="flex flex-1 flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-[480px] xl:w-[560px] 2xl:w-[640px] lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          
          {/* Mobile Logo (Visible only on small screens) */}
          <div className="lg:hidden flex justify-center mb-10">
            <div className="relative w-48 h-14">
              <Image src="/logo_bruno.png" alt="Bruno Doctor" fill className="object-contain" priority />
            </div>
          </div>

          <div className="text-left mb-10">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Bienvenido
            </h2>
            <p className="mt-3 text-[15px] text-slate-500 font-medium">
              Ingresa a tu portal seguro para continuar.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 animate-fadeIn">
              <svg className="h-5 w-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-red-800">{errorMsg}</p>
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={handleLogin}
              disabled={clicked}
              className="group relative flex w-full items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[15px] font-semibold text-slate-700 shadow-sm transition-all duration-200 ease-in-out hover:bg-slate-50 hover:border-slate-300 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{clicked ? 'Estableciendo conexión segura...' : 'Continuar con Google'}</span>
            </button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-2 text-center text-sm text-slate-500">
            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Conexión cifrada de extremo a extremo
          </div>
        </div>
      </div>
    </div>
  );
}
