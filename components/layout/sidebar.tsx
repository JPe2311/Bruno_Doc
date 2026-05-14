'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV_LINKS = {
  MEDICO: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/appointments', label: 'Citas' },
    { href: '/patients', label: 'Pacientes' },
    { href: '/schedule', label: 'Horarios' },
    { href: '/casos', label: 'Casos' },
    { href: '/casos/nuevo', label: 'Nuevo Caso' },
  ],
  SECRETARIA: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/appointments', label: 'Citas' },
    { href: '/patients', label: 'Pacientes' },
    { href: '/casos', label: 'Casos' },
  ],
  PACIENTE: [
    { href: '/dashboard', label: 'Inicio' },
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
        <div className="relative w-40 h-12">
          <Image
            src="/logo_bruno.png"
            alt="Bruno Doctor"
            fill
            className="object-contain"
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">{ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}</p>
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
      <div className="border-t pt-3 mt-3 space-y-1">
        {role === 'MEDICO' && (
          <Link
            href="/admin/tipologias"
            className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
              pathname === '/admin/tipologias' ? 'bg-sky-50 text-sky-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            Tipologias
          </Link>
        )}
        <Link
          href="/profile"
          className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
            pathname === '/profile' ? 'bg-sky-50 text-sky-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Mi Perfil
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 rounded px-3 py-2 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
