import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

const cancelAppointment = onCall<{ appointmentId: string }>(async (request) => {
  if (!request.auth) throw new Error('Unauthorized');

  const { appointmentId } = request.data;
  if (!appointmentId) throw new Error('appointmentId es requerido');

  const snap = await db.collection('appointments').doc(appointmentId).get();
  if (!snap.exists) throw new Error('Cita no encontrada');

  const appointment = snap.data()!;
  const now = Date.now();
  const start = new Date(appointment.date).getTime();
  const diffHours = (start - now) / 36e5;
  if (diffHours <= 48) throw new Error('Solo se permite cancelar con >48h');

  await snap.ref.update({ status: 'cancelled', cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true };
});

export { cancelAppointment };