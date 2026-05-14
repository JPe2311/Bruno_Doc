'use client';
import { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';

export default function PatientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<Array<{ uid: string; fullName: string; dni: string; phone: string; obraSocial: string; email: string }>>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
    if (!authLoading && user && user.role === 'PACIENTE') {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role === 'PACIENTE') return;
    const fetchPatients = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'PACIENTE'));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({
          uid: d.id,
          fullName: d.data().fullName || '',
          dni: d.data().dni || '',
          phone: d.data().phone || '',
          obraSocial: d.data().obraSocial || '',
          email: d.data().email || '',
        }));
        setPatients(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, [user]);

  const filtered = patients.filter(
    (p) =>
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.dni.includes(search)
  );

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar role={user.role} />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Pacientes</h1>
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 rounded border border-slate-200 p-2.5 text-sm"
          />
        </div>

        {loading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-slate-500">{search ? 'No se encontraron pacientes' : 'No hay pacientes registrados'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-3 font-medium">Nombre</th>
                  <th className="pb-3 font-medium">DNI</th>
                  <th className="pb-3 font-medium">Telefono</th>
                  <th className="pb-3 font-medium">Obra Social</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((p) => (
                  <tr key={p.uid} className="hover:bg-slate-50">
                    <td className="py-3 text-slate-900 font-medium">{p.fullName}</td>
                    <td className="py-3 text-slate-600">{p.dni}</td>
                    <td className="py-3 text-slate-600">{p.phone}</td>
                    <td className="py-3 text-slate-600">{p.obraSocial || '-'}</td>
                    <td className="py-3 text-slate-600">{p.email}</td>
                    <td className="py-3">
                      <a
                        href={`/pacientes/${p.uid}`}
                        className="px-3 py-1.5 rounded text-xs font-medium bg-sky-100 text-sky-700 hover:bg-sky-200"
                      >
                        Ver Reportes
                      </a>
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
