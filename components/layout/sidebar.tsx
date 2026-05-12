'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  ],
} as const;

const ROLE_LABELS = { MEDICO: 'Médico', SECRETARIA: 'Secretaria', PACIENTE: 'Paciente' } as const;

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const links = NAV_LINKS[role as keyof typeof NAV_LINKS] ?? [];

  return (
    <aside className="w-64 min-h-screen border-r bg-white p-4 flex flex-col">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-sky-600">Bruno Doctor</h1>
        <p className="text-xs text-slate-500">{ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}</p>
      </div>
      <nav className="space-y-1">
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
    </aside>
  );
}
