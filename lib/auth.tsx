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

const FIREBASE_DOMAIN = 'brunodoctor-e59ec.firebaseio.com';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUserDoc(firebaseUser: User, retries = 3): Promise<AuthUser | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await firebaseUser.getIdToken(true);
      const ref = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const data = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          fullName: firebaseUser.displayName || '',
          photoURL: firebaseUser.photoURL || null,
          role: 'PACIENTE' as Role,
          phone: '',
          address: '',
          dni: '',
          obraSocial: '',
          stampURL: '',
          bannerURL: '',
          createdAt: new Date().toISOString(),
        };
        await setDoc(ref, data);
        return data;
      }
      return { ...(snap.data() as AuthUser), uid: firebaseUser.uid };
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 15000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout);
      if (cancelled) return;
      if (firebaseUser) {
        try {
          const data = await fetchUserDoc(firebaseUser);
          if (!cancelled) {
            setUser(data);
            setLoading(false);
          }
        } catch (e) {
          console.error('Auth error:', e);
          if (!cancelled) {
            setUser(null);
            setLoading(false);
          }
        }
      } else {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
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