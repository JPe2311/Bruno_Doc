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
        <div className="spinner" />
      </div>
    );
  }

  const noShowRate = stats.total > 0 ? Math.round((stats.noShow / stats.total) * 100) : 0;
  const nextDates = getNextWeekDates();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={user.role} />
      <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {user.role === 'PACIENTE' ? 'Mis Citas' : 'Panel de Analítica'}
            </h1>
            <p className="text-slate-500 mt-1">
              {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
          {user.role === 'PACIENTE' && (
            <Link href="/book" className="btn-primary shadow-lg shadow-blue-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva Cita
            </Link>
          )}
        </header>

        {user.role === 'PACIENTE' && (
          <section className="card border-none bg-gradient-to-br from-blue-600 to-blue-800 text-white p-8 relative overflow-hidden shadow-xl shadow-blue-900/10">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-sky-400/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="max-w-md">
                <h2 className="text-2xl font-bold mb-2">Solicitar una Cita</h2>
                <p className="text-blue-100 opacity-90 text-sm leading-relaxed">
                  Agende su próxima consulta médica en pocos segundos. Seleccione el profesional y el horario que mejor le convenga.
                </p>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {nextDates.map((date) => (
                  <Link
                    key={date.toISOString()}
                    href={`/book?date=${format(date, 'yyyy-MM-dd')}`}
                    className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white hover:text-blue-700 text-center transition-all duration-200 group"
                  >
                    <p className="text-[10px] uppercase font-bold tracking-wider opacity-70 group-hover:opacity-100 mb-1">{format(date, 'EEE', { locale: es })}</p>
                    <p className="text-xl font-black">{format(date, 'd')}</p>
                    <p className="text-[10px] uppercase font-bold opacity-70 group-hover:opacity-100">{format(date, 'MMM', { locale: es })}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Citas</p>
            <p className="text-3xl font-black text-slate-900 mt-2">{loading ? '...' : stats.total}</p>
          </div>

          <div className="card border-l-4 border-l-green-500">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2 bg-green-50 text-green-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Completadas</p>
            <p className="text-3xl font-black text-green-600 mt-2">{loading ? '...' : stats.completed}</p>
          </div>

          <div className="card border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </span>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">{noShowRate}%</span>
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">No-show</p>
            <p className="text-3xl font-black text-amber-600 mt-2">{loading ? '...' : stats.noShow}</p>
          </div>

          <div className="card border-l-4 border-l-red-500">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2 bg-red-50 text-red-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Canceladas</p>
            <p className="text-3xl font-black text-red-600 mt-2">{loading ? '...' : stats.cancelled}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
