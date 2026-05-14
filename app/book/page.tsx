'use client';
import { Suspense, useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DayOfWeek } from '@/lib/types/domain';

const APPOINTMENT_TYPES = [
  { value: 'consulta', label: 'Consulta medica' },
  { value: 'control', label: 'Control' },
  { value: 'urgencia', label: 'Urgencia' },
  { value: 'vacunas', label: 'Vacunas' },
  { value: 'examen', label: 'Examen de laboratorio' },
];

const DEFAULT_TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
];

const DAY_LABELS: Record<number, string> = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Jue', 5: 'Vie', 6: 'Sab',
};

function getAvailableDays(enabledDays: Record<DayOfWeek, boolean>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: Date[] = [];
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, i);
    const dow = d.getDay() as DayOfWeek;
    if (enabledDays[dow]) {
      dates.push(d);
    }
  }
  return dates;
}

export default function BookAppointmentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-50"><p className="text-slate-500">Cargando...</p></div>}>
      <BookAppointmentContent />
    </Suspense>
  );
}

function BookAppointmentContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [doctorUid, setDoctorUid] = useState('');
  const [doctorName, setDoctorName] = useState('Dr. Bruno');
  const [enabledDays, setEnabledDays] = useState<Record<DayOfWeek, boolean>>({
    0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false,
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [appointmentType, setAppointmentType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [busySlots, setBusySlots] = useState<string[]>([]);

  const availableDays = getAvailableDays(enabledDays);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchDoctorInfo = async () => {
      const q = query(collection(db, 'schedules'));
      const snap = await getDocs(q);
      if (snap.empty) {
        setAvailableSlots(DEFAULT_TIME_SLOTS);
        return;
      }
      for (const scheduleDoc of snap.docs) {
        const data = scheduleDoc.data();
        setDoctorUid(scheduleDoc.id);
        setDoctorName(data.doctorName || 'Dr. Bruno');
        if (data.enabledDays) setEnabledDays(data.enabledDays);
        if (data.timeSlots && data.timeSlots.length > 0) {
          setAvailableSlots(data.timeSlots.map((s: { start: string }) => s.start));
        } else {
          setAvailableSlots(DEFAULT_TIME_SLOTS);
        }
        break;
      }
    };
    fetchDoctorInfo();
  }, [user]);

  useEffect(() => {
    if (!doctorUid) return;
    if (!availableSlots.length) return;
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = new Date(dateParam + 'T12:00:00');
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setStep(2);
      }
    }
  }, [searchParams, doctorUid, availableSlots]);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const fetchBusySlots = async () => {
        const q = query(collection(db, 'slots'), where('date', '==', dateStr));
        const snap = await getDocs(q);
        const times = snap.docs.map(d => {
          const data = d.data();
          return (data.time as string) || '';
        }).filter(Boolean);
        setBusySlots(times);
      };
      fetchBusySlots();
    }
  }, [selectedDate]);

  const handleBook = async () => {
    if (!user || !selectedDate || !selectedTime || !appointmentType) {
      toast.error('Por favor complete todos los datos');
      return;
    }
    if (!doctorUid) {
      toast.error('No se ha configurado el medico. Contacte al administrador.');
      return;
    }
    if (busySlots.includes(selectedTime)) {
      toast.error('Este horario ya no esta disponible');
      return;
    }
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const dateTime = `${dateStr}T${selectedTime}:00`;
      const batch = writeBatch(db);
      const appointmentRef = doc(collection(db, 'appointments'));
      batch.set(appointmentRef, {
        patientUid: user.uid,
        patientName: (user as { fullName?: string }).fullName || 'Paciente',
        doctorUid,
        doctorName,
        date: dateTime,
        durationMinutes: 30,
        status: 'pending',
        type: APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.label || appointmentType,
        notes: notes || '',
        createdAt: new Date().toISOString(),
      });
      const slotRef = doc(collection(db, 'slots'));
      batch.set(slotRef, {
        date: dateStr,
        time: selectedTime,
        patientUid: user.uid,
        appointmentId: appointmentRef.id,
      });
      await batch.commit();
      toast.success('Cita solicitada! Pendiente de confirmacion por el medico.');
      router.push('/appointments');
    } catch (err) {
      console.error(err);
      toast.error('Error al reservar la cita');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  const role = (user as { role?: string })?.role ?? 'PACIENTE';

  return (
    <div className="flex">
      <Sidebar role={role} />
      <main className="flex-1 p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Reservar Cita con {doctorName}</h1>

        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
            <span className="text-sm font-medium">Seleccionar Fecha</span>
          </div>
          {step >= 1 && (
            <div>
              <p className="text-sm text-slate-500 mb-3">Selecciona un dia disponible:</p>
              <div className="grid grid-cols-5 gap-2">
                {availableDays.map((date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isPast = date < today;
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  const isToday = date.toDateString() === today.toDateString();
                  return (
                    <button
                      key={date.toISOString()}
                      disabled={isPast}
                      onClick={() => { setSelectedDate(date); setStep(2); }}
                      className={`p-2 rounded text-center text-sm transition-colors ${
                        isPast ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        : isSelected ? 'bg-sky-600 text-white'
                        : isToday ? 'bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100'
                        : 'bg-slate-50 hover:bg-sky-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <p className="text-xs">{DAY_LABELS[date.getDay()]}</p>
                      <p className="text-lg font-bold">{date.getDate()}</p>
                      <p className="text-xs">{format(date, 'MMM')}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {selectedDate && (
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
              <span className="text-sm font-medium">Seleccionar Horario</span>
            </div>
            {step >= 2 && (
              <div>
                <p className="text-sm text-slate-500 mb-3">
                  Horarios disponibles para {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <div className="space-y-2">
                  {availableSlots.map((time) => {
                    const isBusy = busySlots.includes(time);
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        disabled={isBusy}
                        onClick={() => { setSelectedTime(time); setStep(3); }}
                        className={`w-full py-2 px-4 rounded text-sm text-left transition-colors ${
                          isBusy ? 'bg-slate-100 text-slate-300 line-through cursor-not-allowed'
                          : isSelected ? 'bg-sky-600 text-white'
                          : 'bg-slate-50 hover:bg-sky-50 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTime && (
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 3 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3</span>
              <span className="text-sm font-medium">Tipo de Consulta</span>
            </div>
            {step >= 3 && (
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Tipo de cita</span>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-200 p-2.5 text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {APPOINTMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Notas (opcional)</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe brevemente tu motivo de consulta..."
                    className="mt-1 w-full rounded border border-slate-200 p-2.5 text-sm"
                    rows={3}
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {appointmentType && (
          <div className="card">
            <h3 className="font-medium text-slate-900 mb-4">Resumen de tu cita</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <p><span className="font-medium">Medico:</span> {doctorName}</p>
              <p><span className="font-medium">Fecha:</span> {selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p><span className="font-medium">Hora:</span> {selectedTime}</p>
              <p><span className="font-medium">Tipo:</span> {APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.label}</p>
              {notes && <p><span className="font-medium">Notas:</span> {notes}</p>}
            </div>
            <button
              onClick={handleBook}
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? 'Reservando...' : 'Confirmar Reserva'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
