'use client';
import { useState, useEffect, Suspense } from 'react';
import { collection, addDoc, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

export default function RecipesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>}>
      <RecipesContent />
    </Suspense>
  );
}

function RecipesContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Array<{
    id: string;
    patientName: string;
    patientDni?: string;
    date: string;
    doctorName: string;
  }>>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [doctorBanner, setDoctorBanner] = useState('');
  const [doctorStamp, setDoctorStamp] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [patients, setPatients] = useState<Array<{ uid: string; fullName: string; dni?: string; obraSocial?: string }>>([]);

  const [form, setForm] = useState({
    patientUid: '',
    patientName: '',
    patientDni: '',
    patientObraSocial: '',
    recommendations: '',
  });
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const filteredPatients = patientSearch.trim() === '' 
    ? patients 
    : patients.filter(p => {
        const search = patientSearch.toLowerCase();
        return (p.fullName?.toLowerCase().includes(search) || p.dni?.toLowerCase().includes(search));
      });

  const displayPatients = filteredPatients.length > 0 || patientSearch === '' ? filteredPatients : [];

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
    const fetchData = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.bannerURL) setDoctorBanner(data.bannerURL);
        if (data.stampURL) setDoctorStamp(data.stampURL);
      }
      const q = query(collection(db, 'recipes'), where('doctorUid', '==', user.uid));
      const snap = await getDocs(q);
      setRecipes(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      
      const patientsQ = query(collection(db, 'users'));
      const patientsSnap = await getDocs(patientsQ);
      const allPatients = patientsSnap.docs
        .map(d => ({ uid: d.id, ...d.data() } as any))
        .filter(p => p.role === 'PACIENTE' || !p.role);
      setPatients(allPatients);
    };
    fetchData();
  }, [user]);

  const handleCreateRecipe = async () => {
    if (!user || !form.patientUid || !form.recommendations.trim()) {
      toast.error('Complete todos los campos');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'recipes'), {
        patientUid: form.patientUid,
        patientName: form.patientName,
        patientDni: form.patientDni,
        patientObraSocial: form.patientObraSocial,
        doctorUid: user.uid,
        doctorName: user.fullName,
        date: new Date().toISOString(),
        recommendations: form.recommendations,
        createdAt: new Date().toISOString(),
      });
      toast.success('Receta creada correctamente');
      setShowNewForm(false);
      setForm({ patientUid: '', patientName: '', patientDni: '', patientObraSocial: '', recommendations: '' });
      const q = query(collection(db, 'recipes'), where('doctorUid', '==', user.uid));
      const snap = await getDocs(q);
      setRecipes(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    } catch (err) {
      console.error(err);
      toast.error('Error al crear receta');
    } finally {
      setLoading(false);
    }
  };

  const printRecipe = async (r: typeof recipes[0]) => {
    const dateStr = r.date ? format(parseISO(r.date), "dd/MM/yyyy") : '';
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receta</title>`;
    html += `<style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
      .banner { width: 100%; max-height: 120px; object-fit: contain; margin-bottom: 20px; }
      .header { text-align: center; margin-bottom: 30px; }
      .rp-text { font-size: 24px; font-weight: bold; letter-spacing: 10px; margin: 20px 0; }
      .patient-info { margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; border-radius: 8px; }
      .patient-info p { margin: 5px 0; }
      .recommendations { margin: 30px 0; padding: 20px; min-height: 150px; white-space: pre-wrap; }
      .footer { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
      .signature { width: 200px; text-align: center; border-top: 1px solid #333; padding-top: 10px; }
      .stamp { max-width: 100px; max-height: 80px; }
      @media print { body { padding: 20px; } }
    </style></head><body>`;
    if (doctorBanner) html += `<img src="${doctorBanner}" alt="Banner" class="banner" />`;
    html += `<div class="header"><div class="rp-text">R&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;P</div></div>`;
    html += `<div class="patient-info"><p><strong>Paciente:</strong> ${r.patientName}</p>`;
    if (r.patientDni) html += `<p><strong>DNI:</strong> ${r.patientDni}</p>`;
    html += `<p><strong>Fecha:</strong> ${dateStr}</p></div>`;
    
    const recSnap = await getDoc(doc(db, 'recipes', r.id));
    const recData = recSnap.data();
    html += `<div class="recommendations">${recData?.recommendations || ''}</div>`;
    
    html += `<div class="footer">`;
    html += `<div class="signature"><p>Firma del Médico</p></div>`;
    if (doctorStamp) html += `<img src="${doctorStamp}" alt="Sello" class="stamp" />`;
    html += `</div></body></html>`;
    
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  if (authLoading || !user) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar role={user.role} />
      </div>
      <MobileHeader role={user.role} />
      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto pt-16 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Recetas / R-P</h1>
          <button onClick={() => setShowNewForm(true)} className="btn-primary">
            Nueva Receta
          </button>
        </div>

        {showNewForm && (
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Nueva Receta</h2>
              <button onClick={() => setShowNewForm(false)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Paciente</label>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  placeholder="Buscar paciente por nombre o DNI..."
                  className="w-full border border-slate-200 rounded-lg p-3"
                />
                {showPatientDropdown && displayPatients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {displayPatients.map(p => (
                      <button
                        key={p.uid}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, patientUid: p.uid, patientName: p.fullName || '', patientDni: p.dni || '', patientObraSocial: p.obraSocial || '' });
                          setPatientSearch(p.fullName || '');
                          setShowPatientDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        <span className="font-medium text-slate-900">{p.fullName}</span>
                        {p.dni && <span className="text-slate-500 text-sm ml-2">DNI: {p.dni}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {showPatientDropdown && displayPatients.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-slate-500">
                    {patients.length === 0 ? 'No hay pacientes registrados' : 'No se encontraron pacientes'}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recomendaciones</label>
                <textarea
                  value={form.recommendations}
                  onChange={e => setForm({ ...form, recommendations: e.target.value })}
                  rows={6}
                  placeholder="Escriba las recomendaciones del tratamiento..."
                  className="w-full border border-slate-200 rounded-lg p-3"
                />
              </div>
              <button onClick={handleCreateRecipe} disabled={loading || !form.patientUid || !form.recommendations.trim()} className="btn-primary">
                {loading ? 'Guardando...' : 'Crear Receta'}
              </button>
            </div>
          </div>
        )}

        {recipes.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-slate-500">No hay recetas creadas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recipes.map(r => (
              <div key={r.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{r.patientName}</p>
                  <p className="text-sm text-slate-500">
                    {r.date ? format(parseISO(r.date), "d 'de' MMMM 'de' yyyy", { locale: es }) : ''}
                    {r.patientDni ? ` • DNI: ${r.patientDni}` : ''}
                  </p>
                </div>
                <button onClick={() => printRecipe(r)} className="btn-secondary !py-2 !px-4 text-sm">
                  Imprimir
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}