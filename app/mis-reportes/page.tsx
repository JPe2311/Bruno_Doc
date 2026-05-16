'use client';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function MyReportsPage() {
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && user.uid) {
      window.location.href = `/pacientes/${user.uid}`;
    } else if (!authLoading && !user) {
      window.location.href = '/login';
    }
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="spinner" />
      </div>
    );
  }

  return null;
}