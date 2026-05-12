'use client';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { DayCalendar } from '@/components/calendar/day-calendar';
import { Appointment } from '@/lib/types/domain';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate] = useState(new Date());

  useEffect(() => {
    if (!user) return;
    const fetchAppointments = async () => {
      try {
        const dayStart = format(startOfDay(selectedDate), 'yyyy-MM-dd');
        const dayEnd = format(endOfDay(selectedDate), 'yyyy-MM-dd');
        let q;
        if ((user as { role?: string }).role === 'PACIENTE') {
          q = query(
            collection(db, 'appointments'),
            where('patientUid', '==', user.uid),
            where('date', '>=', dayStart),
            where('date', '<=', dayEnd),
            orderBy('date')
          );
        } else {
          q = query(
            collection(db, 'appointments'),
            where('date', '>=', dayStart),
            where('date', '<=', dayEnd),
            orderBy('date')
          );
        }
        const snap = await getDocs(q);
        setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Appointment[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, [user, selectedDate]);

  const role = (user as { role?: string })?.role ?? 'PACIENTE';

  return (
    <div className="flex">
      <Sidebar role={role} />
      <main className="flex-1 p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Citas del {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })}</h1>
        </div>
        {loading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : (
          <DayCalendar appointments={appointments} />
        )}
      </main>
    </div>
  );
}
