'use client';
import { useState, useEffect } from 'react';
import { collection, query, getDocs, getDoc, doc, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter, useParams } from 'next/navigation';
import { printReportHTML } from '@/lib/printReport';
import { Caso } from '@/lib/types/domain';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

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

export default function PatientDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const patientUid = params?.uid as string;

  const [patientData, setPatientData] = useState<{ fullName: string; dni: string; phone: string; obraSocial: string; email: string; address: string } | null>(null);
  const [casos, setCasos] = useState<(Caso & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorAssets, setDoctorAssets] = useState<Record<string, { stampURL: string; bannerURL: string }>>({});

  const isOwnProfile = user && patientUid === user.uid;

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !patientUid) return;
    if (user.role === 'PACIENTE' && patientUid !== user.uid) {
      router.replace('/dashboard');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const patientSnap = await getDoc(doc(db, 'users', patientUid));
        if (patientSnap.exists()) {
          const data = patientSnap.data();
          setPatientData({
            fullName: data.fullName || '',
            dni: data.dni || '',
            phone: data.phone || '',
            obraSocial: data.obraSocial || '',
            email: data.email || '',
            address: data.address || '',
          });
        }

        const casosSnap = await getDocs(
          query(collection(db, 'casos'), where('patientUid', '==', patientUid), orderBy('createdAt', 'desc'))
        );
        const casosList = casosSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Caso & { id: string }));
        setCasos(casosList);

        const doctorUids = [...new Set(casosList.map((c) => c.doctorUid))];
        const assets: Record<string, { stampURL: string; bannerURL: string }> = {};
        await Promise.all(
          doctorUids.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              if (snap.exists()) {
                const d = snap.data();
                assets[uid] = { stampURL: d.stampURL || '', bannerURL: d.bannerURL || '' };
              }
            } catch {}
          })
        );
        setDoctorAssets(assets);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, patientUid, router]);

  const handlePrint = (caso: Caso & { id: string }) => {
    const assets = doctorAssets[caso.doctorUid] || { stampURL: '', bannerURL: '' };
    const html = buildReportHTML(caso, assets.stampURL, assets.bannerURL, caso.doctorName);
    printReportHTML(html);
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
      <main className="flex-1 p-6">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-sm text-sky-600 hover:underline mb-2 inline-block"
          >
            &larr; Volver
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {isOwnProfile ? 'Mis Reportes' : `Paciente: ${patientData?.fullName || 'Cargando...'}`}
          </h1>
        </div>

        {loading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : !patientData ? (
          <div className="card text-center py-12">
            <p className="text-slate-500">Paciente no encontrado</p>
          </div>
        ) : (
          <>
            {!isOwnProfile && (
              <div className="card mb-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Datos del Paciente</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium text-slate-600">Nombre:</span> {patientData.fullName}</div>
                  <div><span className="font-medium text-slate-600">DNI:</span> {patientData.dni}</div>
                  <div><span className="font-medium text-slate-600">Telefono:</span> {patientData.phone}</div>
                  <div><span className="font-medium text-slate-600">Obra Social:</span> {patientData.obraSocial || '-'}</div>
                  <div><span className="font-medium text-slate-600">Email:</span> {patientData.email}</div>
                  <div><span className="font-medium text-slate-600">Direccion:</span> {patientData.address}</div>
                </div>
              </div>
            )}

            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Reportes / Casos ({casos.length})
              </h2>
              {casos.length === 0 ? (
                <p className="text-slate-500">No hay reportes registrados para este paciente</p>
              ) : (
                <div className="space-y-4">
                  {casos.map((c) => {
                    const assets = doctorAssets[c.doctorUid] || { stampURL: '', bannerURL: '' };
                    const fecha = c.createdAt || c.date;
                    return (
                      <div key={c.id} className="border rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500">
                              {fecha ? format(parseISO(fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es }) : '-'}
                            </span>
                            {c.tipologia && (
                              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                {c.tipologia}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">{c.doctorName}</span>
                          </div>
                          <button
                            onClick={() => handlePrint(c)}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-sky-600 text-white hover:bg-sky-700"
                          >
                            Imprimir / PDF
                          </button>
                        </div>
                        <div className="p-4">
                          {assets.bannerURL && (
                            <img src={assets.bannerURL} alt="Banner" className="w-full h-auto max-h-32 object-cover rounded mb-3" />
                          )}
                          {c.description && (
                            <div className="mb-2">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Motivo de Consulta</h4>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.description}</p>
                            </div>
                          )}
                          {c.diagnosis && (
                            <div className="mb-2">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Diagnostico</h4>
                              <p className="text-sm text-slate-700">{c.diagnosis}</p>
                            </div>
                          )}
                          {c.treatment && (
                            <div className="mb-2">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tratamiento</h4>
                              <p className="text-sm text-slate-700">{c.treatment}</p>
                            </div>
                          )}
                          {c.notes && (
                            <div className="mb-2">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notas</h4>
                              <p className="text-sm text-slate-700">{c.notes}</p>
                            </div>
                          )}
                          <div className="flex justify-end mt-3">
                            {assets.stampURL ? (
                              <img src={assets.stampURL} alt="Sello" className="h-16 object-contain" />
                            ) : (
                              <div className="text-right">
                                <p className="font-semibold text-sm text-slate-900">{c.doctorName}</p>
                                <p className="text-xs text-slate-500">Medico</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
