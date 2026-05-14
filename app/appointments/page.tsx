'use client';
import { useEffect, useState } from 'react';
import { collection, query, getDocs, getDoc, doc, orderBy, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import { Appointment, AppointmentStatus } from '@/lib/types/domain';
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: 'text-orange-700', bg: 'bg-orange-100' },
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
  const [caseMap, setCaseMap] = useState<Set<string>>(new Set());
  const [doctorClinic, setDoctorClinic] = useState<{ address: string; maps: string; phone: string }>({ address: '', maps: '', phone: '' });
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
            if (data.date) {
              const dStr = data.date.slice(0, 10);
              casoDates.add(dStr);
            }
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
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
      );
      toast.success(newStatus === 'confirmed' ? 'Cita confirmada' : 'Cita rechazada');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar la cita');
    } finally {
      setProcessingId(null);
    }
  };

  const getWhatsAppLink = async (appointment: Appointment) => {
    let patientPhone = '';
    try {
      const patientSnap = await getDoc(doc(db, 'users', appointment.patientUid));
      if (patientSnap.exists()) {
        const data = patientSnap.data();
        patientPhone = (data.phone || '').replace(/\D/g, '');
      }
    } catch {}
    const date = parseISO(appointment.date);
    const dateStr = format(date, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
    let message = `Hola ${appointment.patientName}, tu cita con ${appointment.doctorName} ha sido CONFIRMADA para el ${dateStr}.`;
    if (doctorClinic.address) {
      message += ` Direccion: ${doctorClinic.address}.`;
    }
    if (doctorClinic.maps) {
      message += ` Ver en mapa: ${doctorClinic.maps}`;
    }
    return patientPhone ? `https://wa.me/${patientPhone}?text=${encodeURIComponent(message)}` : '#';
  };

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
              const isPending = a.status === 'pending';
              const isConfirmed = a.status === 'confirmed';
              const isDoctor = role !== 'PACIENTE';
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
                    {isDoctor && (
                      <p className="text-sm text-slate-600">Paciente: {a.patientName}</p>
                    )}
                    {a.notes && <p className="text-xs text-slate-500 mt-2 italic">{a.notes}</p>}
                    {role === 'PACIENTE' && isPast(date) && !isToday(date) && caseMap.has(a.date.slice(0, 10)) && (
                      <a
                        href={`/pacientes/${user.uid}`}
                        className="inline-block mt-2 text-xs font-medium text-sky-600 hover:underline"
                      >
                        Ver Reporte
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {isDoctor && isPending && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(a.id, 'confirmed')}
                          disabled={processingId === a.id}
                          className="px-3 py-1.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Aceptar
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(a.id, 'cancelled')}
                          disabled={processingId === a.id}
                          className="px-3 py-1.5 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                    {isDoctor && isConfirmed && doctorClinic.address && (
                      <button
                        onClick={async () => {
                          let patientPhone = '';
                          try {
                            const patientSnap = await getDoc(doc(db, 'users', a.patientUid));
                            if (patientSnap.exists()) {
                              patientPhone = (patientSnap.data().phone || '').replace(/\D/g, '');
                            }
                          } catch {}
                          if (!patientPhone) {
                            toast.error('El paciente no tiene telefono registrado');
                            return;
                          }
                          const dateStr = format(date, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
                          let message = `Hola ${a.patientName}, tu cita con ${a.doctorName} ha sido CONFIRMADA para el ${dateStr}.`;
                          if (doctorClinic.address) message += ` Direccion: ${doctorClinic.address}.`;
                          if (doctorClinic.maps) message += ` Ver en mapa: ${doctorClinic.maps}`;
                          window.open(`https://wa.me/${patientPhone}?text=${encodeURIComponent(message)}`, '_blank');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-green-500 text-white hover:bg-green-600"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </button>
                    )}
                    <div className={`w-3 h-3 rounded-full ${isToday(date) ? 'bg-blue-500' : isFuture(date) ? 'bg-green-500' : 'bg-slate-300'}`} />
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
