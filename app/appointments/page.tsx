'use client';
import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import { Appointment, AppointmentStatus } from '@/lib/types/domain';
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Programada', color: 'text-blue-700', bg: 'bg-blue-100' },
  confirmed: { label: 'Confirmada', color: 'text-green-700', bg: 'bg-green-100' },
  in_progress: { label: 'En curso', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  completed: { label: 'Completada', color: 'text-slate-700', bg: 'bg-slate-100' },
  cancelled: { label: 'Cancelada', color: 'text-red-700', bg: 'bg-red-100' },
  no_show: { label: 'No asistio', color: 'text-gray-700', bg: 'bg-gray-100' },
};

export default function AppointmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchAppointments = async () => {
      try {
        const role = (user as { role?: string }).role;
        let q;
        if (role === 'PACIENTE') {
          q = query(collection(db, 'appointments'), where('patientUid', '==', user.uid), orderBy('date', 'desc'));
        } else {
          q = query(collection(db, 'appointments'), orderBy('date', 'desc'));
        }
        const snap = await getDocs(q);
        const filtered = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Appointment[];
        setAppointments(filtered);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  const role = (user as { role?: string })?.role ?? 'PACIENTE';

  const filteredAppointments = appointments.filter(a => {
    const date = parseISO(a.date);
    if (filter === 'upcoming') return isFuture(date) || isToday(date);
    if (filter === 'past') return isPast(date) && !isToday(date);
    return true;
  });

  return (
    <div className="flex">
      <Sidebar role={role} />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Mis Citas</h1>
          {role === 'PACIENTE' && (
            <a href="/book" className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700">
              + Nueva Cita
            </a>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          {(['all', 'upcoming', 'past'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm ${filter === f ? 'bg-sky-100 text-sky-700 font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {f === 'all' ? 'Todas' : f === 'upcoming' ? 'Proximas' : 'Pasadas'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : filteredAppointments.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-slate-500 mb-4">No tienes citas {filter !== 'all' ? (filter === 'upcoming' ? 'proximas' : 'pasadas') : ''}</p>
            {role === 'PACIENTE' && filter === 'upcoming' && (
              <a href="/book" className="text-sky-600 hover:underline">Reservar una cita</a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map((a) => {
              const status = STATUS_CONFIG[a.status as AppointmentStatus] || STATUS_CONFIG.scheduled;
              const date = parseISO(a.date);
              return (
                <div key={a.id} className="card flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-slate-900">{a.type}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {format(date, "EEEE d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                    {role !== 'PACIENTE' && (
                      <p className="text-sm text-slate-600">Paciente: {a.patientName}</p>
                    )}
                    {a.notes && <p className="text-xs text-slate-500 mt-2 italic">{a.notes}</p>}
                  </div>
                  <div className={`w-3 h-3 rounded-full ${isToday(date) ? 'bg-blue-500' : isFuture(date) ? 'bg-green-500' : 'bg-slate-300'}`} />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
