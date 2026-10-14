# HANDOFF · Sistema de gestión "Procesadora de Alimentos Tierra Santa"

> Documento para continuar el proyecto en otra sesión **sin perder nada**.
> Léelo completo antes de tocar código. Mantenlo actualizado al final de cada fase
> (sección "Estado actual" y "Bitácora de sesiones").
> Última actualización: **2026-10-14 · fin de Fase 5 (Facturación)**.

---

## 1. Quién es el usuario y cómo trabajar con él

- **Samer** (dueño). Escribe en español, a veces en MAYÚSCULAS. Todo (UI, mensajes, commits, documentación) va **en español**.
- No es programador. **No usa terminal ni Docker**: usa **Supabase web** (SQL Editor) y **Vercel** (variables de entorno). Nunca le pidas correr comandos.
- Cuando una fase agrega SQL, entrégale **el enlace raw de GitHub** del archivo de migración nuevo para pegarlo en Supabase → SQL Editor → New query → Run. Formato:
  `https://raw.githubusercontent.com/samerbilalsangronis-netizen/TIERRA-SANTA-/claude/tender-curie-r25soh/supabase/migrations/<archivo>.sql`
  (también se le puede enviar el archivo adjunto). Él pide "el enlace del SQL".
- La app se usa en **PC y teléfono** (lo recalcó). Todo debe verse y probarse en ambos.
- Le gusta lo **simple y limpio**: rechazó pantallas "cargadas" y conceptos confusos (ej. "saldo a favor"). Ante la duda, menos texto y menos números en pantalla.
- Trabaja por fases; al terminar cada una: resumen corto de qué hay, **qué SQL pegar**, qué probar, y preguntar si sigue.
- Revisa en su web real y manda capturas. Responder corrigiendo rápido.

## 2. Infraestructura (producción)

| Cosa | Valor |
|---|---|
| Repo GitHub | `samerbilalsangronis-netizen/TIERRA-SANTA-` |
| Rama de trabajo | Fases 1–4: **`claude/tender-curie-r25soh`** (Vercel la despliega como Production Branch). La Fase 5 se hizo en **`claude/blissful-pascal-tyz36p`** (parte del mismo commit final de la 4). Para verla en producción, Samer debe cambiar la Production Branch en Vercel a la rama nueva, o hay que unir las ramas. Cada sesión nueva trabaja en la rama que le asignen: verificar cuál despliega Vercel. No abrir PR salvo que lo pida. |
| Vercel | `https://tierra-santa-lime.vercel.app` |
| Supabase | proyecto `jvhrxawfjxncthdqpkmf` → `https://jvhrxawfjxncthdqpkmf.supabase.co` |
| Clave pública (anon, no secreta) | empieza `eyJhbGciOiJIUzI1NiIs…` (está en el historial; sirve para verificar desde fuera con `curl` que una función existe: si responde `permission denied` existe, si responde `PGRST202` no) |
| Variables en Vercel | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (esta última solo servidor: crear usuarios y cambiar claves) |
| Usuario admin real | `controlexpulpadora…` (correo de Samer; el primero creado en Supabase → quedó admin automáticamente) |

### Migraciones aplicadas en Supabase producción (verificado 2026-10-14)
Todas, en orden:
```
20261014000100_base.sql … 20261014001100_datos_iniciales.sql   (vía supabase/instalar.sql)
20261015000100_proveedores_fase3.sql
20261016000100_compras_kilo_unidad_insumos.sql
20261017000100_clientes_fase4.sql
20261018000100_pagos_se_aplican_solos.sql
20261019000100_facturacion_fase5.sql        ← Fase 5: PENDIENTE de que Samer la pegue
```
**Regla:** nunca editar una migración ya aplicada en producción; crear una nueva con fecha posterior (`2026MMDD000100_descripcion.sql`). Después de agregar una, correr `scripts/generar-instalar.sh` (regenera `supabase/instalar.sql` para instalaciones nuevas) y verificar que aplica limpio **en una sola transacción** (el SQL Editor de Supabase corre todo como una transacción: por eso no se usa `ALTER TYPE … ADD VALUE` seguido de uso del valor; se prefirió `text` + `check`).

