'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface OnboardingForm {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  dni: string;
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<OnboardingForm>({
    fullName: user?.fullName ?? '',
    phone: '',
    email: user?.email ?? '',
    address: '',
    dni: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...form,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast.success('Perfil completado!');
      router.push('/dashboard');
    } catch {
      toast.error('Error al guardar los datos');
    } finally {
      setLoading(false);
    }
  };

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
          </div>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Direccion</span>
            <input name="address" value={form.address} onChange={handleChange} required className="w-full rounded border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </label>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
            {loading ? 'Guardando...' : 'Continuar'}
          </button>
        </form>
      </div>
    </main>
  );
}