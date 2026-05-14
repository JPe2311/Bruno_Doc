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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUserDoc(firebaseUser: User): Promise<AuthUser> {
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
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let fired = false;
    const fallbackTimer = setTimeout(() => {
      if (!cancelled && !fired) {
        setLoading(false);
      }
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(fallbackTimer);
      fired = true;
      if (cancelled) return;
      if (firebaseUser) {
        setLoading(true);
        fetchUserDoc(firebaseUser).then((data) => {
          if (!cancelled) {
            setUser(data);
            setLoading(false);
          }
        }).catch((e) => {
          console.error('Auth error:', e);
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