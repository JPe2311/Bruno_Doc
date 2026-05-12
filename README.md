# Bruno Doctor - SaaS Gestión Clínica

Aplicación SaaS **production-ready** para gestión de clínicas médicas (en español) con arquitectura limpia y control por roles.

## Stack
- Next.js App Router + TypeScript + Tailwind
- Firebase Auth (Google)
- Firestore
- Firebase Functions
- Vercel-ready

## Arquitectura
- `app/`: vistas y rutas
- `components/`: componentes UI reutilizables
- `lib/services`: capa de negocio
- `lib/rbac`: permisos y autorización
- `functions/`: backend crítico (cancelación 48h, no_show automático)
- `rules/`: reglas de seguridad Firestore

## Colecciones Firestore
- `users/{uid}`: perfil + rol
- `patients/{uid}`: datos clínicos base + patientId `P-XXXX`
- `appointments/{id}`: agenda, síntomas, estado
- `medical_records/{id}`: diagnóstico, notas, receta (solo MEDICO)
- `catalog_tables/categories`: categorías médicas dinámicas
- `activity_logs/{id}`: accesos y acciones

## Roles
- **MEDICO**: acceso total, historial médico, gestión de roles
- **SECRETARIA**: agenda y pacientes sin diagnósticos
- **PACIENTE**: solo su perfil y sus citas

## Variables de entorno
Crear `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Ejecutar local
```bash
npm install
npm run dev
```

## Deploy Vercel
1. Conectar repo a Vercel.
2. Definir variables de entorno.
3. Deploy automático con `npm run build`.

## Firebase Functions
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## Funcionalidades clave implementadas
- Login Google + base onboarding
- RBAC y navegación por rol
- Servicio de citas con prevención de doble reserva
- Regla de cancelación >48h en backend
- Tarea programada para marcar `no_show`
- Base de reglas de Firestore para acceso seguro
- Preparado para WhatsApp links y plantillas
- Estructura lista para PDF de recetas y analítica avanzada
