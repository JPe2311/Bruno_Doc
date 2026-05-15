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
      setErrorMsg(err.code === 'auth/popup-closed-by-user' ? 'Inicio cancelado' : 'Error al conectar con Google');
      setClicked(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full flex items-center justify-center overflow-hidden z-[9999]">
      {/* Premium Clinical Gradient Background */}
      <div className="absolute inset-0 bg-[#f8fafc]">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-100 rounded-full blur-[120px] opacity-60" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-sky-100 rounded-full blur-[120px] opacity-60" />
        <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-indigo-50 rounded-full blur-[100px] opacity-40" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 animate-fadeIn">
        <div className="bg-white/80 backdrop-blur-xl border border-white shadow-2xl shadow-blue-900/10 rounded-[32px] p-10 flex flex-col items-center text-center">
          
          {/* Logo Container */}
          <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="relative w-40 h-12">
              <Image src="/logo_bruno.png" alt="Bruno Doctor" fill className="object-contain" priority />
            </div>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            Gestión Médica Pro
          </h1>
          <p className="text-slate-500 text-sm font-medium mb-10 leading-relaxed">
            Acceda de forma segura a su historial clínico y agenda de citas.
          </p>

          {errorMsg && (
            <div className="w-full mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-bold animate-pulse">
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={clicked}
            className="group relative w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border-2 border-slate-100 hover:border-blue-500 py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-slate-700 font-bold tracking-tight">
              {clicked ? 'Conectando...' : 'Entrar con Google'}
            </span>
          </button>

          <div className="mt-10 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth={2.5}/></svg>
            Seguridad Clínica Cifrada
          </div>
        </div>
      </div>
    </div>
  );
}
