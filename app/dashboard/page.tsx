'use client';
import { useEffect, useState } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Appointment } from '@/lib/types/domain';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

function getNextWeekDates() {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    if (d.getDay() !== 0) {
      dates.push(d);
    }
  }
  return dates.slice(0, 5);
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, completed: 0, noShow: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        let q;
        if (user.role === 'PACIENTE') {
          q = query(collection(db, 'appointments'), where('patientUid', '==', user.uid));
        } else {
          q = query(collection(db, 'appointments'));
        }
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

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  const noShowRate = stats.total > 0 ? Math.round((stats.noShow / stats.total) * 100) : 0;

  const nextDates = getNextWeekDates();

  return (
    <div className="flex">
      <Sidebar role={user.role} />
      <main className="flex-1 p-6 space-y-6">
        {user.role === 'PACIENTE' && (
          <section className="card border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Reservar una Cita</h2>
              <Link href="/book" className="text-sm text-sky-600 hover:underline font-medium">
                Ver todos los horarios
              </Link>
            </div>
            <p className="text-sm text-slate-500 mb-4">Selecciona un dia disponible para agendar tu consulta:</p>
            <div className="grid grid-cols-5 gap-3">
              {nextDates.map((date) => (
                <Link
                  key={date.toISOString()}
                  href={`/book?date=${format(date, 'yyyy-MM-dd')}`}
                  className="p-3 rounded-lg bg-white border border-sky-100 hover:border-sky-300 hover:bg-sky-50 text-center transition-colors"
                >
                  <p className="text-xs text-slate-500 uppercase">{format(date, 'EEE', { locale: es })}</p>
                  <p className="text-lg font-bold text-sky-700">{format(date, 'd')}</p>
                  <p className="text-xs text-slate-500">{format(date, 'MMM', { locale: es })}</p>
                </Link>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-sky-100">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-sky-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Reservar Cita
              </Link>
            </div>
          </section>
        )}

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">
            {user.role === 'PACIENTE' ? 'Mis Citas' : 'Panel de Analitica'}
          </h1>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
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
