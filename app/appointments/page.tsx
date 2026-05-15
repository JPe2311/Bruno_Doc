'use client';
import { useEffect, useState } from 'react';
import { collection, query, getDocs, getDoc, doc, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Appointment, AppointmentStatus } from '@/lib/types/domain';
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns';
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
  const [doctorClinic, setDoctorClinic] = useState({ address: '', maps: '', phone: '' });
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  const role = (user as { role?: string })?.role ?? 'PACIENTE';
  const isDoctor = role !== 'PACIENTE';

  const filteredAppointments = appointments.filter(a => {
    const date = parseISO(a.date);
    const isPending = a.status === 'pending';
    if (filter === 'upcoming') return isFuture(date) || isToday(date) || isPending;
    if (filter === 'past') return isPast(date) && !isToday(date);
    if (filter === 'pending') return isPending;
    return true;
  });

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={role} />
      <main className="flex-1 p-8 max-w-5xl mx-auto space-y-8">
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
                                router.push({
                                  pathname: '/casos/nuevo',
                                  query: {
                                    patientUid: a.patientUid,
                                    patientName: a.patientName,
                                    patientDni: patientData.dni || '',
                                    patientPhone: patientData.phone || '',
                                    patientEmail: patientData.email || '',
                                    patientObraSocial: patientData.obraSocial || '',
                                    patientAddress: patientData.address || '',
                                    appointmentDate: a.date,
                                  },
                                });
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
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          WhatsApp
                        </button>
                      </div>
                    )}
                    {role === 'PACIENTE' && isPast(date) && !isToday(date) && caseMap.has(a.date.slice(0, 10)) && (
                      <Link href={`/pacientes/${user.uid}`} className="btn-secondary !py-2 !px-4 text-xs">
                        Ver Reporte
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
