'use client';
import { useEffect, useState } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { useRouter } from 'next/navigation';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

type Period = 'today' | 'week' | 'month' | 'year' | 'all';

interface Stats {
  totalAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  totalRecipes: number;
  totalCases: number;
  uniquePatients: number;
  appointmentsByType: Record<string, number>;
  patientsWithMultipleVisits: Array<{ patientName: string; patientDni: string; count: number }>;
}

export default function StatisticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('month');
  const [stats, setStats] = useState<Stats>({
    totalAppointments: 0,
    confirmedAppointments: 0,
    cancelledAppointments: 0,
    totalRecipes: 0,
    totalCases: 0,
    uniquePatients: 0,
    appointmentsByType: {},
    patientsWithMultipleVisits: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
    if (!authLoading && user && user.role !== 'MEDICO' && user.role !== 'SECRETARIA') {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = new Date();

        switch (period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
          case 'week':
            startDate = startOfWeek(now, { weekStartsOn: 1 });
            endDate = endOfWeek(now, { weekStartsOn: 1 });
            break;
          case 'month':
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
          default:
            startDate = new Date(2020, 0, 1);
            endDate = new Date(2099, 11, 31, 23, 59, 59);
        }

        console.log('Fetching stats for period:', period, 'from', startDate, 'to', endDate);

        const appointmentsQ = query(collection(db, 'appointments'));
        const appointmentsSnap = await getDocs(appointmentsQ);
        const appointments = appointmentsSnap.docs.map(d => d.data()) as Array<{
          id: string; date: string; status: string; type: string; patientUid: string; patientName: string; patientDni: string;
        }>;

        console.log('Total appointments in DB:', appointments.length);

        const filteredAppointments = appointments.filter(a => {
          const aptDate = parseISO(a.date);
          const inRange = isWithinInterval(aptDate, { start: startDate, end: endDate });
          return inRange;
        });
        
        console.log('Filtered appointments:', filteredAppointments.length);

        const confirmedCount = filteredAppointments.filter(a => a.status === 'confirmed').length;
        const cancelledCount = filteredAppointments.filter(a => a.status === 'cancelled').length;

        const typeCount: Record<string, number> = {};
        filteredAppointments.forEach(a => {
          const type = a.type || 'Otro';
          typeCount[type] = (typeCount[type] || 0) + 1;
        });

        const patientsMap: Record<string, { patientName: string; patientDni: string; count: number }> = {};
        filteredAppointments.forEach(a => {
          if (!patientsMap[a.patientUid]) {
            patientsMap[a.patientUid] = { patientName: a.patientName, patientDni: a.patientDni || '', count: 0 };
          }
        });
        Object.values(patientsMap).forEach(p => {
          const patientAppointments = filteredAppointments.filter(a => a.patientName === p.patientName);
          p.count = patientAppointments.length;
        });
        const patientsWithMultiple = Object.values(patientsMap)
          .filter(p => p.count > 1)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const uniquePatientIds = new Set(filteredAppointments.map(a => a.patientUid));

        const recipesQ = query(collection(db, 'recipes'));
        const recipesSnap = await getDocs(recipesQ);
        const allRecipes = recipesSnap.docs.map(d => d.data()) as Array<{ id: string; date: string }>;
        const filteredRecipes = allRecipes.filter(r => {
          const rDate = parseISO(r.date);
          return isWithinInterval(rDate, { start: startDate, end: endDate });
        });

        const casosQ = query(collection(db, 'casos'));
        const casosSnap = await getDocs(casosQ);
        const allCases = casosSnap.docs.map(d => d.data()) as Array<{ id: string; date: string }>;
        const filteredCases = allCases.filter(c => {
          const cDate = parseISO(c.date);
          return isWithinInterval(cDate, { start: startDate, end: endDate });
        });

        setStats({
          totalAppointments: filteredAppointments.length,
          confirmedAppointments: confirmedCount,
          cancelledAppointments: cancelledCount,
          totalRecipes: filteredRecipes.length,
          totalCases: filteredCases.length,
          uniquePatients: uniquePatientIds.size,
          appointmentsByType: typeCount,
          patientsWithMultipleVisits: patientsWithMultiple,
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user, period]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="spinner" />
      </div>
    );
  }

  const topTypes = Object.entries(stats.appointmentsByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar role={user.role} />
      </div>
      <MobileHeader role={user.role} />
      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto pt-16 lg:pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Estadísticas de la Clínica</h1>
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'year', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === p ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : p === 'year' ? 'Año' : 'Total'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="card">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Citas</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalAppointments}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats.confirmedAppointments} confirmadas • {stats.cancelledAppointments} canceladas
                </p>
              </div>
              <div className="card">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Pacientes Atendidos</p>
                <p className="text-3xl font-bold text-slate-900">{stats.uniquePatients}</p>
                <p className="text-xs text-slate-500 mt-1">Pacientes únicos</p>
              </div>
              <div className="card">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Casos Registrados</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalCases}</p>
                <p className="text-xs text-slate-500 mt-1">Historias clínicas</p>
              </div>
              <div className="card">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Recetas Generadas</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalRecipes}</p>
                <p className="text-xs text-slate-500 mt-1">Documentos R/P</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-4">Tipos de Atención</h3>
                {topTypes.length === 0 ? (
                  <p className="text-slate-500 text-sm">No hay datos en este período</p>
                ) : (
                  <div className="space-y-3">
                    {topTypes.map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700">{type}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${(count / stats.totalAppointments) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-slate-900 w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-4">Pacientes con Múltiples Visitas</h3>
                {stats.patientsWithMultipleVisits.length === 0 ? (
                  <p className="text-slate-500 text-sm">No hay pacientes con múltiples visitas</p>
                ) : (
                  <div className="space-y-3">
                    {stats.patientsWithMultipleVisits.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{p.patientName}</p>
                          {p.patientDni && <p className="text-xs text-slate-500">DNI: {p.patientDni}</p>}
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm font-bold rounded">
                          {p.count} visitas
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-4">Tasa de Confirmación</h3>
                <div className="flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3"
                        strokeDasharray={`${stats.totalAppointments > 0 ? (stats.confirmedAppointments / stats.totalAppointments) * 100 : 0} 100`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-slate-900">
                        {stats.totalAppointments > 0 ? Math.round((stats.confirmedAppointments / stats.totalAppointments) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-center text-sm text-slate-500 mt-2">
                  {stats.confirmedAppointments} de {stats.totalAppointments} citas confirmadas
                </p>
              </div>

              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-4">Resumen del Período</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Citas programadas</span>
                    <span className="font-medium text-slate-900">{stats.totalAppointments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Citas confirmadas</span>
                    <span className="font-medium text-green-600">{stats.confirmedAppointments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Citas canceladas</span>
                    <span className="font-medium text-red-600">{stats.cancelledAppointments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Recetas emitidas</span>
                    <span className="font-medium text-slate-900">{stats.totalRecipes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Casos clínicos</span>
                    <span className="font-medium text-slate-900">{stats.totalCases}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}