# Tierra Santa · Sistema de gestión

Aplicación web de **Procesadora de Alimentos Tierra Santa** que reemplaza ERP Clientes, ERP Proveedores (COP y USD), Nómina (Google Apps Script + Sheets) y el programa de facturación de Windows. Se usa en **PC y teléfono**.

**Stack:** Next.js 16 (App Router) + TypeScript estricto · Tailwind CSS 4 + shadcn/ui (Base UI) · Supabase (Postgres, Auth, Storage, RLS) · Zod · react-hook-form · decimal.js · Vitest · Playwright.

## Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| — | Esquema de base de datos completo (todas las fases) | ✅ |
| 1 | Base: layout, tema, inicio de sesión con logo, perfiles/roles/estado/vencimiento, usuarios, auditoría, empresa con logo | ✅ |
| 2 | Catálogos (productos con código, unidades, ubicaciones, monedas/tasas, métodos de pago, tareas) | ⏳ |
| 3 | Proveedores unificados | ⏳ |
| 4 | Clientes | ⏳ |
| 5 | Facturación (UI y PDF; las funciones de BD ya existen) | ⏳ |
| 6 | Inventario (UI; las funciones de BD ya existen) | ⏳ |
| 7 | Nómina (calendario por empleado, jornadas fijo/destajo) | ⏳ |
| 8 | Dashboard, métricas y reportes | ⏳ |
| 9 | Migración desde Google Sheets | ⏳ |
| 10 | Pulido y despliegue | ⏳ |

## Instalación local

Requisitos: Node 20+ y Docker (para Supabase local).

```bash
npm install
npx supabase start            # levanta Postgres/Auth/Storage locales y aplica supabase/migrations
cp .env.example .env.local    # pegar API URL, anon key y service_role key que imprime `supabase start`
npm run crear-admin -- samer "MiClave2026" "Samer"   # primer administrador
npm run dev                   # http://localhost:3000
```

El usuario inicia sesión con su **nombre de usuario** (no hace falta correo). Internamente se usa `usuario@usuarios.tierrasanta.local` como correo de Supabase Auth.

## Supabase en la nube

1. Crear el proyecto en supabase.com (región cercana, p. ej. `us-east-1`).
2. Aplicar las migraciones: `npx supabase link --project-ref <ref>` y `npx supabase db push`.
3. En **Authentication → Providers → Email**: desactivar "Confirm email" (los usuarios los crea el admin) y desactivar el registro público ("Allow new users to sign up" = off).
4. Crear el primer admin con `npm run crear-admin` apuntando `.env.local` al proyecto de la nube.
5. Los buckets `empresa` (público), `entregas` y `facturas` (privados) los crea la migración `..._storage.sql`.

Tipos TypeScript: `npm run db:types` (contra Supabase local) regenera `src/lib/supabase/database.types.ts`.

## Despliegue en Vercel

1. Importar el repositorio de GitHub en Vercel (framework Next.js, sin cambios de build).
2. Variables de entorno (Production y Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - `SUPABASE_SERVICE_ROLE_KEY` — **solo servidor**, nunca con prefijo `NEXT_PUBLIC_`
3. En Supabase → Authentication → URL Configuration, poner la URL de Vercel como *Site URL*.

## Pruebas

```bash
npm test              # unitarias: fórmulas de entregas FIJO/VARIABLE, IVA, reparto de pagos, saldos, nómina, formatos
npm run test:sql      # migraciones + flujo factura → inventario → cuenta por cobrar en Postgres (requiere PGHOST/PGPORT/PGUSER)
npm run test:e2e      # Playwright en PC y teléfono (requiere Supabase local, build y admin E2E)
npm run typecheck && npm run lint
```

## Estructura del proyecto

```
supabase/
  migrations/            # SQL versionado (orden por fecha)
    …0100_base.sql                  perfiles, roles, auditoría, empresa, contadores
    …0200_catalogos.sql             monedas, tasas, unidades, ubicaciones, productos, métodos de pago
    …0300_clientes_facturas.sql     clientes, facturas, líneas, versiones, pagos y su aplicación, empaques
    …0400_proveedores.sql           proveedores, entregas FIJO/VARIABLE, abonos, cestas
    …0500_inventario.sql            movimientos (libro mayor), existencias, lotes, producción, traslados, ajustes
    …0600_nomina.sql                empleados, tareas, jornadas, abonos, periodos y cierre
    …0700_funciones_facturacion.sql emitir / editar / anular factura, pagos, saldo a favor
    …0800_vistas_saldos.sql         saldos por moneda, resúmenes, KPIs, antigüedad, kardex
    …0900_seguridad_rls.sql         RLS de todas las tablas y permisos de funciones
    …1000_storage.sql               buckets y políticas
    …1100_datos_iniciales.sql       unidades, ubicaciones, frutas 1–9, métodos de pago, tareas
  tests/                 # shim de Supabase + prueba SQL de extremo a extremo
src/
  app/
    page.tsx             # pantalla de inicio: logo + inicio de sesión
    auth/                # cerrar sesión forzado, cambiar contraseña
    (app)/               # zona privada con barra lateral
      dashboard/ facturacion/ clientes/ proveedores/ inventario/ nomina/ reportes/
      configuracion/     # general, empresa, usuarios, catálogos, auditoría
  components/
    ui/                  # shadcn/ui
    app/                 # barra lateral, barra superior, tema
    comunes/             # campos, KPI, paginación, confirmaciones, estados vacíos
  features/              # lógica por módulo: acciones (Server Actions), esquemas Zod, componentes
    auth/ configuracion/ usuarios/ auditoria/
  lib/
    supabase/            # clientes (servidor, navegador, admin), proxy de sesión, tipos generados
    auth/                # roles/permisos, sesión, reglas de acceso
    calculos/            # fórmulas puras (espejo de la BD) para vistas previas y pruebas
    dinero.ts fechas.ts  # decimal.js, formato es-VE, zona America/Caracas
  proxy.ts               # refresco de sesión y protección de rutas (antes "middleware")
scripts/                 # crear-admin, probar-sql (y en la Fase 9: migrar)
tests/unit  tests/e2e
```

## Migración desde Google Sheets

Se entrega en la Fase 9 (`scripts/migrar`, con modo simulación y reporte de verificación de saldos).
