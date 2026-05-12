export interface Patient {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  dni: string;
  role: Role;
  createdAt?: string;
}

export interface Appointment {
  id: string;
  patientUid: string;
  patientName: string;
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
  type: 'specialty' | 'service' | 'insurance';
  name: string;
  active: boolean;
}

export type Role = 'MEDICO' | 'SECRETARIA' | 'PACIENTE';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';