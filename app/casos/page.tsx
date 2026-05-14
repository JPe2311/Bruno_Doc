'use client';
import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import { printReportHTML } from '@/lib/printReport';
import { Caso } from '@/lib/types/domain';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface TipologiaOption {
  id: string;
  name: string;
}

function buildReportHTML(caso: Caso, stampURL: string, bannerURL: string, doctorName: string): string {
  const date = caso.date ? format(parseISO(caso.date), "EEEE d 'de' MMMM 'de' yyyy", { locale: es }) : '';
  const parts: string[] = [];

  if (bannerURL) {
    parts.push(`<img src="${bannerURL}" alt="Banner" class="banner-img" />`);
  }

  parts.push(`<div class="report-header">${date}</div>`);

  if (caso.tipologia) {
    parts.push(`<div><span class="tipologia-badge">${caso.tipologia}</span></div>`);
  }

  parts.push(`<div class="report-section">
    <h3>Datos del Paciente</h3>
    <div class="patient-grid">
      <p><span class="label">Nombre:</span> ${caso.patientData.fullName}</p>
      <p><span class="label">DNI:</span> ${caso.patientData.dni}</p>
      <p><span class="label">Obra Social:</span> ${caso.patientData.obraSocial || '-'}</p>
      <p><span class="label">Telefono:</span> ${caso.patientData.phone}</p>
      <p><span class="label">Direccion:</span> ${caso.patientData.address}</p>
      <p><span class="label">Medico:</span> ${caso.doctorName || doctorName}</p>
    </div>
  </div>`);

  if (caso.description) {
    parts.push(`<div class="report-section">
      <h3>Registro de Atencion</h3>
      <p>${caso.description}</p>
    </div>`);
  }
  if (caso.diagnosis) {
    parts.push(`<div class="report-section">
      <h3>Diagnostico</h3>
      <p>${caso.diagnosis}</p>
    </div>`);
  }
  if (caso.treatment) {
    parts.push(`<div class="report-section">
      <h3>Tratamiento</h3>
      <p>${caso.treatment}</p>
    </div>`);
  }
  if (caso.notes) {
    parts.push(`<div class="report-section">
      <h3>Notas</h3>
      <p>${caso.notes}</p>
    </div>`);
  }

  if (stampURL) {
    parts.push(`<div class="stamp-container"><img src="${stampURL}" alt="Sello" /></div>`);
  } else {
    parts.push(`<div class="stamp-container"><div class="no-stamp"><p class="name">${doctorName}</p><p class="role">Medico</p></div></div>`);
  }

  return parts.join('');
}

