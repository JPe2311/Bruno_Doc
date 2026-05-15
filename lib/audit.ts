import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'VIEW_CASO'
  | 'PRINT_CASO'
  | 'CREATE_CASO'
  | 'UPDATE_CASO'
  | 'DELETE_CASO'
  | 'VIEW_PATIENT_RECORD'
  | 'VIEW_APPOINTMENT'
  | 'CREATE_APPOINTMENT';

interface AuditPayload {
  userId: string;
  userEmail: string;
  userRole: string;
  action: AuditAction;
  resourceId?: string;
  resourceType?: string;
  patientUid?: string;
}

/**
 * Escribe un audit log en Firestore. Falla silenciosamente para no bloquear la UX.
 */
export async function logAudit(
  user: { uid: string; email: string; role: string },
  action: AuditAction,
  resource?: { id?: string; type?: string; patientUid?: string }
): Promise<void> {
  try {
    const payload: AuditPayload = {
      userId: user.uid,
      userEmail: user.email,
      userRole: user.role,
      action,
    };
    if (resource?.id) payload.resourceId = resource.id;
    if (resource?.type) payload.resourceType = resource.type;
    if (resource?.patientUid) payload.patientUid = resource.patientUid;

    await addDoc(collection(db, 'audit_logs'), {
      ...payload,
      timestamp: serverTimestamp(),
    });
  } catch {
    // Audit failures are silent — never block user flow
  }
}
