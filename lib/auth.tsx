'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';

interface UserData {
  uid: string;
  email: string;
  role: 'MEDICO' | 'SECRETARIA' | 'PACIENTE';
  fullName: string;
  onboardingCompleted?: boolean;
  dni?: string;
  phone?: string;
  address?: string;
  obraSocial?: string;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

async function createSessionCookie(firebaseUser: User, role: string): Promise<boolean> {
  try {
    const idToken = await firebaseUser.getIdToken(true);
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, role }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Session API error:', res.status, errorText);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Session Error:', err);
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const userData = { uid: firebaseUser.uid, ...docSnap.data() } as UserData;
            await createSessionCookie(firebaseUser, userData.role);
            setUser(userData);
          } else {
            // New user
            await createSessionCookie(firebaseUser, 'PACIENTE');
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: 'PACIENTE',
              fullName: '',
              onboardingCompleted: false,
            });
          }
        } catch (err) {
          console.error('Auth Init Error:', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      await fetch('/api/auth/session', { method: 'DELETE' });
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);