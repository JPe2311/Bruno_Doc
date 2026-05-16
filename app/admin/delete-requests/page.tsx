'use client';
import { useEffect, useState } from 'react';
import { collection, query, getDocs, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeleteRequest {
  id: string;
  patientUid: string;
  patientName: string;
  patientDni: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export default function DeleteRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
    if (!authLoading && user && user.role !== 'MEDICO') {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchRequests = async () => {
      const q = query(collection(db, 'deletion_requests'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeleteRequest)));
      setLoading(false);
    };
    fetchRequests();
  }, [user]);

  const handleApprove = async (request: DeleteRequest) => {
    if (!confirm('¿Está seguro de aprobar esta solicitud? Se eliminará toda la historia clínica del paciente.')) return;
    
    try {
      await updateDoc(doc(db, 'deletion_requests', request.id), {
        status: 'approved',
        approvedBy: user?.uid,
        approvedAt: new Date().toISOString(),
      });

      const casosQ = query(collection(db, 'casos'), where('patientUid', '==', request.patientUid));
      const casosSnap = await getDocs(casosQ);
      const deletePromises = casosSnap.docs.map(c => deleteDoc(doc(db, 'casos', c.id)));
      await Promise.all(deletePromises);

      const appointmentsQ = query(collection(db, 'appointments'), where('patientUid', '==', request.patientUid));
      const appointmentsSnap = await getDocs(appointmentsQ);
      const apptPromises = appointmentsSnap.docs.map(a => deleteDoc(doc(db, 'appointments', a.id)));
      await Promise.all(apptPromises);

      await deleteDoc(doc(db, 'users', request.patientUid));

      setRequests(prev => prev.filter(r => r.id !== request.id));
      toast.success('Historia clínica eliminada y usuario dado de baja');
    } catch (err) {
      console.error(err);
      toast.error('Error al procesar solicitud');
    }
  };

  const handleReject = async (request: DeleteRequest) => {
    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;
    
    try {
      await updateDoc(doc(db, 'deletion_requests', request.id), {
        status: 'rejected',
        rejectionReason: reason,
        approvedBy: user?.uid,
        approvedAt: new Date().toISOString(),
      });
      setRequests(prev => prev.filter(r => r.id !== request.id));
      toast.success('Solicitud rechazada');
    } catch (err) {
      console.error(err);
      toast.error('Error al rechazar solicitud');
    }
  };

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={user.role} />
      <main className="flex-1 p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Solicitudes de Eliminación de HC</h1>

        {loading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : requests.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-slate-500">No hay solicitudes pendientes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(r => (
              <div key={r.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{r.patientName}</p>
                    <p className="text-sm text-slate-500">DNI: {r.patientDni}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Solicitado el {r.requestedAt ? format(parseISO(r.requestedAt), "d 'de' MMMM 'de' yyyy", { locale: es }) : '-'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(r)}
                      className="px-4 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => handleApprove(r)}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Aprobar y Eliminar HC
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}