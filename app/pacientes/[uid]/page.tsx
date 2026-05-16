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
                    { label: 'Teléfono', value: patientData.phone, isPhone: true },
                    { label: 'Email', value: patientData.email },
                    { label: 'Dirección', value: patientData.address },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{item.label}</p>
                      {item.isBadge ? (
                        <span className="badge badge-sky border border-sky-200">{item.value}</span>
                      ) : item.isPhone && item.value ? (
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-700">{item.value}</p>
                          <a
                            href={`https://wa.me/${item.value.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.195.194 1.653.048.649-.205 1.201-.703 1.423-1.505.034-.145.025-.297.025-.52-.01-.193-.493-1.91-.672-2.588z"/>
                              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.12.613 4.08 1.69 5.79l-1.74 4.03c-.39.9.2 2.02 1.37 2.02 2.37 0 4.9-1.23 6.65-2.72 1.74-1.49 3.02-3.33 3.02-5.13 0-2.87-2.39-5.22-5.37-5.22-2.28 0-4.18 1.3-4.95 2.68-.45.81-.5 1.84-.27 2.65l.66 1.57c.23.55.76 1.12 1.37 1.35.61.22 1.2.04 1.56-.24.37-.29.95-.82 1.22-1.15.27-.33.48-.27.68-.15.2.12.42.29.54.45.12.16.39.49.39.61 0 .12-.12.49-.55.99-1.02 1.19-2.26 2.27-3.24 2.72-1.11.5-2.2.62-2.91.46-.7-.15-2.06-.9-3.95-2.9-1.66-1.76-2.76-3.84-2.93-4.43-.17-.58-.1-.9.06-1.18.15-.28.36-.48.54-.69.18-.21.39-.35.54-.56.15-.2.2-.37.28-.58.08-.21.04-.42-.01-.59-.05-.17-.48-1.22-.48-1.22s.31-.21.36-.49c.05-.28.11-.73-.21-1.28-.32-.55-.74-.96-1.08-1.14-.34-.18-.69-.24-1.02-.15-.33.08-.62.31-.77.52-.15.21-.49.75-.49.75s-.37-.16-.71-.26c-.34-.1-.75-.05-1.14.08-.39.13-.93.38-1.42.73-.5.35-1.05.73-1.1.75-.05.02-.04.15-.03.32 0 .17.06.47.27.92.21.45.44.92.68 1.29.24.37.52.75.36 1.17-.15.42-.65 1.05-1.04 1.55-.39.5-.78 1.04-.31 2.05.47 1.01 1.95 2.19 4.25 3.14 2.3.95 4.37.93 5.84.74 1.47-.19 2.93-.77 4.03-1.58 1.1-.81 1.91-1.75 2.13-2.04.22-.29.24-.41.24-.66-.01-.25-.01-.51-.01-.77.17-.02.34-.05.49-.08z"/>
                            </svg>
                            WhatsApp
                          </a>
                        </div>
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
