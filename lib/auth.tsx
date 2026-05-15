'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Role } from '@/lib/types/domain';

export interface AuthUser {
  uid: string;
  email: string;
  fullName: string;
  photoURL: string | null;
  role: Role;
  phone: string;
  address: string;
  dni: string;
  obraSocial: string;
  stampURL: string;
  bannerURL: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

async function createSessionCookie(firebaseUser: User, role: string): Promise<void> {
  try {
    const idToken = await firebaseUser.getIdToken();
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, role }),
    });
  } catch {
    // Non-blocking
  }
}

async function fetchUserDoc(firebaseUser: User): Promise<AuthUser> {
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const data: AuthUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      fullName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL || null,
      role: 'PACIENTE',
      phone: '',
      address: '',
      dni: '',
      obraSocial: '',
      stampURL: '',
      bannerURL: '',
    };
    await setDoc(ref, { ...data, createdAt: new Date().toISOString() });
    return data;
  }

  const existing = snap.data() as AuthUser;
  if (!existing.role) {
    await setDoc(ref, { role: 'PACIENTE' }, { merge: true });
    return { ...existing, role: 'PACIENTE', uid: firebaseUser.uid };
  }
  return { ...existing, uid: firebaseUser.uid };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fallbackTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(fallbackTimer);
      if (cancelled) return;

      if (firebaseUser) {
        setLoading(true);
        // Create session cookie and fetch user doc in parallel
        Promise.all([fetchUserDoc(firebaseUser)])
          .then(([userData]) => {
            createSessionCookie(firebaseUser, userData.role); // fire-and-forget
            if (!cancelled) {
              setUser(userData);
              setLoading(false);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setUser(null);
              setLoading(false);
            }
          });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {
      // Ignore logout errors
    }
    await firebaseSignOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}