export default function CasosListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [casos, setCasos] = useState<(Caso & { id: string })[]>([]);
  const [filteredCasos, setFilteredCasos] = useState<(Caso & { id: string })[]>([]);
  const [tipologias, setTipologias] = useState<TipologiaOption[]>([]);
  const [filterTipologia, setFilterTipologia] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCaso, setSelectedCaso] = useState<(Caso & { id: string }) | null>(null);
  const [doctorAssets, setDoctorAssets] = useState<Record<string, { stampURL: string; bannerURL: string; doctorName: string }>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
    if (!authLoading && user && user.role === 'PACIENTE') {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role === 'PACIENTE') return;
    const fetchData = async () => {
      try {
        const [casosSnap, tipologiasSnap] = await Promise.all([
          getDocs(collection(db, 'casos')),
          getDocs(collection(db, 'catalog_tables')),
        ]);

        const casosList = casosSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Caso & { id: string }))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setCasos(casosList);
        setFilteredCasos(casosList);

        const tipList = tipologiasSnap.docs
          .filter((d) => d.data().type === 'tipologia')
          .map((d) => ({ id: d.id, name: d.data().name }));
        setTipologias(tipList);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    let result = casos;
    if (filterTipologia) {
      result = result.filter((c) => c.tipologia === filterTipologia);
    }
    if (filterPatient) {
      const q = filterPatient.toLowerCase();
      result = result.filter((c) => c.patientData.fullName.toLowerCase().includes(q) || c.patientData.dni.includes(q));
    }
    setFilteredCasos(result);
  }, [filterTipologia, filterPatient, casos]);

  const handleViewReport = async (caso: Caso & { id: string }) => {
    setSelectedCaso(caso);
    if (!doctorAssets[caso.doctorUid]) {
      try {
        const snap = await getDoc(doc(db, 'users', caso.doctorUid));
        if (snap.exists()) {
          const data = snap.data();
          setDoctorAssets((prev) => ({
            ...prev,
            [caso.doctorUid]: {
              stampURL: data.stampURL || '',
              bannerURL: data.bannerURL || '',
              doctorName: data.fullName || caso.doctorName,
            },
          }));
        }
      } catch {}
    }
  };

  const handlePrintCaso = (caso: Caso & { id: string }) => {
    const assets = doctorAssets[caso.doctorUid] || { stampURL: '', bannerURL: '', doctorName: caso.doctorName };
    const html = buildReportHTML(caso, assets.stampURL, assets.bannerURL, caso.doctorName);
    printReportHTML(html);
  };

  const uniqueTipologias = [...new Set(casos.map((c) => c.tipologia).filter(Boolean))];

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
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Casos de Atencion</h1>
          <div className="flex gap-3">
            <select
              value={filterTipologia}
              onChange={(e) => setFilterTipologia(e.target.value)}
              className="rounded border border-slate-200 p-2.5 text-sm"
            >
              <option value="">Todas las tipologias</option>
              {tipologias.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={filterPatient}
              onChange={(e) => setFilterPatient(e.target.value)}
              className="w-56 rounded border border-slate-200 p-2.5 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : filteredCasos.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-slate-500">No se encontraron casos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-3 font-medium">Fecha</th>
                  <th className="pb-3 font-medium">Paciente</th>
                  <th className="pb-3 font-medium">DNI</th>
                  <th className="pb-3 font-medium">Tipologia</th>
                  <th className="pb-3 font-medium">Medico</th>
                  <th className="pb-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCasos.map((c) => {
                  const fecha = c.createdAt || c.date;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 text-slate-600">
                        {fecha ? format(parseISO(fecha), 'dd/MM/yyyy', { locale: es }) : '-'}
                      </td>
                      <td className="py-3">
                        <a
                          href={`/pacientes/${c.patientUid}`}
                          className="text-sky-600 hover:underline font-medium"
                        >
                          {c.patientData.fullName}
                        </a>
                      </td>
                      <td className="py-3 text-slate-600">{c.patientData.dni}</td>
                      <td className="py-3">
                        {c.tipologia ? (
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {c.tipologia}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 text-slate-600">{c.doctorName}</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewReport(c)}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-sky-100 text-sky-700 hover:bg-sky-200"
                          >
                            Ver
                          </button>
                          <button
                            onClick={() => handlePrintCaso(c)}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            Imprimir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedCaso && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-3 flex items-center justify-between z-10">
                <h2 className="text-lg font-semibold text-slate-900">Reporte Completo</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrintCaso(selectedCaso)}
                    className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700"
                  >
                    Imprimir / PDF
                  </button>
                  <button
                    onClick={() => setSelectedCaso(null)}
                    className="px-4 py-2 rounded-lg border text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
              <div className="p-6">
                {(() => {
                  const assets = doctorAssets[selectedCaso.doctorUid] || { stampURL: '', bannerURL: '', doctorName: selectedCaso.doctorName };
                  const date = selectedCaso.date
                    ? format(parseISO(selectedCaso.date), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
                    : '';

                  return (
                    <div className="border rounded-lg overflow-hidden">
                      {assets.bannerURL ? (
                        <img src={assets.bannerURL} alt="Banner" className="w-full h-auto max-h-48 object-cover" />
                      ) : (
                        <div className="h-20 bg-gradient-to-r from-sky-600 to-sky-400 flex items-center justify-center">
                          <p className="text-white font-bold text-lg">BRUNO DOCTOR</p>
                        </div>
                      )}
                      <div className="p-6 space-y-4">
                        <div className="text-right text-sm text-slate-500">{date}</div>
                        {selectedCaso.tipologia && (
                          <div>
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {selectedCaso.tipologia}
                            </span>
                          </div>
                        )}
                        <div className="border-t pt-4">
                          <h3 className="font-semibold text-slate-900 mb-2">Datos del Paciente</h3>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <p><span className="font-medium">Nombre:</span> {selectedCaso.patientData.fullName}</p>
                            <p><span className="font-medium">DNI:</span> {selectedCaso.patientData.dni}</p>
                            <p><span className="font-medium">Obra Social:</span> {selectedCaso.patientData.obraSocial || '-'}</p>
                            <p><span className="font-medium">Telefono:</span> {selectedCaso.patientData.phone}</p>
                            <p><span className="font-medium">Direccion:</span> {selectedCaso.patientData.address}</p>
                            <p><span className="font-medium">Medico:</span> {selectedCaso.doctorName}</p>
                          </div>
                        </div>
                        {selectedCaso.description && (
                          <div className="border-t pt-4">
                            <h3 className="font-semibold text-slate-900 mb-2">Registro de Atencion</h3>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedCaso.description}</p>
                          </div>
                        )}
                        {selectedCaso.diagnosis && (
                          <div className="border-t pt-4">
                            <h3 className="font-semibold text-slate-900 mb-2">Diagnostico</h3>
                            <p className="text-sm text-slate-700">{selectedCaso.diagnosis}</p>
                          </div>
                        )}
                        {selectedCaso.treatment && (
                          <div className="border-t pt-4">
                            <h3 className="font-semibold text-slate-900 mb-2">Tratamiento</h3>
                            <p className="text-sm text-slate-700">{selectedCaso.treatment}</p>
                          </div>
                        )}
                        {selectedCaso.notes && (
                          <div className="border-t pt-4">
                            <h3 className="font-semibold text-slate-900 mb-2">Notas</h3>
                            <p className="text-sm text-slate-700">{selectedCaso.notes}</p>
                          </div>
                        )}
                        <div className="border-t pt-4 flex justify-end">
                          {assets.stampURL ? (
                            <img src={assets.stampURL} alt="Sello del doctor" className="h-20 object-contain" />
                          ) : (
                            <div className="text-right">
                              <p className="font-semibold text-slate-900">{selectedCaso.doctorName}</p>
                              <p className="text-sm text-slate-500">Medico</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
