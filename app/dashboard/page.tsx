'use client';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Appointment } from '@/lib/types/domain';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, completed: 0, noShow: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const now = new Date().toISOString();
        const q = query(collection(db, 'appointments'), where('date', '>=', now.split('T')[0]));
        const snap = await getDocs(q);
        const appointments = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Appointment[];
        setStats({
          total: appointments.length,
          completed: appointments.filter((a) => a.status === 'completed').length,
          noShow: appointments.filter((a) => a.status === 'no_show').length,
          cancelled: appointments.filter((a) => a.status === 'cancelled').length,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  const noShowRate = stats.total > 0 ? Math.round((stats.noShow / stats.total) * 100) : 0;
  const role = (user as { role?: string })?.role ?? 'PACIENTE';

  return (
    <div className="flex">
      <Sidebar role={role} />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Panel de Analitica</h1>
          <p className="text-sm text-slate-500">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="card">
            <p className="text-sm text-slate-500">Total citas</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{loading ? '...' : stats.total}</p>
          </article>
          <article className="card">
            <p className="text-sm text-slate-500">Completadas</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{loading ? '...' : stats.completed}</p>
          </article>
          <article className="card">
            <p className="text-sm text-slate-500">No-show %</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{loading ? '...' : `${noShowRate}%`}</p>
          </article>
          <article className="card">
            <p className="text-sm text-slate-500">Canceladas</p>
            <p className="text-3xl font-bold text-red-500 mt-1">{loading ? '...' : stats.cancelled}</p>
          </article>
        </section>
      </main>
    </div>
  );
}
