'use client';
import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, where, doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface PatientOption {
  uid: string;
  fullName: string;
  dni: string;
  obraSocial: string;
  address: string;
  phone: string;
  email: string;
}

export default function NuevoCasoPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [description, setDescription] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [bannerURL, setBannerURL] = useState('');
  const [stampURL, setStampURL] = useState('');

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
    const fetchPatients = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'PACIENTE'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          fullName: data.fullName || '',
          dni: data.dni || '',
          obraSocial: data.obraSocial || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
        };
      });
      setPatients(list);
    };
    fetchPatients();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchDoctorAssets = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.bannerURL) setBannerURL(data.bannerURL);
        if (data.stampURL) setStampURL(data.stampURL);
      }
    };
    fetchDoctorAssets();
  }, [user]);

  const filteredPatients = patients.filter(
    (p) =>
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.dni.includes(search)
  );

  const handleSave = async () => {
    if (!user || !selectedPatient || !description) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'casos'), {
        patientUid: selectedPatient.uid,
        patientData: {
          fullName: selectedPatient.fullName,
          dni: selectedPatient.dni,
          obraSocial: selectedPatient.obraSocial,
          address: selectedPatient.address,
          phone: selectedPatient.phone,
          email: selectedPatient.email,
        },
        doctorUid: user.uid,
        doctorName: user.fullName,
        date: new Date().toISOString(),
        description,
        diagnosis,
        treatment,
        notes,
        createdAt: new Date().toISOString(),
      });
      toast.success('Caso registrado correctamente');
      setSelectedPatient(null);
      setDescription('');
      setDiagnosis('');
      setTreatment('');
      setNotes('');
    } catch (err) {
      console.error(err);
      toast.error('Error al registrar el caso');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar role={user.role} />
      <main className="flex-1 p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Nuevo Caso de Atencion</h1>

        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Seleccionar Paciente</h2>
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-slate-200 p-2.5 text-sm mb-3"
          />
          {search && filteredPatients.length > 0 && (
            <div className="max-h-48 overflow-y-auto border rounded divide-y">
              {filteredPatients.map((p) => (
                <button
                  key={p.uid}
                  onClick={() => { setSelectedPatient(p); setSearch(''); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 transition-colors ${
                    selectedPatient?.uid === p.uid ? 'bg-sky-50 font-medium' : ''
                  }`}
                >
                  {p.fullName} - DNI: {p.dni}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedPatient && (
          <>
            <div className="card mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Datos del Paciente</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium text-slate-600">Nombre:</span> {selectedPatient.fullName}</div>
                <div><span className="font-medium text-slate-600">DNI:</span> {selectedPatient.dni}</div>
                <div><span className="font-medium text-slate-600">Obra Social:</span> {selectedPatient.obraSocial || '-'}</div>
                <div><span className="font-medium text-slate-600">Telefono:</span> {selectedPatient.phone}</div>
                <div><span className="font-medium text-slate-600">Email:</span> {selectedPatient.email}</div>
                <div><span className="font-medium text-slate-600">Direccion:</span> {selectedPatient.address}</div>
              </div>
            </div>

            <div className="card mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Detalle de la Atencion</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Descripcion / Motivo de consulta *</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    required
                    className="mt-1 w-full rounded border border-slate-200 p-2.5 text-sm"
                    placeholder="Describa el motivo de consulta y observaciones..."
                  />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Diagnostico</span>
                    <textarea
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded border border-slate-200 p-2.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Tratamiento</span>
                    <textarea
                      value={treatment}
                      onChange={(e) => setTreatment(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded border border-slate-200 p-2.5 text-sm"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Notas adicionales</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded border border-slate-200 p-2.5 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="card mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Vista Previa del Reporte</h2>
              <div className="border rounded-lg overflow-hidden bg-white">
                {bannerURL && (
                  <img src={bannerURL} alt="Banner" className="w-full h-auto max-h-48 object-cover" />
                )}
                {!bannerURL && (
                  <div className="h-20 bg-gradient-to-r from-sky-600 to-sky-400 flex items-center justify-center">
                    <p className="text-white font-bold text-lg">BRUNO DOCTOR</p>
                  </div>
                )}
                <div className="p-6 space-y-4">
                  <div className="text-right text-sm text-slate-500">
                    {new Date().toLocaleDateString('es-ES', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </div>
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-slate-900 mb-2">Datos del Paciente</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <p><span className="font-medium">Nombre:</span> {selectedPatient.fullName}</p>
                      <p><span className="font-medium">DNI:</span> {selectedPatient.dni}</p>
                      <p><span className="font-medium">Obra Social:</span> {selectedPatient.obraSocial || '-'}</p>
                      <p><span className="font-medium">Telefono:</span> {selectedPatient.phone}</p>
                      <p><span className="font-medium">Direccion:</span> {selectedPatient.address}</p>
                    </div>
                  </div>
                  {description && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-slate-900 mb-2">Registro de Atencion</h3>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{description}</p>
                    </div>
                  )}
                  {diagnosis && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-slate-900 mb-2">Diagnostico</h3>
                      <p className="text-sm text-slate-700">{diagnosis}</p>
                    </div>
                  )}
                  {treatment && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-slate-900 mb-2">Tratamiento</h3>
                      <p className="text-sm text-slate-700">{treatment}</p>
                    </div>
                  )}
                  {notes && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-slate-900 mb-2">Notas</h3>
                      <p className="text-sm text-slate-700">{notes}</p>
                    </div>
                  )}
                  <div className="border-t pt-4 flex justify-end">
                    {stampURL ? (
                      <img src={stampURL} alt="Sello del doctor" className="h-20 object-contain" />
                    ) : (
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{user.fullName}</p>
                        <p className="text-sm text-slate-500">Medico</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !description}
              className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Caso'}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
