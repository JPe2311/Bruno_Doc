'use client';
import { Appointment, AppointmentStatus } from '@/lib/types/domain';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: 'border-l-blue-400 bg-blue-50',
  confirmed: 'border-l-green-400 bg-green-50',
  in_progress: 'border-l-yellow-400 bg-yellow-50',
  completed: 'border-l-slate-400 bg-slate-50',
  cancelled: 'border-l-red-400 bg-red-50 opacity-60',
  no_show: 'border-l-gray-400 bg-gray-50 opacity-60',
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};

export function DayCalendar({ appointments }: { appointments: Appointment[] }) {
  return (
    <div className="card">
      <h2 className="mb-3 text-lg font-semibold">Calendario Diario</h2>
      {appointments.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No hay citas para este día</p>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <div key={a.id} className={`rounded border-l-4 p-3 ${STATUS_COLORS[a.status]}`}>
              <div className="flex justify-between items-start">
                <p className="font-medium">{a.patientName}</p>
                <span className="text-xs px-2 py-0.5 rounded bg-white border">{STATUS_LABELS[a.status]}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                {format(parseISO(a.date), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })} · {a.durationMinutes} min
              </p>
              {a.type && <p className="text-xs text-slate-500 mt-1">{a.type}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