## 3. Stack y particularidades (¡leer!)

- **Next.js 16.4 (App Router, Turbopack)** + React 19.3 + TypeScript estricto. Leer `AGENTS.md`: hay cambios respecto a versiones anteriores; docs en `node_modules/next/dist/docs/`.
  - `src/proxy.ts` (antes "middleware") refresca la sesión y protege rutas.
  - `cacheComponents` **desactivado** (todo dinámico por sesión).
  - Tipos de rutas generados: tras crear rutas nuevas correr `npx next typegen` antes de `tsc` (si no, `PageProps<"/ruta">` falla).
  - `next build` **también type-checkea `tests/`** (por eso `selectOption({label: RegExp})` rompe el build; usar el helper `elegirOpcion`).
- **Tailwind 4 + shadcn/ui estilo `base-nova` (Base UI, no Radix)**: los triggers usan `render={<Button/>}` en vez de `asChild`. `cn` viene del paquete `cn` (de shadcn). En formularios se usan `<select>` nativos (`SelectNativo`/`CampoSelect`) por usabilidad en teléfono.
- **Supabase**: `@supabase/ssr` (server/browser), `getClaims()` para la sesión. Cliente admin (service role) solo en `src/lib/supabase/admin.ts` (server-only).
- **Zod 4** (`z.email()`, `z.uuid()`), react-hook-form + `@hookform/resolvers`, **decimal.js** para dinero (nunca float), `xlsx` para Excel, `lucide-react`, `sonner` (toasts), `next-themes` (oscuro por defecto).
- Instalados y **aún sin usar**: `@tanstack/react-table` (v9), `recharts`, `@react-pdf/renderer` → para Fases 5 y 8.
- Formatos: `src/lib/dinero.ts` (`formatearMonto(v,"USD")` → `USD $ 1.250,00`, COP sin decimales, `parsearMonto` acepta "4.000", "12,5", "1.250,50"), `src/lib/fechas.ts` (zona `America/Caracas`, `dd/MM/yyyy`).

## 4. Estructura

```
supabase/migrations/   SQL versionado (ver §2)      supabase/instalar.sql  todo junto para instalación nueva
supabase/tests/        shim_supabase.sql (auth/storage falsos) + flujo_factura.sql (prueba E2E en SQL)
scripts/               generar-instalar.sh · probar-sql.sh
src/app/page.tsx       inicio: logo grande + login (correo y contraseña)
src/app/(app)/         zona privada: dashboard, facturacion*, clientes, proveedores, inventario*, nomina*, reportes*, configuracion
src/features/<modulo>/ acciones.ts (Server Actions, validan con Zod y exigirPerfil), esquemas.ts, componentes
src/components/comunes/ campos, dialogo-formulario (pie fijo + resumenPie), use-formulario, hoja (documento imprimible), kpi, paginación…
src/lib/               supabase/, auth/ (roles, permisos, sesión), calculos/ (fórmulas puras = espejo de la BD), dinero, fechas, facturas
tests/unit  tests/e2e (Playwright: proyectos "pc" y "telefono")
README.md  DECISIONES.md (todas las decisiones/supuestos, mantener al día)  HANDOFF.md (este)
```
(*) módulos aún "Disponible en la Fase N".

Patrones a respetar:
- Cada Server Action: `await exigirPerfil("<permiso>")` → `esquema.safeParse` → Supabase con sesión del usuario → `revalidatePath` → `Resultado` (`exito/fallo`, `mensajeErrorBD`).
- Operaciones multi-tabla = **funciones Postgres `security definer`** que verifican rol con `exigir_rol(...)`. Las tablas sensibles (facturas, pagos, movimientos) **no** se escriben directo (RLS sin políticas de escritura).
- Listas: tabla en PC + tarjetas en teléfono; búsqueda/filtros del lado del servidor vía `searchParams` y RPC; agrupación A–Z con índice lateral.
- Documentos imprimibles: `Hoja` + `EncabezadoHoja` (logo negro), botón "Imprimir / PDF" (`window.print`), Excel por route handler `…/excel/route.ts`.

## 5. Base de datos (resumen funcional)

