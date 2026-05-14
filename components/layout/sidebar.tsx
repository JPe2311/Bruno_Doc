'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV_LINKS = {
  MEDICO: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/appointments', label: 'Citas' },
    { href: '/patients', label: 'Pacientes' },
  ],
  SECRETARIA: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/appointments', label: 'Citas' },
    { href: '/patients', label: 'Pacientes' },
  ],
  PACIENTE: [
    { href: '/appointments', label: 'Mis Citas' },
    { href: '/book', label: 'Reservar Cita' },
  ],
} as const;

const ROLE_LABELS = { MEDICO: 'Medico', SECRETARIA: 'Secretaria', PACIENTE: 'Paciente' } as const;

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const links = NAV_LINKS[role as keyof typeof NAV_LINKS] ?? [];

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <aside className="w-64 min-h-screen border-r bg-white p-4 flex flex-col">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-sky-600">Bruno Doctor</h1>
        <p className="text-xs text-slate-500">{ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}</p>
      </div>
      <nav className="space-y-1 flex-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
              pathname === l.href ? 'bg-sky-50 text-sky-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <button
        onClick={handleSignOut}
        className="mt-4 flex items-center gap-2 rounded px-3 py-2 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Cerrar sesion
      </button>
    </aside>
  );
}
