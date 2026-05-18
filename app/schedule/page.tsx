'use client';
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { DayOfWeek } from '@/lib/types/domain';

const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles',
  4: 'Jueves', 5: 'Viernes', 6: 'Sábado',
};

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30',
];

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [enabledDays, setEnabledDays] = useState<Record<DayOfWeek, boolean>>({
    0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false,
  });
  const [daySchedules, setDaySchedules] = useState<Record<DayOfWeek, string[]>>({
    0: [], 1: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'], 
    2: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'], 
    3: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'], 
    4: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'], 
    5: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'], 
    6: [],
  });

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
    const fetchSchedule = async () => {
      const ref = doc(db, 'schedules', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data.enabledDays) setEnabledDays(data.enabledDays);
        if (data.daySchedules) setDaySchedules(data.daySchedules);
      }
    };
    fetchSchedule();
  }, [user]);

  const toggleDay = (day: DayOfWeek) => {
    setEnabledDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const toggleSlotForDay = (day: DayOfWeek, slot: string) => {
    setDaySchedules((prev) => {
      const currentSlots = prev[day] || [];
      const newSlots = currentSlots.includes(slot)
        ? currentSlots.filter((s) => s !== slot)
        : [...currentSlots, slot].sort();
      return { ...prev, [day]: newSlots };
    });
  };

  const copyScheduleToDay = (fromDay: DayOfWeek, toDay: DayOfWeek) => {
    setDaySchedules((prev) => ({
      ...prev,
      [toDay]: [...prev[fromDay]],
    }));
  };

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const timeSlotsData: Record<DayOfWeek, { start: string; end: string }[]> = {} as Record<DayOfWeek, { start: string; end: string }[]>;
      
      (Object.keys(DAY_LABELS).map(Number) as unknown as DayOfWeek[]).forEach((day) => {
        if (enabledDays[day] && daySchedules[day]?.length > 0) {
          timeSlotsData[day] = daySchedules[day].map((start) => {
            const [h, m] = start.split(':').map(Number);
            const endMin = h * 60 + m + 30;
            const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
            return { start, end: endTime };
          });
        } else {
          timeSlotsData[day] = [];
        }
      });

      await setDoc(doc(db, 'schedules', user.uid), {
        doctorUid: user.uid,
        doctorName: user.fullName,
        enabledDays,
        daySchedules,
        timeSlotsData,
        slotDuration: 30,
      });
      toast.success('Horarios guardados correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar horarios');
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
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar role={user.role} />
      </div>
      <MobileHeader role={user.role} />
      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto pt-16 lg:pt-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Configurar Horarios por Día</h1>

        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Días de Atención</h2>
          <div className="grid grid-cols-7 gap-2">
            {(Object.keys(DAY_LABELS).map(Number) as unknown as DayOfWeek[]).map((day) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`p-3 rounded text-center text-sm font-medium transition-colors ${
                  enabledDays[day] ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {(Object.keys(DAY_LABELS).map(Number) as unknown as DayOfWeek[]).map((day) => (
            enabledDays[day] && (
              <div key={day} className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">{DAY_LABELS[day]}</h3>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6].filter(d => d !== day).map((d) => (
                      <button
                        key={d}
                        onClick={() => copyScheduleToDay(day, d as DayOfWeek)}
                        className="text-xs text-sky-600 hover:underline"
                        title={`Copiar a ${DAY_LABELS[d as DayOfWeek]}`}
                      >
                        → {DAY_LABELS[d as DayOfWeek]}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-3">Selecciona los horarios disponibles</p>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => toggleSlotForDay(day, slot)}
                      className={`py-2 px-2 rounded text-sm border transition-colors ${
                        daySchedules[day]?.includes(slot)
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {daySchedules[day]?.length || 0} horarios seleccionados
                </p>
              </div>
            )
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Horarios'}
        </button>
      </main>
    </div>
  );
}