- **Auth/perfiles:** login solo **correo + contraseña**. Sin suscripción/vencimiento (Samer lo quitó). Estados ACTIVO/BLOQUEADO/INACTIVO. El **primer usuario** creado queda admin; los demás nacen INACTIVOS y el panel de Usuarios (service role) les da rol y los activa. Roles: admin, facturacion, operador, solo_lectura (matriz en DECISIONES.md y `src/lib/auth/roles.ts`). Auditoría en `audit_log` (trigger genérico + acciones de negocio).
- **Catálogos:** productos (código numérico único = el que se teclea al facturar; `categoria` fruta/insumo; `modo_pesaje` = modo de compra por defecto KG/UNIDAD/FIJO(cesta)/VARIABLE(legado); `tipo` materia_prima/terminado/ambos; stock_minimo), unidades, ubicaciones (una predeterminada), monedas (USD, COP, VES inactiva) + tasas de cambio informativas, métodos de pago, tareas de nómina (precios de las capturas de Samer).
- **Proveedores:** tipo fruta/insumos/ambos. Entregas con modo **Por kilo** (kg × precio/kg − merma), **Por unidad** (piñas; "unidades dañadas"), **Por cesta**, VARIABLE solo legado. **Las entregas NO suman inventario** (decisión de Samer: la fruta se procesa antes; el inventario crece solo con entradas de producción). Abonos, cestas, foto (bucket privado `entregas`), estado de cuenta (`estado_cuenta_proveedor`), `buscar_proveedores`.
- **Clientes/facturas/pagos:** `facturas` (origen sistema/externa, estado borrador/emitida/anulada, `saldo` y `estado_pago` generados), `factura_lineas`, `factura_versiones`, `pagos_clientes` (+tipo conversion), `pago_aplicaciones`, `empaques_clientes`.
  - **Regla vigente de pagos (pedido de Samer):** todo dinero no aplicado se aplica **solo** a facturas pendientes de esa moneda (más vieja primero) mediante `aplicar_credito_cliente(cliente)`, llamado por envoltorios de `registrar_pago_cliente`, `editar_pago_cliente`, `eliminar_pago_cliente`, `emitir_factura`, `editar_factura`, `anular_factura`, `registrar_factura_externa`, `editar_factura_externa` (las originales quedaron como `_…_base`, sin permiso directo). En pantalla no se dice "saldo a favor": "Debe" / "Pagó de más (se descuenta de la próxima factura)".
  - Funciones de facturación ya hechas y probadas: `guardar_borrador_factura`, `emitir_factura` (consecutivo sin huecos, inventario, empaques y abono inicial opcionales), `editar_factura` (mismo número, ajusta inventario por diferencia, versiones, cambio de moneda con tasa o bloqueo según config, exceso pagado liberado), `anular_factura`, `ultimo_precio`. IVA = round(base × %/100, 2).
  - `estado_cuenta_cliente`, `buscar_clientes`, `antiguedad_cxc`, `kpis_clientes`, vistas `v_resumen_clientes`, `v_saldos_clientes_moneda`.
- **Inventario (BD lista, UI pendiente):** `movimientos_inventario` (libro mayor) + `existencias` por trigger, lotes FIFO opcionales, `registrar_produccion`, `trasladar_inventario`, `ajustar_inventario` (admin), `registrar_merma_inventario`, `kardex`, vistas `v_stock`, `v_stock_total`. Columna `forma` MP/PT existe; hoy todo es PT.
- **Nómina (BD lista, UI pendiente):** empleados (fijo con `tarifa_dia` / destajo), `tareas_nomina`, `jornadas` (estado asistio/media/produccion/no, justificada, `pago_adicional`, total_tareas, ganado generado), `jornada_tareas` (precio copiado), `abonos_empleados` (adelanto/liquidacion), `periodos_nomina` + `cerrar_periodo_nomina` / `reabrir_periodo_nomina`, `guardar_jornada(p jsonb)`, vista `v_resumen_empleados`. Solo admin.
- **Storage:** buckets `empresa` (público, logo), `entregas` y `facturas` (privados, URLs firmadas).

## 6. Estado actual

