'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV_LINKS = {
  MEDICO: [
    { href: '/dashboard',    label: 'Dashboard',     icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/appointments', label: 'Turnos',          icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/patients',     label: 'Pacientes',      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { href: '/schedule',     label: 'Horarios',       icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { href: '/casos',        label: 'Casos',          icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/recipes',      label: 'Recetas (R/P)',  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/casos/nuevo',  label: 'Nuevo Caso',     icon: 'M12 4v16m8-8H4' },
  ],
  SECRETARIA: [
    { href: '/dashboard',    label: 'Dashboard',      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/appointments', label: 'Turnos',          icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/patients',     label: 'Pacientes',      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { href: '/casos',        label: 'Casos',          icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ],
  PACIENTE: [
    { href: '/dashboard',    label: 'Inicio',         icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/appointments', label: 'Mis Turnos',      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/book',         label: 'Reservar Turno',  icon: 'M12 4v16m8-8H4' },
    { href: '/mis-reportes', label: 'Mis Reportes',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ],
} as const;

const ROLE_LABELS = { MEDICO: 'Médico', SECRETARIA: 'Secretaria', PACIENTE: 'Paciente' } as const;
const ROLE_COLORS = {
  MEDICO:     'bg-blue-100 text-blue-700',
  SECRETARIA: 'bg-sky-100 text-sky-700',
  PACIENTE:   'bg-slate-100 text-slate-600',
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export function Sidebar({ role }: { role: string }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, signOut } = useAuth();
  const links     = NAV_LINKS[role as keyof typeof NAV_LINKS] ?? [];
  const roleLabel = ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
  const roleColor = ROLE_COLORS[role as keyof typeof ROLE_COLORS] ?? 'bg-slate-100 text-slate-600';

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <aside className="fixed left-0 top-0 w-64 min-h-screen flex flex-col z-40"
      style={{ background: 'linear-gradient(180deg,#0f2044 0%,#0a1628 100%)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Logo & role */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="relative w-36 h-10 mb-3">
          <Image src="/logo_bruno.png" alt="Bruno Doctor" fill className="object-contain brightness-0 invert" />
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColor}`}>{roleLabel}</span>
        {user?.fullName && (
          <p className="text-xs mt-2 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{user.fullName}</p>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map((l) => {
          const active = isActive(l.href);
          return (
            <Link key={l.href} href={l.href}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                background: active ? 'linear-gradient(135deg,rgba(37,99,235,.75),rgba(29,78,216,.6))' : 'transparent',
                boxShadow: active ? '0 2px 8px rgba(37,99,235,.25)' : 'none',
              }}
            >
              <Icon d={l.icon} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-5 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '0.75rem' }}>
        {role === 'MEDICO' && (
          <>
            <Link href="/admin/tipologias"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Icon d="M4 6h16M4 12h16m-7 6h7" />
              Tipologías
            </Link>
            <Link href="/admin/statistics"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              Estadísticas
            </Link>
            <Link href="/admin/delete-requests"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              Solicitudes de Baja
            </Link>
          </>
        )}
        <Link href="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.5)' }}>
          <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          Mi Perfil
        </Link>
        <button onClick={async () => { await signOut(); router.push('/login'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left"
          style={{ color: 'rgba(255,255,255,0.4)', background: 'transparent' }}>
          <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
