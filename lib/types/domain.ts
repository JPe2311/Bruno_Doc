export interface Patient {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  dni: string;
  obraSocial: string;
  role: Role;
  createdAt?: string;
}

export interface Appointment {
  id: string;
  patientUid: string;
  patientName: string;
  patientDni?: string;
  doctorUid: string;
  doctorName: string;
  date: string;
  durationMinutes: number;
  status: AppointmentStatus;
  type: string;
  notes?: string;
  cancelledAt?: string;
  noShow?: boolean;
}

export interface MedicalRecord {
  id: string;
  patientUid: string;
  doctorUid: string;
  date: string;
  diagnosis: string;
  treatment: string;
  notes?: string;
}

export interface CatalogTable {
  id: string;
  type: 'specialty' | 'service' | 'insurance' | 'tipologia';
  name: string;
  active: boolean;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeSlot {
  start: string;
  end: string;
}

export interface DoctorSchedule {
  doctorUid: string;
  enabledDays: Record<DayOfWeek, boolean>;
  timeSlots: TimeSlot[];
  slotDuration: number;
}

export interface Caso {
  id: string;
  patientUid: string;
  patientData: {
    fullName: string;
    dni: string;
    obraSocial: string;
    address: string;
    phone: string;
    email: string;
  };
  doctorUid: string;
  doctorName: string;
  date: string;
  tipologia?: string;
  description: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  createdAt: string;
}

export interface Recipe {
  id: string;
  patientUid: string;
  patientName: string;
  patientDni?: string;
  patientObraSocial?: string;
  doctorUid: string;
  doctorName: string;
  date: string;
  recommendations: string;
  createdAt: string;
}

export type Role = 'MEDICO' | 'SECRETARIA' | 'PACIENTE';

export type AppointmentStatus = 'pending' | 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
