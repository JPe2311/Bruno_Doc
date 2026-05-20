'use client';
import { Suspense, useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc, writeBatch, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
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
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30'
];

export default function BookAppointmentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>}>
      <BookAppointmentContent />
    </Suspense>
  );
}

interface Patient {
  uid: string;
  fullName: string;
  dni?: string;
  phone?: string;
  email?: string;
  obraSocial?: string;
  address?: string;
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
  const [daySchedules, setDaySchedules] = useState<Record<DayOfWeek, string[]>>({
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
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
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientUid, setSelectedPatientUid] = useState('');
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [selectedPatientDni, setSelectedPatientDni] = useState('');
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ fullName: '', dni: '', phone: '', email: '', obraSocial: '', address: '', birthDate: '' });
  const [savingPatient, setSavingPatient] = useState(false);

  const isMedicoOrSecretaria = user?.role === 'MEDICO' || user?.role === 'SECRETARIA';

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchPatients = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'PACIENTE'));
      const snap = await getDocs(q);
      setPatients(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Patient)));
    };
    fetchPatients();
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      const fetchDoctors = async () => {
        const q = query(collection(db, 'users'), where('role', '==', 'MEDICO'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ uid: d.id, fullName: d.data().fullName as string }));
        setDoctors(list);
        if (list.length > 0 && !selectedDoctorUid) {
          const preselected = searchParams.get('doctor');
          if (preselected && list.find(l => l.uid === preselected)) {
            setSelectedDoctorUid(preselected);
            setDoctorName(list.find(l => l.uid === preselected)!.fullName);
          } else {
            setSelectedDoctorUid(list[0].uid);
            setDoctorName(list[0].fullName);
          }
        }
        setLoadingDoctors(false);
      };
      fetchDoctors();
    }
  }, [authLoading, user, searchParams, selectedDoctorUid]);

  useEffect(() => {
    if (!selectedDoctorUid) return;
    const fetchSchedule = async () => {
      const ref = doc(db, 'schedules', selectedDoctorUid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data.enabledDays) setEnabledDays(data.enabledDays);
        if (data.daySchedules) setDaySchedules(data.daySchedules);
      }
    };
    fetchSchedule();
  }, [selectedDoctorUid]);

  useEffect(() => {
    if (!selectedDate || !selectedDoctorUid) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayOfWeek = selectedDate.getDay() as DayOfWeek;
    if (!enabledDays[dayOfWeek]) {
      setAvailableSlots([]);
      return;
    }
    const daySlots = daySchedules[dayOfWeek] || [];
    if (daySlots.length === 0) {
      setAvailableSlots([]);
      return;
    }
    const fetchSlots = async () => {
      const q = query(collection(db, 'slots'), where('date', '==', dateStr));
      const snap = await getDocs(q);
      const busy = snap.docs.map(d => d.data().time);
      setBusySlots(busy);
      const daySlots = daySchedules[dayOfWeek] || [];
      setAvailableSlots(daySlots.filter(s => !busy.includes(s)));
    };
    fetchSlots();
  }, [selectedDate, selectedDoctorUid, enabledDays, daySchedules]);

  const handleCreatePatient = async () => {
    if (!newPatientForm.fullName.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSavingPatient(true);
    try {
      const userRef = doc(collection(db, 'users'));
      await setDoc(userRef, {
        ...newPatientForm,
        role: 'PACIENTE',
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
      });
      const newPatient: Patient = { uid: userRef.id, ...newPatientForm };
      setPatients(prev => [...prev, newPatient]);
      setPatients(prev => prev.map(p => p.uid === newPatient.uid ? { ...p, role: 'PACIENTE' } : p));
      setSelectedPatientUid(newPatient.uid);
      setSelectedPatientName(newPatientForm.fullName);
      setSelectedPatientDni(newPatientForm.dni);
      setShowNewPatientModal(false);
      setNewPatientForm({ fullName: '', dni: '', phone: '', email: '', obraSocial: '', address: '', birthDate: '' });
      toast.success('Paciente creado correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al crear paciente');
    } finally {
      setSavingPatient(false);
    }
  };

  const handleBook = async () => {
    if (!user || !selectedDate || !selectedTime || !appointmentType) {
      toast.error('Complete todos los campos'); return;
    }
    if (isMedicoOrSecretaria && !selectedPatientUid) {
      toast.error('Seleccione un paciente'); return;
    }
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const batch = writeBatch(db);
      const appRef = doc(collection(db, 'appointments'));
      
      const finalPatientUid = isMedicoOrSecretaria ? selectedPatientUid : user.uid;
      const finalPatientName = isMedicoOrSecretaria ? selectedPatientName : user.fullName || 'Paciente';
      const finalPatientDni = isMedicoOrSecretaria ? selectedPatientDni : user.dni || '';
      
      batch.set(appRef, {
        patientUid: finalPatientUid,
        patientName: finalPatientName,
        patientDni: finalPatientDni,
        doctorUid: selectedDoctorUid,
        doctorName,
        date: `${dateStr}T${selectedTime}:00`,
        status: isMedicoOrSecretaria ? 'confirmed' : 'pending',
        type: APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.label || appointmentType,
        notes: notes || '',
        createdAt: new Date().toISOString(),
      });
      batch.set(doc(collection(db, 'slots')), { date: dateStr, time: selectedTime, patientUid: finalPatientUid, appointmentId: appRef.id });
      await batch.commit();
      toast.success('¡Cita creada correctamente!');
      router.push('/appointments');
    } catch (err) { toast.error('Error al crear cita'); } finally { setLoading(false); }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const firstDayOfMonth = monthStart.getDay();
  const paddingDays = Array.from({ length: firstDayOfMonth }).map((_, i) => i);

  if (authLoading || !user) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar role={user.role} />
      </div>
      <MobileHeader role={user.role} />
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto pt-16 lg:pt-6 lg:ml-64">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          {isMedicoOrSecretaria ? 'Crear Cita para Paciente' : 'Reservar Cita'}
        </h1>

        {showNewPatientModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Nuevo Paciente</h3>
              <div className="space-y-3">
                <input type="text" placeholder="Nombre completo *" value={newPatientForm.fullName}
                  onChange={e => setNewPatientForm({...newPatientForm, fullName: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg p-3" />
                <input type="text" placeholder="DNI" value={newPatientForm.dni}
                  onChange={e => setNewPatientForm({...newPatientForm, dni: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg p-3" />
                <input type="tel" placeholder="Teléfono" value={newPatientForm.phone}
                  onChange={e => setNewPatientForm({...newPatientForm, phone: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg p-3" />
                <input type="email" placeholder="Email" value={newPatientForm.email}
                  onChange={e => setNewPatientForm({...newPatientForm, email: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg p-3" />
                <input type="text" placeholder="Obra Social" value={newPatientForm.obraSocial}
                  onChange={e => setNewPatientForm({...newPatientForm, obraSocial: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg p-3" />
                <input type="text" placeholder="Dirección" value={newPatientForm.address}
                  onChange={e => setNewPatientForm({...newPatientForm, address: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg p-3" />
                <input type="date" placeholder="Fecha de Nacimiento" value={newPatientForm.birthDate}
                  onChange={e => setNewPatientForm({...newPatientForm, birthDate: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg p-3" />
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowNewPatientModal(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button onClick={handleCreatePatient} disabled={savingPatient} className="flex-1 btn-primary">
                  {savingPatient ? 'Guardando...' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          <div className="lg:col-span-4 space-y-6">
            {isMedicoOrSecretaria && (
              <div className="card">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Seleccionar Paciente</h2>
                <div className="flex gap-2">
                  <select
                    value={selectedPatientUid}
                    onChange={e => {
                      const p = patients.find(p => p.uid === e.target.value);
                      setSelectedPatientUid(e.target.value);
                      setSelectedPatientName(p?.fullName || '');
                      setSelectedPatientDni(p?.dni || '');
                    }}
                    className="flex-1 border border-slate-200 rounded-lg p-3"
                  >
                    <option value="">Seleccionar paciente...</option>
                    {patients.map(p => (
                      <option key={p.uid} value={p.uid}>
                        {p.fullName} {p.dni ? `(${p.dni})` : ''}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setShowNewPatientModal(true)} className="btn-secondary !py-2 !px-4">
                    + Nuevo
                  </button>
                </div>
              </div>
            )}

            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Médico</h2>
              {loadingDoctors ? (
                <div className="spinner" />
              ) : (
                <select
                  value={selectedDoctorUid}
                  onChange={e => {
                    const d = doctors.find(d => d.uid === e.target.value);
                    setSelectedDoctorUid(e.target.value);
                    setDoctorName(d?.fullName || '');
                  }}
                  className="w-full border border-slate-200 rounded-lg p-3"
                >
                  {doctors.map(d => (
                    <option key={d.uid} value={d.uid}>{d.fullName}</option>
                  ))}
                </select>
              )}
            </div>

            <section className="card">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Fecha</h2>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 rounded">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                </button>
                <span className="font-semibold">{format(currentMonth, 'MMMM yyyy', { locale: es })}</span>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 rounded">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {weekDays.map(d => <span key={d} className="text-xs font-bold text-slate-400">{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {paddingDays.map(i => <div key={`pad-${i}`} />)}
                {calendarDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isPastDate = isPast(day) && !isToday(day);
                  const dayOfWeek = day.getDay() as DayOfWeek;
                  const isEnabled = enabledDays[dayOfWeek];
                  return (
                    <button
                      key={dateStr}
                      disabled={isPastDate || !isEnabled}
                      onClick={() => setSelectedDate(day)}
                      className={`p-2 rounded text-sm transition-colors ${
                        isSelected ? 'bg-blue-600 text-white' : 
                        !isEnabled || isPastDate ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-100'
                      }`}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            </section>

            {selectedDate && (
              <section className="card">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Horario disponible</h2>
                {availableSlots.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No hay horarios disponibles</p>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {availableSlots.map(time => (
                      <button key={time} onClick={() => setSelectedTime(time)}
                        className={`py-2 rounded text-sm font-medium transition-colors ${
                          selectedTime === time ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                        }`}>
                        {time}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="lg:col-span-3">
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

                  {isMedicoOrSecretaria && selectedPatientName && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth={2}/></svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Paciente</p>
                        <p className="text-sm font-bold text-slate-800">{selectedPatientName}</p>
                        {selectedPatientDni && <p className="text-xs text-slate-500">DNI: {selectedPatientDni}</p>}
                      </div>
                    </div>
                  )}

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

                <button onClick={handleBook} disabled={loading || !selectedTime || !appointmentType || (isMedicoOrSecretaria && !selectedPatientUid)}
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