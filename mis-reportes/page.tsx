'use client';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function MyReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
    if (!authLoading && user) {
      router.replace(`/pacientes/${user.uid}`);
    }
  }, [user, authLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="spinner" />
    </div>
  );
}