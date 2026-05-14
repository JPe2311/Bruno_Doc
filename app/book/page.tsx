'use client';
import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
];

const APPOINTMENT_TYPES = [
  { value: 'consulta', label: 'Consulta medica' },
  { value: 'control', label: 'Control' },
  { value: 'urgencia', label: 'Urgencia' },
  { value: 'vacunas', label: 'Vacunas' },
  { value: 'examen', label: 'Examen de laboratorio' },
];

function getWeekDates() {
  const dates = [];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export default function BookAppointmentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [appointmentType, setAppointmentType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const weekDates = getWeekDates();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const fetchBusySlots = async () => {
        const q = query(collection(db, 'appointments'), where('date', '>=', dateStr + 'T00:00'), where('date', '<', dateStr + 'T23:59'));
        const snap = await getDocs(q);
        const slots = snap.docs.map(d => {
          const data = d.data();
          const time = data.date.split('T')[1]?.substring(0, 5) || '';
          return time;
        }).filter(Boolean);
        setBusySlots(slots);
      };
      fetchBusySlots();
    }
  }, [selectedDate]);

  const handleBook = async () => {
    if (!user || !selectedDate || !selectedTime || !appointmentType) return;
    setLoading(true);
    try {
      const dateTime = `${selectedDate.toISOString().split('T')[0]}T${selectedTime}:00`;
      await addDoc(collection(db, 'appointments'), {
        patientUid: user.uid,
        patientName: (user as { fullName?: string }).fullName || (user as { displayName?: string }).displayName || 'Paciente',
        doctorUid: 'default_doctor',
        doctorName: 'Dr. Bruno',
        date: dateTime,
        durationMinutes: 30,
        status: 'scheduled',
        type: APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.label || appointmentType,
        notes: notes || '',
        createdAt: new Date().toISOString(),
      });
      toast.success('Cita reservada correctamente!');
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex">
      <Sidebar role={role} />
      <main className="flex-1 p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Reservar Cita</h1>

        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
            <span className="text-sm font-medium">Seleccionar Fecha</span>
          </div>
          {step >= 1 && (
            <div>
              <p className="text-sm text-slate-500 mb-3">Selecciona un dia de esta semana:</p>
              <div className="grid grid-cols-7 gap-2">
                {weekDates.map((date) => {
                  const isPast = date < new Date(new Date().setHours(0,0,0,0));
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  return (
                    <button
                      key={date.toISOString()}
                      disabled={isPast}
                      onClick={() => { setSelectedDate(date); setStep(2); }}
                      className={`p-2 rounded text-center text-sm ${isPast ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : isSelected ? 'bg-sky-600 text-white' : 'bg-slate-50 hover:bg-sky-50 text-slate-700'}`}
                    >
                      {formatDate(date)}
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
                <p className="text-sm text-slate-500 mb-3">Horarios disponibles para {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}:</p>
                <div className="grid grid-cols-6 gap-2">
                  {TIME_SLOTS.map((time) => {
                    const isBusy = busySlots.includes(time);
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        disabled={isBusy}
                        onClick={() => setSelectedTime(time)}
                        className={`py-2 px-3 rounded text-sm ${isBusy ? 'bg-slate-100 text-slate-300 line-through cursor-not-allowed' : isSelected ? 'bg-sky-600 text-white' : 'bg-slate-50 hover:bg-sky-50 text-slate-700 border'}`}
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