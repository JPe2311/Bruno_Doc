'use client';
import { useState, useEffect } from 'react';
import { collection, query, getDocs, getDoc, doc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter, useParams } from 'next/navigation';
import { printReportHTML } from '@/lib/printReport';
import { Caso } from '@/lib/types/domain';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { logAudit } from '@/lib/audit';

function escapeHtml(str: string): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildReportHTML(caso: Caso, stampURL: string, bannerURL: string, doctorName: string): string {
  const date = caso.date ? format(parseISO(caso.date), "EEEE d 'de' MMMM 'de' yyyy", { locale: es }) : '';
  const parts: string[] = [];

  if (bannerURL) parts.push(`<img src="${escapeHtml(bannerURL)}" alt="Banner" class="banner-img" />`);
  parts.push(`<div class="report-header">${escapeHtml(date)}</div>`);
  if (caso.tipologia) parts.push(`<div><span class="tipologia-badge">${escapeHtml(caso.tipologia)}</span></div>`);

  parts.push(`<div class="report-section">
    <h3>Datos del Paciente</h3>
    <div class="patient-grid">
      <p><span class="label">Nombre:</span> ${escapeHtml(caso.patientData.fullName)}</p>
      <p><span class="label">DNI:</span> ${escapeHtml(caso.patientData.dni)}</p>
      <p><span class="label">Obra Social:</span> ${escapeHtml(caso.patientData.obraSocial || '-')}</p>
      <p><span class="label">Teléfono:</span> ${escapeHtml(caso.patientData.phone)}</p>
      <p><span class="label">Dirección:</span> ${escapeHtml(caso.patientData.address)}</p>
      <p><span class="label">Médico:</span> ${escapeHtml(caso.doctorName || doctorName)}</p>
    </div>
  </div>`);

  if (caso.description) parts.push(`<div class="report-section"><h3>Registro de Atención</h3><p>${escapeHtml(caso.description)}</p></div>`);
  if (caso.diagnosis) parts.push(`<div class="report-section"><h3>Diagnóstico</h3><p>${escapeHtml(caso.diagnosis)}</p></div>`);
  if (caso.treatment) parts.push(`<div class="report-section"><h3>Tratamiento</h3><p>${escapeHtml(caso.treatment)}</p></div>`);
  if (caso.notes) parts.push(`<div class="report-section"><h3>Notas</h3><p>${escapeHtml(caso.notes)}</p></div>`);

  if (stampURL) {
    parts.push(`<div class="stamp-container"><img src="${escapeHtml(stampURL)}" alt="Sello" /></div>`);
  } else {
    parts.push(`<div class="stamp-container"><div class="no-stamp"><p class="name">${escapeHtml(doctorName)}</p><p class="role">Médico</p></div></div>`);
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
    if (!authLoading && !user) router.replace('/login');
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
          const d = patientSnap.data();
          setPatientData({
            fullName: d.fullName || '', dni: d.dni || '', phone: d.phone || '',
            obraSocial: d.obraSocial || '', email: d.email || '', address: d.address || '',
          });
        }

        const casosSnap = await getDocs(query(collection(db, 'casos'), where('patientUid', '==', patientUid)));
        const list = casosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Caso & { id: string }))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setCasos(list);

        const doctorUids = [...new Set(list.map(c => c.doctorUid))];
        const assets: Record<string, { stampURL: string; bannerURL: string }> = {};
        await Promise.all(doctorUids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              const d = snap.data();
              assets[uid] = { stampURL: d.stampURL || '', bannerURL: d.bannerURL || '' };
            }
          } catch {}
        }));
        setDoctorAssets(assets);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    loadData();
  }, [user, patientUid, router]);

  const handlePrint = (caso: Caso & { id: string }) => {
    if (user) logAudit(user, 'PRINT_CASO', { id: caso.id, type: 'caso', patientUid: caso.patientUid });
    const assets = doctorAssets[caso.doctorUid] || { stampURL: '', bannerURL: '' };
    const html = buildReportHTML(caso, assets.stampURL, assets.bannerURL, caso.doctorName);
    printReportHTML(html);
  };

  if (authLoading || !user) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="spinner" /></div>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={user.role} />
      <main className="flex-1 p-8 max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button onClick={() => router.back()} className="flex items-center gap-1 text-xs font-bold text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors mb-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2.5}/></svg>
              Volver
            </button>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {isOwnProfile ? 'Mis Reportes Médicos' : `Historia Clínica: ${patientData?.fullName}`}
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : !patientData ? (
          <div className="card text-center py-24 flex flex-col items-center">
            <p className="text-slate-500 font-medium">Paciente no encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {!isOwnProfile && (
              <section className="card bg-white border-none shadow-xl shadow-slate-200/50">
                <h2 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-6">Información del Paciente</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { label: 'DNI / Identificación', value: patientData.dni },
                    { label: 'Obra Social', value: patientData.obraSocial || 'Particular', isBadge: true },
                    { label: 'Teléfono', value: patientData.phone },
                    { label: 'Email', value: patientData.email },
                    { label: 'Dirección', value: patientData.address },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{item.label}</p>
                      {item.isBadge ? (
                        <span className="badge badge-sky border border-sky-200">{item.value}</span>
                      ) : (
                        <p className="text-sm font-bold text-slate-700">{item.value || '-'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cronología de Casos ({casos.length})</h2>
              </div>
              
              {casos.length === 0 ? (
                <div className="card text-center py-16">
                  <p className="text-slate-500 italic">No se registran atenciones clínicas aún.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {casos.map((c) => {
                    const fecha = c.createdAt || c.date;
                    return (
                      <div key={c.id} className="card group hover:border-blue-200 transition-all duration-200">
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-shrink-0 w-16 h-16 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{fecha ? format(parseISO(fecha), 'MMM', { locale: es }) : ''}</span>
                            <span className="text-2xl font-black text-slate-700 group-hover:text-blue-700">{fecha ? format(parseISO(fecha), 'dd') : '-'}</span>
                          </div>
                          
                          <div className="flex-1 space-y-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                {c.tipologia && <span className="badge badge-blue">{c.tipologia}</span>}
                                <span className="text-[11px] font-bold text-slate-400">Atendido por {c.doctorName}</span>
                              </div>
                              <button onClick={() => handlePrint(c)} className="btn-primary !py-2 !px-4 text-xs shadow-md">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4" strokeWidth={2}/></svg>
                                Imprimir Reporte
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                              <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivo / Diagnóstico</h4>
                                <p className="text-sm text-slate-700 leading-relaxed font-medium line-clamp-3">{c.description || c.diagnosis || '-'}</p>
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tratamiento Sugerido</h4>
                                <p className="text-sm text-slate-700 leading-relaxed font-medium line-clamp-3">{c.treatment || '-'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
