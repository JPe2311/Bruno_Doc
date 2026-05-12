'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase/client';
import { Role } from '@/lib/types/domain';
import toast from 'react-hot-toast';

interface AuthUser extends User {
  role?: Role;
  fullName?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = userDoc.data();
        setUser({
          ...firebaseUser,
          role: userData?.role ?? 'PACIENTE',
          fullName: userData?.fullName ?? firebaseUser.displayName,
        } as AuthUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const { user: firebaseUser } = result;
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          fullName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          role: 'PACIENTE',
          createdAt: serverTimestamp(),
        });
      }
      toast.success('Sesión iniciada correctamente');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al iniciar sesión';
      toast.error(message);
      console.error('Sign in error:', error);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast.success('Sesión cerrada');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRequireAuth(redirectTo = '/login') {
  const { user, loading } = useAuth();
  return { user, loading };
}