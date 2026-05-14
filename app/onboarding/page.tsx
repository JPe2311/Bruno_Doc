'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', address: '', dni: '', obraSocial: '' });

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
    if (user && user.fullName && user.phone) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        fullName: (user as { displayName?: string }).displayName ?? '',
        email: (user as { email?: string }).email ?? '',
      }));
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { ...form }, { merge: true });
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Completa tu Perfil</h1>
        <p className="text-slate-500 mb-6">Ingresa tus datos para continuar</p>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Nombre completo</span>
              <input name="fullName" value={form.fullName} onChange={handleChange} required className="w-full rounded border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">DNI</span>
              <input name="dni" value={form.dni} onChange={handleChange} required className="w-full rounded border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">WhatsApp</span>
              <input name="phone" value={form.phone} onChange={handleChange} required type="tel" className="w-full rounded border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input name="email" value={form.email} onChange={handleChange} required type="email" className="w-full rounded border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Obra Social</span>
              <input name="obraSocial" value={form.obraSocial} onChange={handleChange} className="w-full rounded border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </label>
          </div>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Direccion</span>
            <input name="address" value={form.address} onChange={handleChange} required className="w-full rounded border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </label>
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Continuar'}
          </button>
        </form>
      </div>
    </main>
  );
}
