'use client';
import { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PatientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<Array<{ uid: string; fullName: string; dni: string; phone: string; obraSocial: string; email: string }>>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && user.role === 'PACIENTE') router.replace('/dashboard');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role === 'PACIENTE') return;
    const fetchPatients = async () => {
      try {
        const q = query(collection(db, 'users'));
        const snap = await getDocs(q);
        setPatients(snap.docs
          .map(d => ({
            uid: d.id,
            fullName: d.data().fullName || '',
            dni: d.data().dni || '',
            phone: d.data().phone || '',
            obraSocial: d.data().obraSocial || '',
            email: d.data().email || '',
            role: d.data().role,
          }))
          .filter(p => p.role === 'PACIENTE' || !p.role)
        );
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchPatients();
  }, [user]);

  const filtered = patients.filter(p => 
    p.fullName.toLowerCase().includes(search.toLowerCase()) || p.dni.includes(search)
  );

  if (authLoading || !user) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar role={user.role} />
      </div>
      <MobileHeader role={user.role} />
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 lg:space-y-8 pt-16 lg:pt-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Directorio de Pacientes</h1>
            <p className="text-slate-500 mt-1">Gestión centralizada de fichas médicas</p>
          </div>
          <div className="relative group">
            <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2}/></svg>
            <input
              type="text"
              placeholder="Nombre o DNI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-80 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
            />
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-24 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg>
            </div>
            <p className="text-slate-500 font-medium">{search ? 'No se encontraron coincidencias' : 'Aún no hay pacientes registrados'}</p>
          </div>
        ) : (
          <div className="card !p-0 overflow-hidden border-none shadow-xl shadow-slate-200/50">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">DNI / ID</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Obra Social</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Contacto</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => (
                  <tr key={p.uid} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                          {p.fullName.slice(0, 2)}
                        </div>
                        <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{p.fullName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{p.dni}</td>
                    <td className="px-6 py-4">
                      <span className="badge badge-sky border border-sky-200">{p.obraSocial || 'Particular'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{p.phone}</span>
                        <span className="text-[10px] text-slate-400">{p.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/pacientes/${p.uid}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm">
                        Ver Reportes
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2}/></svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