| Fase | Estado | Notas |
|---|---|---|
| Esquema BD completo | ✅ | |
| 1 Base (login con logo, roles, usuarios, auditoría, empresa, tema) | ✅ | Logo oficial (alas + TS) blanco/negro en `public/` |
| 2 Catálogos + respaldo Excel | ✅ | |
| 3 Proveedores (kilo/unidad/cesta, insumos, foto, estado de cuenta) | ✅ | |
| 4 Clientes (pagos por factura, pago múltiple, recibos, cajas, estado de cuenta, antigüedad) | ✅ | Último ajuste: pagos se aplican solos + formulario simple de abono. |
| 5 Facturación | ✅ | Emisión por teclado, borradores, editar con historial, duplicar, anular, PDF carta, listado con filtros y totales. Falta que Samer pegue la migración 20261019 y revise en su web. |
| 6 Inventario (UI) | ⏳ | |
| 7 Nómina (UI) | ⏳ | |
| 8 Dashboard, métricas y reportes | ⏳ | |
| 9 Migración de registros de los programas anteriores (Google Sheets **y programa de facturación de Windows**) | ⏳ | Pedido explícito de Samer (2026-10-14): incluir los registros antiguos. Ver §7. |
| 10 Pulido, rendimiento, accesibilidad, README Vercel | ⏳ | |

### Pendientes pequeños detectados
- ~~Endurecer permisos de funciones~~ hecho en 20261019 (anon solo ejecuta `empresa_publica`).
- Productos: Samer debe revisar kg por cesta reales; las frutas quedaron "Por kilo" y la piña "Por unidad".
- Inventario de insumos: **NO** se quiere (confirmado).
- Fechas `<input type=date>` se muestran según el idioma del navegador (en su Chrome sale dd/mm/aaaa: OK).

## 7. Lo que falta, con los requisitos originales (para no olvidar nada)

### Fase 5 · Facturación — ✅ HECHA
Rutas: `/facturacion` (listado, `buscar_facturas`/`totales_facturas`), `/facturacion/nueva` (`?cliente=`, `?duplicar=`), `/facturacion/[id]` (hoja HTML + pagos + historial), `/facturacion/[id]/editar` (también continúa borradores), `/facturacion/[id]/pdf` (`?descargar=1`). Código en `src/features/facturacion/`. Monto en letras: `src/lib/numeros-a-letras.ts`. Pendiente menor: no hay pantalla para elegir el producto con el ratón en una lista grande (se escribe código o nombre).

### Fase 6 · Inventario
Movimientos (libro mayor), **producción diaria** (formulario rápido de varios productos con fecha y responsable; sin consumo de materia prima porque las entregas no entran a inventario), salidas por factura (automáticas), traslados entre ubicaciones, merma/daño, ajustes por conteo (solo admin, con motivo), stock por producto y ubicación con indicador normal/bajo/agotado y alertas en dashboard, **kardex** filtrable y exportable, producción diaria/semanal, lotes FIFO activables. Búsqueda, filtros, agrupación por tipo/ubicación/letra.

### Fase 7 · Nómina (según capturas de Samer)
- Lista de empleados a la izquierda (Personal / Tareas), ficha con pestañas **Calendario · Panel · Abonos · Reporte**; botones Abonar, Editar, Eliminar.
- **Calendario mensual** (Ant./Sig.) con lo ganado cada día; tocar un día abre "Jornada: dd de mes yyyy":
  - **Destajo:** Asistió / No asistió, Justificada, lista de **todas las tareas** con su precio por unidad, campo de cantidad y subtotal por tarea, "**Pago adicional por día (COP)**", "Ganado hoy".
  - **Fijo:** Asistió / Media jornada / No asistió, Justificada, "Ganado hoy" calculado con la tarifa diaria de la ficha (completa / mitad / 0).
- Registro rápido de asistencia diaria (pantalla con todos los empleados, botones grandes para celular).
- Abonos/adelantos (monto COP, entregado por, nota). Saldo neto = ganado − abonos.
- Periodos (semanal por defecto, configurable): cierre que congela, descuenta abonos, recibo por empleado imprimible y resumen. Historial, filtros, exportación. **Solo admin ve montos.**

