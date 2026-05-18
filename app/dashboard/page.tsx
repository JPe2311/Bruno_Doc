'use client';
import { useEffect, useState } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Appointment } from '@/lib/types/domain';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO, isToday, isSameDay, startOfDay, endOfDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchAppointments = async () => {
      try {
        let q;
        if (user.role === 'PACIENTE') {
          q = query(collection(db, 'appointments'), where('patientUid', '==', user.uid));
        } else if (user.role === 'MEDICO') {
          q = query(collection(db, 'appointments'), where('doctorUid', '==', user.uid));
        } else {
          q = query(collection(db, 'appointments'));
        }
        const snap = await getDocs(q);
        const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Appointment[];
        setAppointments(apps.filter(a => a.status !== 'cancelled'));
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
        <div className="spinner" />
      </div>
    );
  }

  const now = new Date();
  const todayAppointments = appointments.filter(a => {
    const aptDate = parseISO(a.date);
    return isSameDay(aptDate, now) && a.status !== 'cancelled';
  });

  const pendingAppointments = appointments.filter(a => a.status === 'pending');

  const nextAppointment = appointments
    .filter(a => {
      const aptDate = parseISO(a.date);
      return aptDate > now && a.status !== 'cancelled';
    })
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())[0];

  const isMedicoOrSecretaria = user.role === 'MEDICO' || user.role === 'SECRETARIA';

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar role={user.role} />
      </div>
      <MobileHeader role={user.role} />
      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto space-y-6 pt-16 lg:pt-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">
              {format(now, "EEEE", { locale: es })} {format(now, "d")} de {format(now, "MMMM", { locale: es })}
            </p>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              {format(now, "HH:mm")}
            </h1>
          </div>
          <div className="lg:hidden text-right">
            <p className="text-xs text-slate-500">Citas hoy</p>
            <p className="text-2xl font-bold text-blue-600">{todayAppointments.length}</p>
          </div>
        </header>

        {isMedicoOrSecretaria && (
          <div className="flex flex-wrap gap-2">
            <Link href="/book" className="btn-primary !py-2 !px-3 md:!px-4 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Nueva Cita</span>
              <span className="sm:hidden">Cita</span>
            </Link>
            <Link href="/book" className="btn-secondary !py-2 !px-3 md:!px-4 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span className="hidden sm:inline">Nuevo Paciente</span>
              <span className="sm:hidden">Paciente</span>
            </Link>
          </div>
        )}

        {isMedicoOrSecretaria && (
          <div className="card bg-gradient-to-r from-sky-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sky-100 text-sm font-medium">Citas para hoy</p>
                <p className="text-4xl font-bold">{loading ? '...' : todayAppointments.length}</p>
              </div>
              <svg className="w-12 h-12 text-sky-200 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
</div>
          )}

        {isMedicoOrSecretaria && pendingAppointments.length > 0 && (
          <div className="lg:hidden card bg-orange-50 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-700 text-sm font-medium">Pendientes de aprobación</p>
                <p className="text-3xl font-bold text-orange-600">{pendingAppointments.length}</p>
              </div>
              <Link href="/appointments" className="text-sm text-orange-600 hover:underline font-medium">
                Ver →
              </Link>
            </div>
          </div>
        )}

        {nextAppointment && isMedicoOrSecretaria && (
          <div className="card border-l-4 border-l-orange-500 bg-orange-50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Próxima Cita</p>
                <p className="font-bold text-slate-900 text-lg">{nextAppointment.patientName}</p>
                <p className="text-sm text-slate-600 mt-1">
                  {format(parseISO(nextAppointment.date), "HH:mm")} hs - {format(parseISO(nextAppointment.date), "d 'de' MMMM", { locale: es })}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span>{nextAppointment.type}</span>
                  <span>DNI: {nextAppointment.patientDni || nextAppointment.patientUid.slice(0, 8)}</span>
                </div>
              </div>
              <Link href={`/appointments`} className="btn-secondary !py-1 !px-3 text-xs">
                Ver todas
              </Link>
            </div>
          </div>
        )}

        {user.role === 'PACIENTE' && (
          <>
            <Link href="/book" className="lg:hidden block w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-bold text-center shadow-lg">
              + Reservar Nueva Cita
            </Link>
            <section className="hidden lg:block card border-none bg-gradient-to-br from-blue-600 to-blue-800 text-white p-6 shadow-lg">
              <div className="relative z-10">
                <h2 className="text-xl font-bold mb-2">Solicitar una Cita</h2>
                <p className="text-blue-100 text-sm mb-4">
                  Reserve su próxima consulta médica.
                </p>
                <Link href="/book" className="btn-primary bg-white text-blue-700 hover:bg-blue-50">
                  Nueva Cita
                </Link>
              </div>
            </section>

            {nextAppointment && (
              <div className="card border-l-4 border-l-blue-500">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase">Próxima Cita</p>
                    <p className="font-bold text-slate-900">{nextAppointment.doctorName}</p>
                    <p className="text-sm text-slate-500">
                      {format(parseISO(nextAppointment.date), "HH:mm 'hs'")} - {format(parseISO(nextAppointment.date), "d 'de' MMMM", { locale: es })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {isMedicoOrSecretaria && todayAppointments.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-slate-900 mb-4">Citas de Hoy</h3>
            <div className="space-y-3">
              {todayAppointments.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-700 w-12">{format(parseISO(a.date), 'HH:mm')}</span>
                    <div>
                      <p className="font-medium text-slate-900">{a.patientName}</p>
                      <p className="text-xs text-slate-500">{a.type}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    a.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    a.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {a.status === 'confirmed' ? 'Confirmada' : a.status === 'pending' ? 'Pendiente' : a.status}
                  </span>
                </div>
              ))}
              {todayAppointments.length > 5 && (
                <Link href="/appointments" className="block text-center text-sm text-blue-600 hover:underline">
                  Ver las {todayAppointments.length} citas de hoy
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}