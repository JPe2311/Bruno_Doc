import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const projectId    = process.env.FIREBASE_PROJECT_ID    ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const storageBucket= process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      storageBucket,
    });
  } else if (projectId) {
    // Fallback for build-time or environments without service account
    admin.initializeApp({ projectId, storageBucket });
  }
}

export { admin };
export const db = admin.apps.length ? admin.firestore() : null as unknown as admin.firestore.Firestore;