### Fase 8 · Dashboard, métricas y reportes
Selector de periodo (hoy, semana, semana pasada, mes, mes pasado, rango) con comparación al periodo anterior. Ventas por moneda, nº facturas, ticket promedio, producto más vendido (cantidad y monto), top 5 productos, top 10 clientes, ventas por día (líneas), por producto (barras), por cliente; CxC y clientes críticos; CxP a proveedores por moneda; compras por rubro/proveedor (kg y monto), merma total y % por proveedor; producción del periodo y stock con alertas; cajas/cestas pendientes; nómina del periodo (solo admin). Reportes con rango, filtros, pantalla, PDF y Excel: ventas (periodo/cliente/producto), libro de facturas (con anuladas), estados de cuenta, antigüedad CxC, compras por proveedor/rubro con merma, kardex e inventario valorizado opcional, producción diaria, nómina por periodo/empleado, movimiento de cajas/cestas. **Todas las agregaciones en Postgres (RPC/vistas).** Recharts (cargar skill `dataviz` antes de hacer gráficas).

### Fase 9 · Migración de los registros de los programas anteriores (`scripts/migrar` y/o pantalla en la app)
**Samer pidió explícitamente (2026-10-14) que se migren los registros de los programas antiguos.** Son dos fuentes:

**A) Programa de facturación de Windows** (el que reemplaza la Fase 5). Aún NO sabemos qué programa es ni en qué formato exporta: **preguntarle** el nombre del programa y pedirle una exportación de ejemplo (Excel/CSV, copia de la base de datos o PDFs). Plan:
- Clientes del programa (código, razón social, cédula/RIF, teléfono, dirección) → `clientes`, conservando su **número/código** cuando sea posible y fusionando con los de ERP Clientes por nombre normalizado o cédula (lista para confirmar).
- Facturas viejas con sus **líneas** (código de producto, cantidad, precio, IVA) → facturas históricas que **conserven su número original** y sus líneas, **sin tocar inventario** (hará falta una variante de `registrar_factura_externa` que acepte líneas, o `origen = 'externa'` con `factura_lineas`). Productos por código (1 = Guanábana…).
- Anuladas como anuladas. Saldos/pagos: decidir con Samer si los cobros viven en ERP Clientes (Sheets) o en el programa de Windows, para **no contarlos dos veces**.
- Configurar `empresa.factura_numero_inicial` = último número del programa de Windows + 1, para que la numeración continúe sin saltos ni choques.

**B) Google Sheets (Apps Script)** — lee los .xlsx exportados, modo **simulación** que solo reporta. Estructura:
- **ERP Clientes:** "Panel de Control" desde fila 9 (nombre real en columna H oculta). Una hoja por cliente, datos desde fila 10: facturas B–F (nº, fecha, URL, tipo USD/COP, monto) → facturas `externa`; abonos I–K (fecha, monto, tipo) → pagos (se aplican solos); empaques N–P (fecha, retiradas, devueltas). Hoja "Usuarios" (crear cuentas nuevas; contraseñas viejas no se migran; forzar cambio).
- **ERP Proveedores (COP) y ERP Proveedores USD:** "Panel de Control" / "Panel de Control USD" (nombre en columna E oculta), "Configuración"/"Configuración USD" (rubros B5:D19: nombre, kg, FIJO/VARIABLE). Una hoja por proveedor, datos desde fila 10: entregas B fecha, C rubro, E cestas, F kg total si VARIABLE, G precio, I merma, J URL foto (→ modo FIJO o VARIABLE legado); abonos P fecha, Q monto; cestas T fecha, U entregadas, V devueltas. La moneda sale del archivo. Ignorar hojas `_PLANTILLA_*`. Proveedores en ambos archivos se fusionan por nombre normalizado (mostrar lista para confirmar).
- **Nómina:** EMPLEADOS (id, nombre, tipo, tarifa, registro), TAREAS (id, emoji, tarea, valor, unidad), ASISTENCIA (clave, id empleado, nombre, fecha, estado, justificado, ganado, detalle tareas JSON — normalizar `__dia__`/`_dia_` a `PAGO_DIA` → `pago_adicional`), ABONOS (id, id empleado, empleado, fecha, monto, entregado por, nota). Datos desde fila 4.
- Reporte final de verificación: saldos por cliente/proveedor/empleado viejo vs nuevo (deben coincidir).
- Como Samer no usa terminal: hacer la migración como **pantalla en la app** (Configuración → Migración: subir archivos, simular, ver reporte, confirmar) además del script. Consultar con él.
- Orden sugerido: catálogos → clientes/proveedores/empleados → facturas (Windows + históricas de Sheets sin duplicar) → pagos → entregas/abonos/cestas → nómina → reporte de verificación.

