# Tierra Santa · Sistema de gestión

> Para continuar el desarrollo en otra sesión, leer primero **[HANDOFF.md](HANDOFF.md)**.

Aplicación web de **Procesadora de Alimentos Tierra Santa** que reemplaza ERP Clientes, ERP Proveedores (COP y USD), Nómina (Google Apps Script + Sheets) y el programa de facturación de Windows. Se usa en **PC y teléfono**.

**Stack:** Next.js 16 (App Router) + TypeScript estricto · Tailwind CSS 4 + shadcn/ui (Base UI) · Supabase (Postgres, Auth, Storage, RLS) · Zod · react-hook-form · decimal.js · Vitest · Playwright.

## Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| — | Esquema de base de datos completo (todas las fases) | ✅ |
| 1 | Base: layout, tema, inicio de sesión con correo y logo, roles, usuarios, auditoría, empresa con logo | ✅ |
| 2 | Catálogos (productos con código, unidades, ubicaciones, monedas/tasas, métodos de pago, tareas) + respaldo a Excel | ✅ |
| 3 | Proveedores unificados (entregas con foto, abonos, cestas, estado de cuenta PDF/Excel) | ✅ |
| 4 | Clientes (pagos factura por factura, pago múltiple, saldo a favor, recibos, cajas, estado de cuenta, antigüedad) | ✅ |
| 5 | Facturación (emisión por teclado, borradores, edición con historial, anulación, PDF, listado con filtros) | ✅ |
| 6 | Inventario (stock por ubicación con alertas, producción diaria, merma, traslados, ajustes, kardex y Excel) | ✅ |
| 7 | Nómina (calendario por empleado, jornadas fijo/destajo, asistencia rápida, abonos, periodos con cierre y recibos) | ✅ |
| 8 | Dashboard (periodos con comparación, productos vendidos, rendimiento semanal, gráficos, alertas) y reportes con Excel | ✅ |
| 9 | Migración de los registros de los programas anteriores (Google Sheets y programa de facturación de Windows) | ⏳ |
| 10 | Pulido y despliegue | ⏳ |

## Puesta en marcha (Supabase web + Vercel)

No hace falta instalar nada en tu computadora.

**1. Supabase (supabase.com, en el navegador)**
1. Crea un proyecto nuevo.
2. Ve a **SQL Editor → New query**, pega **todo** el contenido de [`supabase/instalar.sql`](supabase/instalar.sql) y pulsa **Run**. Crea las tablas, funciones, seguridad, buckets de archivos y datos iniciales.
3. Ve a **Authentication → Users → Add user → Create new user**: escribe tu correo y contraseña y marca *Auto Confirm User*. **El primer usuario que crees queda como administrador.**
4. Recomendado: en **Authentication → Sign In / Providers** desactiva *Allow new users to sign up* (los usuarios los crea el admin desde la app). Aunque alguien se registrara por su cuenta, quedaría INACTIVO y sin acceso.
5. Copia de **Project Settings → API**: la *Project URL*, la clave *anon / publishable* y la clave *service_role / secret*.

**2. Vercel**
1. Importa el repositorio de GitHub (Next.js, sin cambiar nada del build).
2. Agrega las variables de entorno:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave anon / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | clave service_role / secret (solo servidor; sirve para crear usuarios y cambiar contraseñas desde la app) |

3. Despliega y entra con el correo y la contraseña del paso 1.3. Los demás usuarios se crean en **Configuración → Usuarios**.

**Actualizaciones de la base de datos:** cada fase que agregue tablas traerá un archivo nuevo en `supabase/migrations/`; se pega solo ese archivo en el SQL Editor (te lo indicaré en cada entrega).

### Desarrollo local (opcional, para programadores)
```bash
npm install
npx supabase start          # Supabase en Docker con las migraciones
cp .env.example .env.local  # pegar URL y claves que imprime `supabase start`
npm run dev
```
`npm run db:types` regenera los tipos TypeScript y `npm run db:instalar` regenera `supabase/instalar.sql`.

## Pruebas

```bash
npm test              # unitarias: fórmulas de entregas FIJO/VARIABLE, IVA, reparto de pagos, saldos, nómina, formatos
npm run test:sql      # migraciones + flujo factura → inventario → cuenta por cobrar en Postgres (requiere PGHOST/PGPORT/PGUSER)
npm run test:e2e      # Playwright en PC y teléfono (Supabase local + admin admin@tierrasanta.test / Clave2026)
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
  instalar.sql           # todas las migraciones juntas, para pegar en el SQL Editor
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
    auth/ configuracion/ usuarios/ auditoria/ catalogos/ proveedores/ clientes/
  lib/
    supabase/            # clientes (servidor, navegador, admin), proxy de sesión, tipos generados
    auth/                # roles/permisos, sesión, reglas de acceso
    calculos/            # fórmulas puras (espejo de la BD) para vistas previas y pruebas
    dinero.ts fechas.ts  # decimal.js, formato es-VE, zona America/Caracas
  proxy.ts               # refresco de sesión y protección de rutas (antes "middleware")
scripts/                 # generar-instalar, probar-sql (y en la Fase 9: migrar)
tests/unit  tests/e2e
```

## Migración desde Google Sheets

Se entrega en la Fase 9 (`scripts/migrar`, con modo simulación y reporte de verificación de saldos).
