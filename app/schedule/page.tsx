'use client';
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { DayOfWeek } from '@/lib/types/domain';

const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miercoles',
  4: 'Jueves', 5: 'Viernes', 6: 'Sabado',
};

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
];

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [enabledDays, setEnabledDays] = useState<Record<DayOfWeek, boolean>>({
    0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false,
  });
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

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
        if (data.timeSlots) setSelectedSlots(data.timeSlots.map((s: { start: string }) => s.start));
      }
    };
    fetchSchedule();
  }, [user]);

  const toggleDay = (day: DayOfWeek) => {
    setEnabledDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const toggleSlot = (slot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'schedules', user.uid), {
        doctorUid: user.uid,
        doctorName: user.fullName,
        enabledDays,
        timeSlots: selectedSlots.map((start) => ({
          start,
          end: (() => {
            const [h, m] = start.split(':').map(Number);
            const endMin = h * 60 + m + 30;
            return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
          })(),
        })),
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
    <div className="flex">
      <Sidebar role={user.role} />
      <main className="flex-1 p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Configurar Horarios de Atencion</h1>

        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Dias de Atencion</h2>
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

        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Horarios Disponibles</h2>
          <p className="text-sm text-slate-500 mb-3">Selecciona los horarios en los que atiendes</p>
          <div className="grid grid-cols-6 gap-2">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                onClick={() => toggleSlot(slot)}
                className={`py-2 px-3 rounded text-sm border transition-colors ${
                  selectedSlots.includes(slot)
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Horarios'}
        </button>
      </main>
    </div>
  );
}