### Fase 10 · Pulido
Rendimiento (<1 s con miles de registros; índices/pg_trgm ya están), pruebas, accesibilidad, README de despliegue, revisar todo en teléfono.

## 8. Cómo probar en la sesión (contenedor en la nube)

El contenedor se recicla entre turnos: Postgres/Supabase locales **se caen** y hay que volver a levantarlos.
```bash
# Postgres "pelado" para la prueba SQL (rápido)
mkdir -p /var/tmp/pgts && chown postgres /var/tmp/pgts
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/tmp/pgts/data -U postgres --auth=trust"   # solo la 1ª vez
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgts/data -o '-p 54329 -k /var/tmp/pgts' -l /var/tmp/pgts/log start"
PGHOST=/var/tmp/pgts PGPORT=54329 PGUSER=postgres scripts/probar-sql.sh      # → TODAS LAS PRUEBAS PASARON

# Supabase local completo (Docker) para la app y Playwright
(setsid dockerd > /var/tmp/dockerd.log 2>&1 &); sleep 8
npx supabase stop --no-backup; npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,mailpit,postgres-meta
# .env.local apunta a http://127.0.0.1:54321 con las claves demo locales (no está en git; recrearlo con lo que imprime `supabase start`)
# primer usuario (queda admin): admin@tierrasanta.test / Clave2026
curl -X POST http://127.0.0.1:54321/auth/v1/admin/users -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  -d '{"email":"admin@tierrasanta.test","password":"Clave2026","email_confirm":true,"user_metadata":{"nombre":"Samer"}}'
npx supabase gen types typescript --local --schema public > src/lib/supabase/database.types.ts && npx oxfmt src/lib/supabase/database.types.ts
#   ¡ojo! si Supabase está caído, ese comando escribe un error dentro del archivo: revisar y `git checkout` el archivo.

npx tsc --noEmit && npx eslint src tests && npx vitest run
npx next build && npx next start -p 3000      # arrancar con setsid; matar con: ps -eo pid,args | grep next-server
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test     # 17 pruebas (pc + telefono)
```
Notas: no correr `pkill -f "next start"` (mata la propia shell). Las pruebas E2E crean datos con sufijos aleatorios y son repetibles. Para capturas de pantalla, script de Playwright con `executablePath: "/opt/pw-browsers/chromium"`, y mirar la imagen.

**Antes de entregar cada fase:** tsc + eslint + vitest + prueba SQL + build + Playwright completo (19 pruebas) + capturas PC y teléfono + regenerar `instalar.sql` + actualizar README/DECISIONES/HANDOFF + commit en español con las líneas de atribución + push a la rama asignada + darle a Samer el enlace raw del SQL nuevo (con el nombre de esa rama en la URL).

## 9. Bitácora de sesiones

| Fecha | Qué se hizo |
|---|---|
| 2026-10-14 (2ª sesión) | Fase 5 Facturación completa + permisos de funciones endurecidos (migración 20261019). Samer pidió incluir en su momento la migración de los registros de los programas antiguos (Windows + Sheets): anotado en §7 Fase 9. |
| 2026-10-14 | Esquema completo; Fases 1–4; logo oficial; login por correo (sin vencimiento); instalación vía Supabase web; entregas por kilo/unidad/cesta e insumos (sin inventario de insumos); entregas no suman inventario; pagos de clientes se aplican solos + formulario simple de abono (caso Carlos fact. 1515: abono 87.877 quedó suelto y se corrigió con la migración 20261018). |
