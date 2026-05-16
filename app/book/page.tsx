'use client';
import { Suspense, useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  addDays, format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameMonth, isSameDay, addMonths, subMonths, isPast, isToday, startOfDay 
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { DayOfWeek } from '@/lib/types/domain';

const APPOINTMENT_TYPES = [
  { value: 'consulta', label: 'Consulta médica' },
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

export default function BookAppointmentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>}>
      <BookAppointmentContent />
    </Suspense>
  );
}

function BookAppointmentContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [doctors, setDoctors] = useState<Array<{ uid: string; fullName: string }>>([]);
  const [selectedDoctorUid, setSelectedDoctorUid] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [enabledDays, setEnabledDays] = useState<Record<DayOfWeek, boolean>>({
    0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false,
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [appointmentType, setAppointmentType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // Initial fetch
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchDoctors = async () => {
      setLoadingDoctors(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'MEDICO'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ uid: d.id, fullName: d.data().fullName || 'Dr. sin nombre' }));
        setDoctors(list);
        if (list.length > 0) {
          setSelectedDoctorUid(list[0].uid);
          setDoctorName(list[0].fullName);
        }
      } catch (err) { console.error(err); } finally { setLoadingDoctors(false); }
    };
    fetchDoctors();
  }, [user]);

  useEffect(() => {
    if (!selectedDoctorUid) return;
    const fetchSchedule = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'schedules', selectedDoctorUid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.enabledDays) setEnabledDays(data.enabledDays);
          setAvailableSlots(data.timeSlots?.length > 0 ? data.timeSlots.map((s: any) => s.start) : DEFAULT_TIME_SLOTS);
        } else {
          setAvailableSlots(DEFAULT_TIME_SLOTS);
        }
      } catch (err) { console.error(err); setAvailableSlots(DEFAULT_TIME_SLOTS); }
    };
    fetchSchedule();
  }, [selectedDoctorUid]);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const fetchBusy = async () => {
        const q = query(collection(db, 'slots'), where('date', '==', dateStr));
        const snap = await getDocs(q);
        setBusySlots(snap.docs.map(d => d.data().time as string));
      };
      fetchBusy();
    }
  }, [selectedDate]);

  const handleBook = async () => {
    if (!user || !selectedDate || !selectedTime || !appointmentType) {
      toast.error('Complete todos los campos'); return;
    }
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const batch = writeBatch(db);
      const appRef = doc(collection(db, 'appointments'));
      batch.set(appRef, {
        patientUid: user.uid,
        patientName: user.fullName || 'Paciente',
        patientDni: user.dni || '',
        doctorUid: selectedDoctorUid,
        doctorName,
        date: `${dateStr}T${selectedTime}:00`,
        status: 'pending',
        type: APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.label || appointmentType,
        notes: notes || '',
        createdAt: new Date().toISOString(),
      });
      batch.set(doc(collection(db, 'slots')), { date: dateStr, time: selectedTime, patientUid: user.uid, appointmentId: appRef.id });
      await batch.commit();
      toast.success('¡Cita solicitada correctamente!');
      router.push('/appointments');
    } catch (err) { toast.error('Error al reservar'); } finally { setLoading(false); }
  };

  // Calendar Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = monthStart;
  const endDate = monthEnd;
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const firstDayOfMonth = monthStart.getDay();
  const paddingDays = Array.from({ length: firstDayOfMonth }).map((_, i) => i);

  if (authLoading || !user) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={user.role} />
      <main className="flex-1 p-8 max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Nueva Cita</h1>
          <p className="text-slate-500 mt-1">Siga los pasos para agendar su consulta</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form Side */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Step 1: Doctor */}
            <section className="card">
              <h2 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4">1. Médico</h2>
              {loadingDoctors ? <div className="spinner" /> : (
                <div className="grid grid-cols-1 gap-2">
                  {doctors.map(d => (
                    <button key={d.uid} onClick={() => { setSelectedDoctorUid(d.uid); setDoctorName(d.fullName); }}
                      className={`p-4 rounded-xl text-left border-2 transition-all ${selectedDoctorUid === d.uid ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-blue-200'}`}>
                      <p className={`font-bold ${selectedDoctorUid === d.uid ? 'text-blue-700' : 'text-slate-700'}`}>{d.fullName}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Step 2: Calendar */}
            <section className="card">
              <h2 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4">2. Fecha</h2>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 capitalize">{format(currentMonth, 'MMMM yyyy', { locale: es })}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2}/></svg>
                    </button>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2}/></svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekDays.map(d => <span key={d} className="text-[10px] font-black text-slate-400 text-center uppercase tracking-tighter">{d}</span>)}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {paddingDays.map(p => <div key={`pad-${p}`} />)}
                  {calendarDays.map(date => {
                    const dow = date.getDay() as DayOfWeek;
                    const isEnabled = enabledDays[dow];
                    const past = isPast(date) && !isToday(date);
                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                    const disabled = !isEnabled || past;

                    return (
                      <button key={date.toISOString()} disabled={disabled}
                        onClick={() => { setSelectedDate(date); setSelectedTime(''); }}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${
                          isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 transform scale-110 z-10' :
                          disabled ? 'text-slate-200 cursor-not-allowed' :
                          'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600 border border-slate-100 hover:border-blue-100'
                        }`}>
                        <span className="text-sm font-bold">{format(date, 'd')}</span>
                        {isToday(date) && !isSelected && <span className="w-1 h-1 bg-blue-500 rounded-full mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Step 3: Time */}
            {selectedDate && (
              <section className="card animate-fadeIn">
                <h2 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4">3. Horario</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map(time => {
                    const isBusy = busySlots.includes(time);
                    const isSelected = selectedTime === time;
                    return (
                      <button key={time} disabled={isBusy} onClick={() => setSelectedTime(time)}
                        className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                          isSelected ? 'bg-blue-600 text-white shadow-md' :
                          isBusy ? 'bg-slate-100 text-slate-300 line-through' :
                          'bg-slate-50 text-slate-700 hover:bg-blue-50 border border-slate-100'
                        }`}>
                        {time}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Details Side */}
          <div className="lg:col-span-5 space-y-6">
            <section className="card bg-white border-2 border-blue-100 shadow-xl shadow-blue-900/5 sticky top-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Resumen de Cita</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Detalles de Consulta</label>
                  <select value={appointmentType} onChange={e => setAppointmentType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Tipo de consulta...</option>
                    {APPOINTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth={2}/></svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Médico</p>
                      <p className="text-sm font-bold text-slate-800">{doctorName || 'No seleccionado'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2}/></svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Fecha y Hora</p>
                      <p className="text-sm font-bold text-slate-800">
                        {selectedDate ? format(selectedDate, "d 'de' MMMM", { locale: es }) : 'Día no elegido'}
                        {selectedTime && ` a las ${selectedTime} hs`}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Notas adicionales</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                    placeholder="¿Algún síntoma o motivo específico?"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                </div>

                <button onClick={handleBook} disabled={loading || !selectedTime || !appointmentType}
                  className="btn-primary w-full shadow-lg shadow-blue-500/20 py-4 text-base disabled:grayscale disabled:opacity-50">
                  {loading ? 'Procesando...' : 'Confirmar Cita'}
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
