'use client';
import { useEffect, useState } from 'react';
import { collection, query, getDocs, getDoc, doc, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Appointment, AppointmentStatus } from '@/lib/types/domain';
import { format, parseISO, isToday, isFuture, isPast, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: 'text-amber-700', bg: 'bg-amber-100' },
  scheduled: { label: 'Programada', color: 'text-blue-700', bg: 'bg-blue-100' },
  confirmed: { label: 'Confirmada', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  in_progress: { label: 'En curso', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  completed: { label: 'Completada', color: 'text-slate-700', bg: 'bg-slate-100' },
  cancelled: { label: 'Cancelada', color: 'text-red-700', bg: 'bg-red-100' },
  no_show: { label: 'No asistió', color: 'text-gray-700', bg: 'bg-gray-100' },
};

export default function AppointmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'pending'>('all');
  const [caseMap, setCaseMap] = useState<Set<string>>(new Set());
  const [doctorClinic, setDoctorClinic] = useState<{ address: string; maps: string; phone: string }>({ address: '', maps: '', phone: '' });
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelAppointmentId, setCancelAppointmentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

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
          q = query(collection(db, 'appointments'), where('patientUid', '==', user.uid));
        } else {
          q = query(collection(db, 'appointments'));
        }
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Appointment[];
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setAppointments(list);

        if (role === 'PACIENTE') {
          const casosSnap = await getDocs(query(collection(db, 'casos'), where('patientUid', '==', user.uid)));
          const casoDates = new Set<string>();
          casosSnap.docs.forEach((d) => {
            const data = d.data();
            if (data.date) casoDates.add(data.date.slice(0, 10));
          });
          setCaseMap(casoDates);
        }

        if (role !== 'PACIENTE') {
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          if (docSnap.exists()) {
            const d = docSnap.data();
            setDoctorClinic({
              address: d.clinicAddress || '',
              maps: d.clinicMaps || '',
              phone: d.phone || '',
            });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, [user]);

  const handleUpdateStatus = async (id: string, newStatus: 'confirmed' | 'cancelled') => {
    setProcessingId(id);
    try {
      await updateDoc(doc(db, 'appointments', id), { status: newStatus });
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
      toast.success(newStatus === 'confirmed' ? 'Cita confirmada' : 'Cita rechazada');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar');
    } finally {
      setProcessingId(null);
    }
  };

  const canCancelAppointment = (appointment: Appointment) => {
    const aptDate = parseISO(appointment.date);
    const now = new Date();
    const hoursUntilAppointment = (aptDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilAppointment > 48;
  };

  const handleCancelAppointment = async () => {
    if (!cancelAppointmentId || !cancelReason.trim()) {
      toast.error('Debe escribir un motivo de cancelación');
      return;
    }
    setProcessingId(cancelAppointmentId);
    try {
      await updateDoc(doc(db, 'appointments', cancelAppointmentId), {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelReason: cancelReason,
        cancelledBy: user?.uid,
      });
      setAppointments((prev) => prev.map((a) => 
        a.id === cancelAppointmentId ? { ...a, status: 'cancelled' as AppointmentStatus } : a
      ));
      toast.success('Cita cancelada');
      setShowCancelModal(false);
      setCancelAppointmentId(null);
      setCancelReason('');
    } catch (err) {
      console.error(err);
      toast.error('Error al cancelar');
    } finally {
      setProcessingId(null);
    }
  };

  const role = (user as { role?: string })?.role ?? 'PACIENTE';
  const isDoctor = role !== 'PACIENTE';

  const filteredAppointments = appointments
    .filter(a => {
      const date = parseISO(a.date);
      const isPending = a.status === 'pending';
      if (filter === 'upcoming') return isFuture(date) || isToday(date) || isPending;
      if (filter === 'past') return isPast(date) && !isToday(date);
      if (filter === 'pending') return isPending;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar role={role} />
      </div>
      <MobileHeader role={role} />
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 lg:space-y-8 pt-16 lg:pt-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Agenda de Citas</h1>
            <p className="text-slate-500 mt-1">Gestiona tus consultas y horarios</p>
          </div>
          {role === 'PACIENTE' && (
            <Link href="/book" className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Nueva Cita
            </Link>
          )}
        </header>

        {isDoctor && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Vista Calendario
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Vista Lista
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 p-1 bg-slate-200/50 rounded-xl w-fit">
          {(['all', 'upcoming', 'pending', 'past'] as const).map((f) => {
            if (f === 'pending' && !isDoctor) return null;
            const labels = { all: 'Todas', upcoming: 'Próximas', pending: 'Pendientes', past: 'Historial' };
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : filteredAppointments.length === 0 ? (
          <div className="card text-center py-24 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <p className="text-slate-500 font-medium">No se encontraron citas</p>
            {role === 'PACIENTE' && <Link href="/book" className="text-blue-600 font-semibold mt-2 hover:underline">Solicitar mi primera cita</Link>}
          </div>
        ) : viewMode === 'calendar' ? (
          <div className="space-y-3">
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              const allDays: string[] = [];
              const dayMap: Record<string, Appointment[]> = {};
              
              filteredAppointments.forEach((a) => {
                const dayKey = a.date.slice(0, 10);
                if (!dayMap[dayKey]) {
                  dayMap[dayKey] = [];
                  allDays.push(dayKey);
                }
                dayMap[dayKey].push(a);
              });
              
              const sortedDays = allDays.sort((a, b) => a.localeCompare(b));
              
              return sortedDays.map((dayKey) => {
                const dayAppointments = dayMap[dayKey] || [];
                const dayDate = parseISO(dayKey);
                const isExpanded = expandedDays.has(dayKey);
                const hasPending = dayAppointments.some(a => a.status === 'pending');
                const hasConfirmed = dayAppointments.some(a => a.status === 'confirmed');
                
                const isPast = dayDate < today;
                const isToday = isSameDay(dayDate, today);
                
                return (
                  <div key={dayKey} className={`border rounded-xl overflow-hidden ${isPast ? 'opacity-60' : ''}`}>
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedDays);
                        if (isExpanded) newExpanded.delete(dayKey);
                        else newExpanded.add(dayKey);
                        setExpandedDays(newExpanded);
                      }}
                      className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
                        isExpanded ? 'bg-blue-50' : isToday ? 'bg-blue-50/50' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-sm ${isToday ? 'bg-blue-600 text-white' : isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                          <span className="text-[10px] font-bold">{format(dayDate, 'EEE', { locale: es })}</span>
                          <span className="font-bold">{format(dayDate, 'd')}</span>
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-slate-900 text-sm">{format(dayDate, "EEEE d 'de' MMMM", { locale: es })}</p>
                          <p className="text-xs text-slate-500">
                            {dayAppointments.length} cita{dayAppointments.length !== 1 ? 's' : ''}
                            {hasConfirmed && ' • Confirmadas'}
                            {hasPending && ' • Pendientes'}
                            {isToday && ' • Hoy'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isToday && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">HOY</span>}
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="bg-slate-50 p-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {dayAppointments
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map((a) => {
                              const aptTime = format(parseISO(a.date), 'HH:mm');
                              const isPending = a.status === 'pending';
                              const isConfirmed = a.status === 'confirmed';
                              return (
                                <div key={a.id} className={`flex items-center justify-between p-2 rounded-lg border text-sm ${isPending ? 'bg-orange-50 border-orange-200' : isConfirmed ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`font-bold text-xs ${isPending ? 'text-orange-700' : isConfirmed ? 'text-green-700' : 'text-slate-700'}`}>{aptTime}</span>
                                    <Link href={`/pacientes/${a.patientUid}`} className="truncate text-xs text-blue-600 hover:underline font-medium">
                                      {a.patientName}
                                    </Link>
                                  </div>
                                  <div className="flex gap-1 ml-1">
                                    {isDoctor && isPending && (
                                      <button onClick={() => handleUpdateStatus(a.id, 'confirmed')} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Confirmar">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                                      </button>
                                    )}
                                    {isDoctor && isPending && (
                                      <button onClick={() => handleUpdateStatus(a.id, 'cancelled')} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Rechazar">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredAppointments.map((a) => {
              const status = STATUS_CONFIG[a.status as AppointmentStatus] || STATUS_CONFIG.scheduled;
              const date = parseISO(a.date);
              const isPending = a.status === 'pending';
              const isConfirmed = a.status === 'confirmed';
              
              return (
                <div key={a.id} className="card group hover:border-blue-200 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex gap-5 items-start">
                    <div className="flex-shrink-0 w-14 h-14 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{format(date, 'MMM', { locale: es })}</span>
                      <span className="text-xl font-black text-slate-700 group-hover:text-blue-700">{format(date, 'd')}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-bold text-slate-900">{a.type}</h3>
                        <span className={`badge ${status.bg} ${status.color} border border-current opacity-70`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 mt-2">
                        <p className="text-sm text-slate-500 flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg>
                          {format(date, "HH:mm 'hs'")} • {format(date, "EEEE d 'de' MMMM", { locale: es })}
                        </p>
                        <p className="text-sm font-medium text-slate-700">
                          {isDoctor ? `Paciente: ${a.patientName}` : `Médico: ${a.doctorName}`}
                        </p>
                      </div>
                      {a.notes && <p className="text-xs text-slate-400 mt-3 italic bg-slate-50 p-2 rounded-lg border border-slate-100">"{a.notes}"</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    {isDoctor && isPending && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(a.id, 'confirmed')}
                          disabled={processingId === a.id}
                          className="btn-primary bg-emerald-600 hover:bg-emerald-700 border-none !py-2 !px-4 text-xs"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(a.id, 'cancelled')}
                          disabled={processingId === a.id}
                          className="btn-secondary !py-2 !px-4 text-xs text-red-600 border-red-100 hover:bg-red-50"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {isDoctor && isConfirmed && (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const patientSnap = await getDoc(doc(db, 'users', a.patientUid));
                              if (patientSnap.exists()) {
                                const patientData = patientSnap.data();
                                const params = new URLSearchParams({
                                  patientUid: a.patientUid,
                                  patientName: a.patientName,
                                  patientDni: patientData.dni || '',
                                  patientPhone: patientData.phone || '',
                                  patientEmail: patientData.email || '',
                                  patientObraSocial: patientData.obraSocial || '',
                                  patientAddress: patientData.address || '',
                                  appointmentDate: a.date,
                                });
                                router.push(`/casos/nuevo?${params.toString()}`);
                              }
                            } catch (err) {
                              console.error(err);
                              toast.error('Error al cargar datos del paciente');
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:shadow-lg transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Crear Caso
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const patientSnap = await getDoc(doc(db, 'users', a.patientUid));
                              if (patientSnap.exists()) {
                                const phone = (patientSnap.data().phone || '').replace(/\D/g, '');
                                if (!phone) {
                                  toast.error('El paciente no tiene teléfono');
                                  return;
                                }
                                const dateStr = format(date, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
                                let msg = `Hola ${a.patientName}, tu cita con ${a.doctorName} ha sido CONFIRMADA para el ${dateStr}.`;
                                if (doctorClinic.address) msg += ` Dirección: ${doctorClinic.address}.`;
                                if (doctorClinic.maps) msg += ` Maps: ${doctorClinic.maps}`;
                                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                              }
                            } catch (err) {
                              console.error(err);
                              toast.error('Error al enviar mensaje');
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:shadow-lg transition-all"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.053l1.903-1.114a.864.864 0 01.665-.098 10.16 10.16 0 002.836.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.52 1.162 1.162 0 .642-.52 1.162-1.162 1.162-.642 0-1.162-.52-1.162-1.162 0-.642.52-1.162 1.162-1.162zm4.649 0c.642 0 1.162.52 1.162 1.162 0 .642-.52 1.162-1.162 1.162-.642 0-1.162-.52-1.162-1.162 0-.642.52-1.162 1.162-1.162zm5.19 3.867l-.467.467c-.234.234-.533.352-.838.352-.305 0-.604-.118-.838-.352l-.467-.467c-.234-.234-.352-.533-.352-.838 0-.305.118-.604.352-.838l.933-.933c.234-.234.533-.352.838-.352.305 0 .604.118.838.352l.467.467c.234.234.352.533.352.838 0 .305-.118.604-.352.838l-.933.933c-.234.234-.533.352-.838.352-.305 0-.604-.118-.838-.352zm1.456-2.05c-.17-.17-.4-.255-.64-.255-.24 0-.47.085-.64.255l-.64.64c-.17.17-.255.4-.255.64 0 .24.085.47.255.64l.16.16c.298.298.68.458 1.074.458.394 0 .776-.16 1.074-.458l.16-.16c.17-.17.255-.4.255-.64 0-.24-.085-.47-.255-.64l-.639-.64z"/>
                          </svg>
                          WhatsApp
                        </button>
                      </div>
                    )}
                    {role === 'PACIENTE' && isPast(date) && !isToday(date) && caseMap.has(a.date.slice(0, 10)) && (
                      <Link href={`/pacientes/${user.uid}`} className="btn-secondary !py-2 !px-4 text-xs">
                        Ver Reporte
                      </Link>
                    )}
                    {role === 'PACIENTE' && a.status !== 'cancelled' && (
                      <button
                        onClick={() => {
                          if (!canCancelAppointment(a)) {
                            toast.error('Solo puede cancelar citas con al menos 48 horas de anticipación');
                            return;
                          }
                          setCancelAppointmentId(a.id);
                          setShowCancelModal(true);
                        }}
                        className="!py-2 !px-4 text-xs text-slate-400 hover:text-red-600 transition-colors"
                      >
                        Cancelar Cita
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Cancelar Cita</h3>
              <p className="text-sm text-slate-600 mb-4">¿Está seguro de que desea cancelar esta cita?</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo de cancelación</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Escriba el motivo de la cancelación..."
                  className="w-full border border-slate-200 rounded-lg p-3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCancelModal(false); setCancelAppointmentId(null); setCancelReason(''); }}
                  className="flex-1 btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCancelAppointment}
                  disabled={processingId === cancelAppointmentId}
                  className="flex-1 btn-primary bg-red-600 hover:bg-red-700"
                >
                  {processingId === cancelAppointmentId ? 'Cancelando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
