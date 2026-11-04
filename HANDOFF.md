# HANDOFF · Sistema de gestión "Procesadora de Alimentos Tierra Santa"

> **Documento maestro del proyecto.** Lo lee cualquier agente o programador que llegue
> (Claude Code, Codex u otro) **antes de tocar nada**. Explica qué es el sistema, cómo
> funciona por dentro, cómo se despliega, cómo se cambia la base de datos, cómo se prueba
> y **por dónde quedamos**.
>
> - Complementos: [`DECISIONES.md`](DECISIONES.md) (reglas de negocio y el porqué de cada
>   decisión, módulo por módulo) y [`README.md`](README.md) (instalación desde cero).
> - **Mantenerlo al día:** al terminar cualquier trabajo, actualizar §1 "Por dónde quedamos",
>   la lista de migraciones (§6) y la bitácora (§15).
>
> Última actualización: **2026-11-03**.

---

## 0. Reglas para el agente que llega (leer primero)

1. **Idioma: todo en español.** Interfaz, mensajes, nombres de funciones y variables,
   comentarios, commits y documentación. El código ya está escrito así: `guardarGasto`,
   `cargarStock`, `formatearMonto`. Mantener ese estilo.
2. **El usuario es Samer** (dueño de la empresa). No es programador:
   - **No usa terminal, Docker ni Node.** Nunca le pidas correr comandos.
   - Usa solo **Supabase web** (SQL Editor) y **Vercel** (panel web).
   - Escribe a veces en MAYÚSCULAS. No significa enojo.
3. **Next.js 16: no es el Next.js que conoces.** Leer `AGENTS.md` y las guías en
   `node_modules/next/dist/docs/` antes de escribir código de rutas, proxy o metadata (§4).
4. **Nunca editar una migración ya aplicada en producción.** Siempre crear una nueva
   (§6). Samer las pega a mano en Supabase: si cambias una vieja, su base no se entera.
5. **La rama `claude/tender-curie-r25soh` es producción.** Vercel publica cada push ahí en
   unos 2 minutos (§3).
6. **Datos reales nunca al repositorio.** Exportaciones, SQL de importación con nombres o
   montos, `.env.local`: nada de eso se sube. El `.gitignore` ya excluye `.env*` salvo
   `.env.example`.
7. **Probar en PC y teléfono.** Samer usa ambos y lo pidió expresamente. Cada pantalla
   tiene versión tabla (PC) y versión tarjetas (teléfono).
8. **Simple y limpio.** Samer rechaza las pantallas cargadas y los conceptos confusos.
   - Ejemplo: no dice "saldo a favor"; dice "Debe" o "Pagó de más".
   - Ante la duda: menos texto, menos números y un solo camino para hacer cada cosa.
9. **Al entregar un cambio** dile a Samer:
   - qué cambió y dónde lo ve en la app;
   - **qué SQL tiene que pegar**, si lo hay, con el enlace (§6);
   - qué debe probar.

   Respuestas cortas y en español sencillo.
10. **Commits:** mensaje en español que explique el porqué. No incluir nombres de modelos
    de IA en commits ni en código.

---

## 1. Por dónde quedamos (estado al 2026-11-03)

**El sistema está completo y en uso real en producción.** Samer factura, registra proveedores,
nómina y gastos todos los días.

### Hecho y funcionando
- Todos los módulos: facturación, clientes, proveedores, inventario, nómina, gastos,
  dashboard, reportes, catálogos, usuarios y auditoría (§7).
- Migración del historial de **proveedores** desde Google Sheets, en COP y en USD.
  Ya está importado en producción y cuadrado con las hojas (§9).
- Next.js actualizado a 16.4.3 por un aviso de seguridad.
- `robots.txt` y `noindex`: el sistema no aparece en buscadores.

### Decisiones recientes de Samer (no revertir)
- **ERP Clientes y Nómina de Google Sheets NO se migran.** Samer carga sus clientes y
  facturas a mano, a su manera. No retomar la lectura de imágenes de postimages salvo
  que lo pida.
- **Sin fotos:** Samer casi no sube imágenes. No hace falta comprimirlas.
- Se queda en los **planes gratis** de Supabase y Vercel por ahora. Se le recomendó:
  - bajar el **respaldo en Excel cada semana** (Configuración → Descargar respaldo), porque
    el plan gratis de Supabase no tiene copias automáticas;
  - pasar a Supabase Pro y Vercel Pro cuando el negocio lo justifique.
- **Inventario:** las facturas todavía **no descuentan stock**. Samer está esperando hacer el
  conteo general. Cuando lo haga:
  1. registra lo contado con **Ajuste**;
  2. pulsa **"Empezar a descontar al facturar"** en Inventario.

### Último cambio (2026-11-04)
- **Nómina sin periodos**, con "Pagar", "Adelanto", "Pagar a los fijos", panel y reporte
  **desde el último pago** (§7.7). Solo cambió la interfaz: **no hubo migración ni se tocaron
  registros**. Samer lo pidió expresamente: "no borres los registros que llevo".

### Por confirmar con Samer
- Si ya pegó la migración **`20261030000100_gastos.sql`**. Sin ella, la pantalla Gastos y la
  tarjeta Gastos del Dashboard dan error. Para verificar, pídele que corra
  `supabase/utilidades/revisar_migraciones.sql` (§6).
- Dominio propio: le interesa a futuro. Ya se le explicaron los pasos (§3), pero todavía no
  lo compró.

### No hay ninguna tarea a medias
Lo siguiente lo decide Samer: suele mandar capturas de pantalla o notas de voz con pedidos
puntuales. Ideas anotadas en §14.

---

## 2. El negocio

**Procesadora de Alimentos Tierra Santa C.A.** (La Grita, Táchira, Venezuela) procesa
fruta y vende **pulpa congelada en bolsas de 800 g y de 1 kg**.

**Ciclo del negocio:**
1. **Proveedores** (campesinos) traen fruta: mora, fresa, guanábana, parchita, durazno,
   piña, mango, tomate de árbol, guayaba, lulo…
   - Se les paga por kilo, por cesta o por unidad (la piña).
   - Se les debe y se les abona por partes, en **pesos colombianos (COP)** o en
     **dólares (USD)**.
   - Las cestas se prestan y se devuelven.
2. La planta despulpa y empaca. Eso es la **producción diaria**, en bolsas.
3. Se **factura** a clientes (comercios) en USD o COP. Los clientes pagan por partes y se
   llevan **cajas** prestadas.
4. **Nómina:**
   - personal **fijo**, que cobra por día;
   - personal **por destajo**, que cobra por tarea (por ejemplo, $5.000 por cesta de fresa
     espicada).
5. **Gastos** del día a día: guantes, tapabocas, aditivos (benzoato, dióxido,
   metabisulfito), café, gasolina…

**Antes del sistema** usaban:
- **"ERP Clientes"**, **"ERP Proveedores" (COP)**, **"ERP Proveedores USD"** y **"Nómina"**,
  todos en Google Sheets con Apps Script;
- un **programa de facturación de Windows** que solo generaba la factura (la imagen se subía
  a postimages y se anotaba en ERP Clientes).

---

## 3. Infraestructura, despliegue y ramas

| Cosa | Valor |
|---|---|
| Repositorio | GitHub `samerbilalsangronis-netizen/TIERRA-SANTA-` |
| **Rama de producción** | **`claude/tender-curie-r25soh`** (es la rama por defecto y la que publica Vercel) |
| Otra rama | `claude/blissful-pascal-tyz36p` (la usaban las sesiones de Claude; hoy está **idéntica** a producción) |
| Producción | https://tierra-santa-lime.vercel.app (Vercel, plan gratis "Hobby") |
| Base de datos | Supabase, proyecto `jvhrxawfjxncthdqpkmf` (plan gratis) |
| Variables en Vercel | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) y `SUPABASE_SERVICE_ROLE_KEY`. Esta última **solo se usa en el servidor**, en `src/lib/supabase/admin.ts`, para crear usuarios y cambiar contraseñas. |
| Usuario admin real | el correo de Samer (`controlexpulpadora…`), que fue el primer usuario creado |

**Cómo se trabajaba hasta ahora:** se desarrolla y prueba en un contenedor local, se hace
commit y se hace **push a las dos ramas** (`git push origin HEAD:claude/tender-curie-r25soh`
y `HEAD:claude/blissful-pascal-tyz36p`). Vercel compila y publica solo.

**Recomendación para Codex u otros:**
- Trabajar en una rama propia y unir a `claude/tender-curie-r25soh` solo lo probado. Un push
  roto a esa rama deja a Samer sin sistema hasta que se arregle; Vercel mantiene la versión
  anterior si el build falla, pero un error en tiempo de ejecución sí llega a producción.
- Si se sigue usando `claude/blissful-pascal-tyz36p`, mantenerla igual a producción.

**Planes gratis:**
- **Supabase:** 500 MB de base, 1 GB de archivos y sin respaldos automáticos. Se pausa tras
  7 días sin uso, cosa que no pasa porque lo usan a diario.
- **Vercel Hobby:** según sus reglas es para uso no comercial. A Samer se le explicó; no ha
  recibido avisos. Si llegaran, pasar a Pro toma minutos, sin cambiar código.
- Con unas 50 facturas al día, la base crece aproximadamente entre 100 y 150 MB por año.

**Dominio propio (cuando Samer lo compre):**
1. Comprarlo, por ejemplo `tierrasanta.com`, en Cloudflare, Namecheap o Porkbun.
2. En Vercel: **Settings → Domains → Add**, con un subdominio como `sistema.tierrasanta.com`.
3. Copiar en el DNS del registrador el registro que muestra Vercel (normalmente un CNAME a
   `cname.vercel-dns.com`).
4. Marcarlo como principal. La dirección `.vercel.app` redirige sola.
5. En Supabase: **Authentication → URL Configuration → Site URL** = el dominio nuevo.

El código **no depende del dominio** en ningún lugar.

---

## 4. Stack técnico y particularidades

- **Next.js 16.4.3** (App Router, Turbopack), **React 19.3**, **TypeScript estricto**.
  - **`src/proxy.ts`** reemplaza al antiguo `middleware.ts`.
    - Refresca la sesión de Supabase y protege las rutas. Las públicas son `/` y `/auth/*`.
    - Su `matcher` excluye estáticos, imágenes y `robots.txt`. Si agregas un archivo
      público que deba verse sin sesión, agrégalo al `matcher`.
  - **`cacheComponents` desactivado.** Todo es dinámico por sesión.
  - Tipos de rutas generados: `PageProps<"/ruta">` y `RouteContext<"/ruta">`. **Al crear una
    ruta nueva, correr `npx next typegen`** antes de `tsc`, o fallan los tipos.
  - **`next build` también revisa los tipos de `tests/`.**
  - A veces `next build` se detiene la primera vez con un aviso de seguridad
    (`SecurityFatalError`) y pide repetirlo. Repetirlo funciona. Ya se actualizó a 16.4.3;
    si vuelve a salir, puede ser un aviso nuevo.
- **Tailwind CSS 4** + **shadcn/ui estilo "base-nova"**, que usa **Base UI y no Radix**:
  - Los disparadores usan `render={<Button/>}` en vez de `asChild`.
  - `cn` viene del paquete `cn`.
  - En formularios se usan `<select>` **nativos** (`SelectNativo` / `CampoSelect`), porque
    funcionan mejor en el teléfono.
- **Supabase:**
  - `@supabase/ssr`: `src/lib/supabase/server.ts` (con la sesión del usuario) y `client.ts`
    (navegador).
  - `admin.ts`: clave de servicio, **solo servidor**.
  - Los tipos de la base están en `src/lib/supabase/database.types.ts`, generados con
    `npm run db:types`.
- **Zod 4**, **react-hook-form**, **decimal.js** (dinero: nunca `float`), **xlsx** (SheetJS,
  para el Excel), **@react-pdf/renderer** (PDF de la factura), **recharts**,
  **lucide-react**, **sonner** (avisos), **next-themes** (oscuro por defecto).
- **Formatos** en `src/lib/dinero.ts` y `src/lib/fechas.ts`:
  - `formatearMonto(v, "USD")` → `USD $ 1.250,00`. COP se muestra **sin decimales**.
  - `parsearMonto` acepta "4.000", "12,5" y "1.250,50".
  - Zona horaria **`America/Caracas`**: `public.hoy()` en la base, `hoyISO()` en la app.
    Fechas `dd/MM/yyyy`.
- **Colores:** la interfaz es **blanco y negro**, pedido de Samer (nada de morado). El color
  solo se usa en datos y estados: verde, ámbar, rojo y la paleta de gráficos `--viz-*` de
  `globals.css`.

---

## 5. Arquitectura y patrones (respetarlos)

```
src/app/page.tsx              inicio: logo + login (correo y contraseña)
src/app/auth/                 cambiar-clave, salir
src/app/(app)/                zona privada con barra lateral (ver §7)
src/app/robots.ts             no indexar
src/features/<modulo>/        lógica de cada módulo:
    acciones.ts               Server Actions ("use server")
    esquemas.ts               validación Zod (se usa en el navegador y en el servidor)
    datos.ts                  lecturas "server-only" para las páginas
    *.tsx                     componentes del módulo
src/components/ui/            shadcn (Base UI)
src/components/app/           barra lateral, barra superior, navegacion.ts (menú), tema
src/components/comunes/       campos, dialogo-formulario, use-formulario, confirmar-accion,
                              hoja (documento imprimible), tarjeta-kpi, paginación, estado-vacío
src/lib/                      supabase/, auth/ (roles, sesión, acceso), calculos/ (fórmulas
                              puras = espejo de la base de datos), dinero, fechas, periodos,
                              facturas, numeros-a-letras, esquemas-comunes
supabase/migrations/          SQL versionado (§6)
supabase/instalar.sql         todas las migraciones juntas, para una instalación nueva
supabase/tests/               shim_supabase.sql (auth y storage falsos) + flujo_factura.sql
supabase/utilidades/          SQL de mantenimiento que Samer pega a mano (§10)
scripts/                      generar-instalar.sh, probar-sql.sh, levantar-local.sh,
                              migracion/proveedores_desde_excel.py
tests/unit (Vitest) · tests/e2e (Playwright)
```

**Patrones:**
- **Server Action:** `exigirPerfil("<permiso>")` → `esquema.safeParse` → consulta a Supabase
  **con la sesión del usuario** (RLS) → `revalidatePath(...)` → devuelve un `Resultado`
  (`exito(datos, mensaje)` / `fallo(error, campos)` de `src/lib/acciones.ts`;
  `mensajeErrorBD` traduce los errores de Postgres).
- **Operaciones de varias tablas:** funciones Postgres **`security definer`** que verifican el
  rol con `perform public.exigir_rol('admin', ...)`.
  - Las tablas sensibles (facturas, pagos, movimientos de inventario) **no tienen políticas
    de escritura**: solo se escriben a través de funciones.
- **Las cuentas las hace Postgres** (sumas, saldos, reportes): funciones `sql stable
  security invoker` que respetan RLS. En TypeScript solo se arma la tabla.
  - `src/lib/calculos/` repite algunas fórmulas para mostrar vistas previas en vivo (por
    ejemplo, el total de una entrega). Si cambias una fórmula en la base, **cámbiala también
    ahí y en sus pruebas**.
- **Formularios:** `useFormulario(esquema, valoresIniciales, accion, alGuardar)` +
  `DialogoFormulario` (pie fijo con el botón Guardar y un resumen opcional). Los números se
  escriben como texto y se convierten con `numeroLibre()`.
- **Listas:** tabla en PC (`hidden md:block`) + tarjetas en teléfono (`md:hidden`). Los
  filtros van en la URL (`searchParams`) y se resuelven en el servidor.
- **Documentos imprimibles:**
  - `Hoja` + `EncabezadoHoja` (logo negro y datos de la empresa), con botón
    "Imprimir / PDF" (`window.print`, estilos `print:`).
  - El Excel se genera en un route handler `…/excel/route.ts`.
  - La factura además tiene un PDF del servidor en `/facturacion/[id]/pdf`.
- **Permisos de la interfaz:** `src/lib/auth/roles.ts` (`puede(rol, permiso)`) es el espejo de
  la seguridad de la base. Si agregas un permiso, ajusta **las dos cosas**.
- **Menú:** `src/components/app/navegacion.ts`.

---

## 6. Base de datos: cómo se cambia (¡importante!)

**Samer aplica cada migración a mano:**
1. Le pasas el enlace del archivo en GitHub, en la rama de producción. Por ejemplo:
   `https://github.com/samerbilalsangronis-netizen/TIERRA-SANTA-/blob/claude/tender-curie-r25soh/supabase/migrations/<archivo>.sql`
2. Él pulsa "Copy raw file", lo pega en **Supabase → SQL Editor → New query** y pulsa **Run**.

**Reglas al escribir una migración nueva:**
- Nombre: `supabase/migrations/2026MMDD000100_descripcion.sql`, con fecha posterior a la
  última.
- **Nunca editar una ya aplicada.** Si te equivocas, haz otra que corrija.
- **El SQL Editor de Supabase confirma cada sentencia por separado:**
  - una tabla temporal `on commit drop` desaparece antes de la siguiente sentencia;
  - lo que deba ser todo-o-nada va en **un solo bloque `do $$ … $$`**;
  - no usar `ALTER TYPE … ADD VALUE` y luego usar el valor en la misma pegada (se prefirió
    `text` + `check`).
- Al cambiar una función con `create or replace`, copiar su **última** versión (puede haber
  sido redefinida en una migración posterior). Para encontrarla:
  `grep -ln "function public.nombre" supabase/migrations/*`.
- Tabla nueva:
  - `enable row level security` + políticas con `public.es_usuario_activo()`,
    `public.tiene_rol(...)` o `public.es_admin()`;
  - triggers `tg_set_updated_at` y `tg_auditar`;
  - `grant` a `authenticated`.
- Función nueva: `revoke execute … from public, anon` y `grant execute … to authenticated`.
- **Después de agregarla:**
  1. `scripts/generar-instalar.sh`, que regenera `supabase/instalar.sql`.
  2. `npm run db:types`, que regenera los tipos (con Supabase local corriendo; si está caído,
     escribe un error dentro del archivo: revisarlo).
  3. Correr la prueba SQL (§11).
  4. Agregar una fila a `supabase/utilidades/revisar_migraciones.sql`.

**Migraciones (todas en `supabase/migrations/`, en orden):**

| Archivo | Qué hace | En producción |
|---|---|---|
| `20261014000100…001100` (11 archivos) | Esquema base completo: perfiles y roles, catálogos, clientes y facturas, proveedores, inventario, nómina, funciones de facturación, vistas de saldos, RLS, storage, datos iniciales | ✅ (vía `instalar.sql`) |
| `20261015000100_proveedores_fase3` | Proveedores: estado de cuenta, búsqueda | ✅ |
| `20261016000100_compras_kilo_unidad_insumos` | Modos de compra KG / UNIDAD / FIJO / VARIABLE, insumos, `calcular_entrega` | ✅ |
| `20261017000100_clientes_fase4` | Clientes: pagos, recibos, cajas, antigüedad | ✅ |
| `20261018000100_pagos_se_aplican_solos` | El dinero se aplica solo a las facturas pendientes (`aplicar_credito_cliente`) | ✅ |
| `20261019000100_facturacion_fase5` | Búsqueda y totales de facturas, últimos precios, permisos endurecidos | ✅ |
| `20261020000100_inventario_fase6` | Resumen de producción, eliminar producción, merma con motivo | ✅ |
| `20261021000100_presentaciones_800g_1kg` | Cada fruta pasa a ser 3 productos: comprada (901…), 800 g (1…) y 1 kg (101…) | ✅ |
| `20261022000100_pulpa_por_fruta` | `productos.fruta_id` / `peso_kg`, `pulpa_por_fruta()` | ✅ |
| `20261023000100_nomina_fase7` | Bloqueo de cambios en periodos cerrados, `nomina_resumen` | ✅ |
| `20261024000100_dashboard_reportes` | `resumen_periodo`, `ventas_por_*`, `ventas_semanales`, `compras_por_proveedor`, `cajas_cestas` | ✅ |
| `20261025000100_una_sola_ubicacion` | Una sola ubicación activa; el stock pasa a la principal | ✅ |
| `20261026000100_cestas_o_kilos` | Compra por cesta escribiendo cestas **o** kilos (`cestas numeric(12,4)`) | ✅ |
| `20261027000100_fruta_recibida` | Reporte de fruta recibida | ✅ |
| `20261028000100_inventario_desde` | `empresa.inventario_desde` + `activar_control_inventario()` | ✅ |
| `20261029000100_ventas_cliente_producto` | Reporte de ventas a un cliente | ✅ |
| `20261030000100_gastos` | Módulo Gastos (tablas, bucket `gastos`, `gastos_resumen`) | ❓ **confirmar** |

Los ✅ los confirmó Samer el 2026-10-29 con `revisar_migraciones.sql`.

---

## 7. Módulos (qué hace cada uno y dónde está)

Rutas bajo `src/app/(app)/`. Código en `src/features/<módulo>/`.

### 7.1 Inicio de sesión, usuarios, auditoría y empresa
- **Login:**
  - Solo **correo y contraseña** (`/`). No hay registro público ni suscripciones.
  - El **primer usuario** creado en Supabase queda admin. Los demás nacen **INACTIVOS** y el
    admin los activa y les da rol en **Configuración → Usuarios** (usa la clave de servicio).
  - Estados: ACTIVO, BLOQUEADO e INACTIVO. Solo los ACTIVOS entran; `rol_actual()` en la base
    exige ACTIVO.
- **Roles:** `admin`, `facturacion`, `operador` y `solo_lectura`. La matriz completa está en
  `src/lib/auth/roles.ts` y en DECISIONES.md. Puntos clave:
  - **Nómina:** solo admin.
  - **Ajustes de inventario y eliminar producción:** solo admin.
  - **Gastos:** registran admin, facturación y operador; corrigen y borran admin y facturación.
- **Auditoría:**
  - El trigger `tg_auditar` guarda en `audit_log` cada inserción, cambio o borrado.
  - Se ve en **Configuración → Auditoría** (solo admin).
- **Configuración → Empresa** (tabla `empresa`, una sola fila con `id = 1`):
  - razón social, RIF, dirección, logo (bucket `empresa`);
  - título del documento, prefijo y número inicial de factura, IVA %;
  - moneda por defecto;
  - si el stock insuficiente solo avisa o bloquea;
  - qué roles editan facturas;
  - periodicidad de la nómina;
  - `inventario_desde` (§7.5).
- **Configuración → Descargar respaldo:** un Excel con una hoja por tabla
  (`configuracion/respaldo/route.ts`).

### 7.2 Catálogos (Configuración → Catálogos, solo admin)
- **Productos** (`productos`), en 3 pestañas:
  - **"Se vende":** tienen código numérico, que es el que se teclea al facturar.
    - Bolsas de 800 g: códigos 1–9 (1 Guanábana, 2 Parchita, 3 Durazno, 4 Fresa, 5 Mora,
      6 Piña, 7 Mango, 8 Tomate de árbol, 9 Guayaba).
    - Bolsas de 1 kg: códigos 101–109.
    - Samer agregó otros en producción, por ejemplo: 10 Guanábana con Fresa, 12 Tamarindo,
      13 Durazno Molido.
    - Cada producto lleva `fruta_id` (fruta de origen) y `peso_kg` (kg de pulpa por bolsa).
  - **"Fruta de proveedores":** `tipo = 'materia_prima'`, `categoria = 'fruta'`, código
    interno desde 901 que no se muestra.
  - **"Insumos":** `categoria = 'insumo'`, por ejemplo Etiquetas.
  - Campos de compra: `modo_pesaje` = cómo se compra por defecto (KG / UNIDAD / FIJO =
    por cesta) y `kg_por_cesta`.
    - Kg por cesta que usaba Samer: Fresa 14, Mora 15, Parchita 20, y 30 para Guayaba,
      Mango, Tomate de árbol, Durazno y Guanábana en cesta.
- **Otros catálogos:** unidades, ubicaciones (solo una activa), monedas y tasas (USD y COP
  activas; VES inactiva; las tasas son informativas), métodos de pago, tareas de nómina
  (precio por unidad) y **conceptos de gastos**.
- Un registro que ya se usó **no se borra, se desactiva**.

### 7.3 Clientes (`/clientes`)
- **Tablas:** `clientes` (número consecutivo automático), `facturas`, `pagos_clientes`,
  `pago_aplicaciones`, `empaques_clientes` (cajas que se llevan y devuelven).
- **Ficha del cliente:** saldo por moneda, facturas, pagos, cajas, "Pagar completa" y
  "Abonar", pago de varias facturas a la vez, recibo imprimible
  (`/clientes/[id]/recibos/[pagoId]`).
- **Regla de pagos:** el dinero se aplica **solo** a las facturas pendientes de esa moneda,
  de la más vieja a la más nueva (`aplicar_credito_cliente`).
  - Lo llaman envoltorios de `registrar_pago_cliente`, `editar_pago_cliente`,
    `eliminar_pago_cliente`, `emitir_factura`, `editar_factura`, `anular_factura` y
    `registrar_factura_externa` / `editar_factura_externa`.
  - Las funciones originales quedaron como `_…_base`, sin permiso directo.
- **Estado de cuenta** (con Excel) y **antigüedad de saldos** (`/clientes/antiguedad`).
- **Facturas históricas** (`origen = 'externa'`): número libre, monto y soporte (archivo en el
  bucket `facturas` o una URL). No tocan el inventario.

### 7.4 Facturación (`/facturacion`)
- **Pantalla de emisión** (`/facturacion/nueva`), pensada para teclado:
  - Buscar el cliente y pulsar Enter.
  - En cada línea: código → Enter → cantidad → Enter → precio → Enter (línea nueva).
  - **Ctrl+Enter** emite.
  - Sugiere el **último precio** de ese cliente en esa moneda.
  - Admite borradores y "Duplicar" (`?duplicar=`).
- **Funciones en la base:** `emitir_factura` (número consecutivo sin huecos),
  `guardar_borrador_factura`, `editar_factura` (mismo número, historial en
  `factura_versiones`, ajusta el inventario por diferencia), `anular_factura`.
  - IVA = `round(base × % / 100, 2)` sobre la base total.
- **Hoja** (`/facturacion/[id]`) y **PDF** (`/facturacion/[id]/pdf`, `?descargar=1`):
  - logo, datos de la empresa, **monto en letras** (`src/lib/numeros-a-letras.ts`);
  - **marca de agua de frutas** (`src/features/facturacion/frutas.ts`, 7 % de opacidad);
  - **sello de la empresa** (`public/sello-tierra-santa.png`) en lugar de líneas de firma;
  - sello "ANULADA" cuando corresponde.
- **Listado** con búsqueda, filtros y totales por moneda (`buscar_facturas`,
  `totales_facturas`).
- **Inventario:** solo se descuenta si la factura se emitió **después** de
  `empresa.inventario_desde` (§7.5).

### 7.5 Inventario (`/inventario`)
- **Solo producto terminado, en bolsas.** Sube con la **producción**
  (`/inventario/produccion`, una pantalla con todos los productos) y baja con facturas,
  **merma** (con motivo) y **ajustes por conteo** (solo admin).
- Las **entregas de proveedores NO suman** al inventario: la fruta se procesa antes. Es
  decisión de Samer.
- **Cómo se guarda:**
  - `movimientos_inventario` es el libro mayor, y el trigger `tg_movimiento_existencias`
    mantiene `existencias`.
  - Kardex por producto en `/inventario/[id]`, con Excel.
  - Vistas `v_stock` y `v_stock_total`.
- **Control al facturar:**
  - `empresa.inventario_desde` (timestamptz) en `null` significa que **las facturas no
    descuentan**. Así está hoy: Samer factura sin haber hecho el inventario general.
  - El botón **"Empezar a descontar al facturar"** (admin) llama a
    `activar_control_inventario(true)` y guarda `now()`.
  - Las facturas emitidas antes nunca tocan el stock, aunque se editen o anulen después
    (`factura_sincronizar_inventario` compara con `emitida_el`).
  - Mientras está inactivo, la pantalla de factura no muestra "Disponible".
- **Gráfico de dona** "Porcentaje de pulpa por rubro" (`pulpa_por_fruta`): las bolsas se
  convierten a kg por fruta de origen.
- **Ubicaciones:** hay una sola activa y la interfaz las oculta. Si se activan más en
  Catálogos, todo vuelve a aparecer.

### 7.6 Proveedores (`/proveedores`)
- **Tablas:** `proveedores` (tipo fruta, insumos o ambos), `entregas_proveedor`,
  `abonos_proveedor` (recibo numerado) y `cestas_proveedor`.
- **Modos de compra de una entrega** (`calcular_entrega`, la misma fórmula está en
  `src/lib/calculos/entregas.ts`):
  - **KG:** kg × precio por kilo − merma × precio.
  - **UNIDAD:** unidades × precio − dañadas × precio. Se usa para la piña.
  - **FIJO (por cesta):** se escriben **cestas o kilos** y el otro se calcula.
    - total = kg × precio por cesta ÷ kg por cesta.
    - Si solo se cambian las cestas, el trigger recalcula los kilos.
  - **VARIABLE:** "precio total". **Solo** se usa en los datos importados de la hoja vieja.
- **Ficha del proveedor:**
  - saldo por moneda (COP y USD, nunca mezclados);
  - cestas pendientes;
  - tabla de entregas con "Precio por kilo", y "Cestas" solo si alguna entrega fue por cesta;
  - abonos y cestas.
  - El formulario de entrega **no tiene nota ni foto**, por pedido de Samer.
- **Estado de cuenta** (`/proveedores/[id]/estado-cuenta`), con el estilo que pidió Samer:
  - "MOVIMIENTOS DEL PERÍODO";
  - tipo 🚚 Entrega en rojo o 💵 Abono en verde;
  - rubro, kg, cestas, precio por cesta / kg / und, merma;
  - monto con signo ±;
  - **saldo acumulado en naranja**;
  - Excel.
  - En las entregas importadas, el precio por cesta original se toma de la nota
    ("N cestas de X kg × precio").
- Lo que un proveedor de insumos trae **a crédito** va aquí. Lo que se paga en el momento
  va en Gastos.

### 7.7 Nómina (`/nomina`, solo admin, todo en COP) — **sin periodos, por pagos**
Así funciona desde el **2026-11-04**, por pedido de Samer:
- los **fijos** se pagan cada semana, pero algunos dejan acumular;
- a los de **destajo** se les paga cuando toca (a veces cada 15 o 22 días).

Por eso **los periodos se quitaron de la interfaz** y todo gira en torno a **lo que se le debe**
y la **última fecha de pago**.

- **Lo que se le debe** = todo lo ganado − todos los pagos y adelantos (`v_resumen_empleados.saldo_neto`).
  No depende de periodos ni de semanas.
- **Pago vs. adelanto.** Los dos se guardan en `abonos_empleados`, y lo que los distingue es la
  columna `tipo`. **No hubo migración**: esos valores ya existían.
  - **Pago** (`tipo = 'liquidacion'`): botón **"Pagar"** en la ficha. Propone todo lo que se le
    debe; si se paga menos, el resto **queda acumulado**. **Define la "última fecha de pago"**.
  - **Adelanto** (`tipo = 'adelanto'`): botón **"Adelanto"**. Dinero entre pagos; se descuenta de
    lo que se le debe y **no** cambia la última fecha de pago.
  - Los pagos que hizo el cierre de algún periodo viejo (`periodo_id` no nulo) se muestran como
    "Pago de cierre de periodo" y **no** se editan ni borran.
- **Última fecha de pago:** `cargarUltimosPagos()` en `src/features/nomina/datos.ts` toma el
  `tipo = 'liquidacion'` más reciente; si hay dos el mismo día, se suman.
  - **El pago cubre hasta su fecha:** "desde el último pago" significa **desde el día siguiente**
    (`desdePago = fecha + 1`).
- **Pantalla principal:**
  - **Tarjetas:** "Total que se debe" (fijos y destajo por separado), "Pagado esta semana" (pagos
    y adelantos desde el lunes) y "Empleados activos".
  - **Lista** con pestañas **Fijo · Destajo · Tareas**. Cada empleado muestra "Último pago dd/mm/aaaa"
    o "Sin pagos".
  - **"Pagar a los fijos"** (`src/features/nomina/pagar-fijos.tsx`): todos los fijos a los que se
    les debe, marcados, con el monto de lo que se les debe. Se puede desmarcar a alguno o bajar el
    monto (el resto se acumula). Registra un pago por empleado (`pagarVarios`).
- **Ficha del empleado** (`/nomina/[id]`, pestañas Calendario · Panel · Pagos · Reporte):
  - **Encabezado:** "Se le debe", "Último pago" y los botones **Pagar**, **Adelanto**, Editar y
    Eliminar.
  - **Panel:**
    - arriba: se le debe (saldo total), último pago (fecha y monto), **ganado desde el último pago**
      (con los días trabajados) y **adelantos desde el último pago**;
    - abajo, **por mes** (con flechas): **días trabajados** y ganado en el mes. Los **fijos** además
      ven medias jornadas y faltas. Los de **destajo** ven en cambio **cuánto hicieron de cada tarea**
      (por ejemplo "Cortada de Durazno 12 cestas · $120.000"), porque para ellos ir el día completo
      o no da igual: cuenta lo que hicieron.
    - Ya **no** existen "Ganado en el periodo", "Abonos del periodo", "Saldo anterior" ni
      "A pagar al cierre" (Samer los pidió quitar).
  - **Reporte:**
    - **por defecto, desde el día siguiente al último pago hasta hoy** (si nunca se le pagó, desde
      el 1 del mes);
    - botones "Desde el último pago" y "Este mes", o fechas libres;
    - **al pie:** total ganado, adelantos y pagos del rango, "Quedó pendiente de antes" (si un pago
      fue parcial) y **"A pagar hoy"**;
    - se imprime.
  - **Pagos:** la lista de pagos y adelantos, con Editar y Eliminar.
- **Jornadas** (`jornadas` + `jornada_tareas`, con el precio del día copiado), sin cambios:
  - **Fijo:** Asistió (tarifa del día), Media (mitad) o No; más pago adicional. **Sin tareas.**
  - **Destajo:** Asistió o No, con cantidades por tarea y pago adicional.
- **Asistencia del día** (`/nomina/asistencia`): separada en Personal fijo y Por destajo; un toque guarda.
- **Periodos (sistema anterior):** las tablas `periodos_nomina` y `periodo_nomina_items`, las
  funciones `cerrar_periodo_nomina` / `reabrir_periodo_nomina` y las pantallas
  `/nomina/periodos/*` **siguen existiendo pero ya no tienen enlaces** en la interfaz.
  - Si había un periodo cerrado, sus días siguen bloqueados (candado en el calendario).
  - **No borrar** esas tablas: tienen historial.
  - **No volver a enlazar** los periodos sin que Samer lo pida.
- El Dashboard sigue mostrando "Nómina" (ganado y abonos del periodo del dashboard, con `resumen_periodo`).

### 7.8 Gastos (`/gastos`) — el módulo más nuevo
- **Para qué:** lo que se compra y se **paga en el momento**: guantes, tapabocas, café,
  azúcar, aditivos, utensilios, cestas, bolsas, cintas, gasolina…
- **Tablas:**
  - `categorias_gasto`: Aditivos y conservantes, Empaque, Higiene y protección, Utensilios,
    Cafetería, Transporte, Otros.
  - `conceptos_gasto`: nombre, categoría, unidad, activo.
  - `gastos`: fecha, concepto, cantidad, unidad, monto, moneda, método, lugar, quién pagó,
    nota, `foto_path` en el bucket privado `gastos`.
- **Pantalla:**
  - totales del periodo por moneda, número de gastos y categoría mayor;
  - barras por categoría;
  - lista con filtros por periodo, categoría y concepto;
  - Corregir y Eliminar.
- Desde el formulario se puede **agregar un concepto nuevo** sin salir. Los conceptos se
  editan en **Catálogos → Gastos**.
- Reporte "Gastos por categoría" y tarjeta "Gastos" en el Dashboard (`gastos_resumen`).
- **No lleva inventario de insumos**: Samer no lo quiere por ahora.

### 7.9 Dashboard (`/dashboard`)
- **Periodo:** Hoy · Esta semana · Semana pasada · **Este mes** (por defecto) · Mes pasado ·
  Rango. Se compara con el periodo anterior de igual largo.
- **Cifras** (`resumen_periodo`): ventas USD y COP, productos vendidos (bolsas y kg de pulpa),
  producción, facturas, cobrado, **compras a proveedores**, **gastos** y nómina (solo admin).
  - Cuando hay más de una moneda, cada una va en su propia fila
    (`MontosPorMoneda` en `src/features/dashboard/componentes.tsx`).
- **Rendimiento semanal** (últimas 12 semanas, ▲ verde / ▼ rojo), ventas por día, top de
  productos y clientes, y alertas.
- "Compras a proveedores" es **lo comprado en el periodo**, no la deuda. La deuda está en
  Proveedores y en el reporte "Saldos de proveedores". A Samer esto ya le confundió una vez.

### 7.10 Reportes (`/reportes`, `/reportes/[tipo]`, `/reportes/[tipo]/excel`)
- **Definiciones** en `src/features/reportes/definiciones.ts`:
  - objeto `REPORTES` con banderas: `moneda` (selector de moneda), `proveedor` (filtro de un
    proveedor), `periodo` (usa fechas), `eleccion` (fruta y elegir proveedores), `cliente`
    (elegir cliente);
  - `generarReporte()` arma columnas, filas y totales.
- **Columnas:** pueden tener su propia `moneda`. Tipos: texto, fecha, cantidad, monto,
  entero, porcentaje.
- **Los reportes:**
  - **Ventas por producto:** USD y COP juntos; cantidad sumada; un monto por moneda.
  - **Ventas a un cliente:** se elige cliente y periodo; muestra el resumen de facturas y la
    suma por producto (`ventas_cliente_por_producto`). Lo pidió un cliente por nota de voz.
  - **Ventas por cliente** y **Libro de facturas:** por moneda.
  - **Fruta recibida:** kg, merma, kg netos, %, cestas y unidades por fruta; filtro por
    proveedor (`fruta_recibida`).
  - **Saldos de proveedores:** lo que se debe a cada uno en COP y USD. Filtros: "Traen Mora",
    elegir proveedores uno por uno y "Solo a los que se les debe".
  - **Compras por proveedor**, **Gastos por categoría**, **Producción diaria**,
    **Cajas y cestas**.
- **Para agregar un reporte:**
  1. agregar la entrada en `REPORTES` (con todas las banderas);
  2. agregar su rama en `generarReporte`;
  3. si necesita sumas, crear una función SQL nueva (migración);
  4. agregarlo a la lista de la prueba e2e `fase8`.

---

## 8. Modelo de datos (resumen)

**Tablas (35):**
- Usuarios y sistema: `profiles`, `audit_log`, `empresa`, `contadores`.
- Catálogos: `monedas`, `tasas_cambio`, `unidades`, `ubicaciones`, `productos`,
  `metodos_pago`, `tareas_nomina`.
- Clientes y facturación: `clientes`, `facturas`, `factura_lineas`, `factura_versiones`,
  `pagos_clientes`, `pago_aplicaciones`, `empaques_clientes`.
- Proveedores: `proveedores`, `entregas_proveedor`, `abonos_proveedor`, `cestas_proveedor`.
- Inventario: `movimientos_inventario`, `existencias`, `lotes`, `producciones`.
- Nómina: `empleados`, `jornadas`, `jornada_tareas`, `abonos_empleados`, `periodos_nomina`,
  `periodo_nomina_items`.
- Gastos: `categorias_gasto`, `conceptos_gasto`, `gastos`.

**Vistas:** `v_resumen_clientes`, `v_saldos_clientes_moneda`, `v_resumen_proveedores`,
`v_saldos_proveedores_moneda`, `v_stock`, `v_stock_total`, `v_resumen_empleados`.

**Funciones de ayuda:**
- `hoy()` (fecha en Caracas);
- `normalizar(texto)` (minúsculas y sin acentos, para buscar y para nombres únicos);
- `tiene_rol(...)`, `es_admin()`, `es_usuario_activo()`, `exigir_rol(...)`, `rol_actual()`;
- `siguiente_numero(clave)` (contadores sin huecos).

**Storage** (archivos):
- `empresa`: público, para el logo.
- `entregas`, `facturas` y `gastos`: privados; se ven con URL firmada.

**Montos:**
- `numeric(14,2)` y cantidades `numeric(14,3)`.
- En la app se usa `decimal.js` con redondeo *half-up*, igual que `round()` de Postgres.
- **Nunca se mezclan monedas en una suma.** Todo se agrupa por moneda.

---

## 9. Migración de datos de los programas anteriores (Fase 9)

- **Proveedores COP y USD: HECHO** el 2026-10-16.
  - Script: `python3 -I scripts/migracion/proveedores_desde_excel.py LIBRO.xlsx COP|USD salida.sql [--omitir="NOMBRE"]`.
  - Lee el libro "SISTEMA DE PROVEEDORES": una hoja por proveedor y un "Panel de Control".
  - Genera **un solo bloque `do`** que:
    - crea los rubros que falten y los proveedores;
    - reconoce un proveedor existente por nombre normalizado **sin espacios** (así se
      fusionó Humberto Molina, que estaba en COP y en USD);
    - importa entregas (fruta en modo VARIABLE, piña e insumos en UNIDAD), abonos y cestas;
    - **compara el saldo de cada proveedor con el panel de la hoja y deshace todo si no
      cuadra**;
    - se niega a importar dos veces.
  - Resultado en producción:
    - **COP:** 49 proveedores, 770 entregas, 300 abonos, saldo 48.512.860,82.
    - **USD:** 7 proveedores, 57 entregas, 43 abonos, saldo 2.261,18. Se omitió a Miguel
      Morales por pedido de Samer.
  - Los SQL generados **tienen datos reales y no están en el repositorio**.
- **ERP Clientes y Nómina: NO se migran**, por decisión de Samer (2026-11-02).
- Si algún día se retoma ERP Clientes, la estructura y la idea de leer las imágenes de
  postimages están en el historial de git de este archivo (versiones de octubre).

---

## 10. Utilidades SQL (`supabase/utilidades/`, Samer las pega a mano; no son migraciones)

| Archivo | Para qué |
|---|---|
| `revisar_migraciones.sql` | Solo lectura: dice ✅ / ❌ para cada migración desde la 20261019. **Agregar una fila por cada migración nueva.** |
| `borrar_datos_de_prueba.sql` | Vacía todo el movimiento (clientes, facturas, proveedores, inventario, nómina, bitácora) y reinicia los contadores. Conserva usuarios, empresa y catálogos. **Peligroso:** solo se usó antes de empezar a cargar datos reales. |
| `corregir_pina_por_unidad.sql` | Pasó la piña importada de VARIABLE a UNIDAD sin cambiar totales. Ya aplicado. Se puede repetir. |
| `limpiar_notas_importadas.sql` | Quita la nota "N cestas de X kg × precio" de las entregas importadas que se cambiaron de modo. Se puede repetir. |

---

## 11. Entorno local y pruebas

**Primera vez en un contenedor Linux en la nube** (en una máquina normal basta con
`npm install`, `npx supabase start` y `npm run dev`):
```bash
npm install
# Postgres "pelado" para la prueba SQL
mkdir -p /var/tmp/pgts && chown postgres /var/tmp/pgts
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/tmp/pgts/data -U postgres --auth=trust"
# Supabase local (Docker)
(setsid dockerd > /var/tmp/dockerd.log 2>&1 &); sleep 8
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,mailpit,postgres-meta
# .env.local (no está en git): copiar .env.example y pegar la URL y las claves que imprime `supabase start`
# Primer usuario = admin (las pruebas e2e lo usan):
curl -X POST http://127.0.0.1:54321/auth/v1/admin/users -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" -d '{"email":"admin@tierrasanta.test","password":"Clave2026","email_confirm":true,"user_metadata":{"nombre":"Samer"}}'
```

**Cada vez** (los contenedores se reciclan y todo se cae): `bash scripts/levantar-local.sh`.
- No borres `postmaster.pid` con Postgres corriendo; el script ya lo controla.
- Para aplicar una migración nueva en local:
  `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -v ON_ERROR_STOP=1 -f supabase/migrations/<nueva>.sql`.

**Verificar antes de subir cualquier cambio:**
```bash
npx next typegen                      # si agregaste rutas
npx tsc --noEmit && npx eslint . && npx vitest run              # 51 pruebas unitarias
PGHOST=/var/tmp/pgts PGPORT=54329 PGUSER=postgres scripts/probar-sql.sh   # → TODAS LAS PRUEBAS PASARON
npm run build                         # si sale SecurityFatalError, repetir una vez
# reiniciar el servidor sin matar la propia shell:
fuser -k 3000/tcp; (setsid npx next start -p 3000 > /var/tmp/next.log 2>&1 &)
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test   # 34 pruebas e2e (pc + teléfono)
```

**Notas sobre las pruebas:**
- **Prueba SQL** (`supabase/tests/flujo_factura.sql`): instala todas las migraciones sobre un
  shim de Supabase y prueba el flujo completo (factura → inventario → cobranza, proveedores,
  nómina, reportes, gastos, permisos por rol).
  - Los ids de producto ahí son: 1 = Guanábana comprada (901), 10 = Guanábana 800 g,
    11 = Guanábana 1 kg, 12 = Parchita 800 g, 14 = Durazno 800 g.
  - Arranca con `inventario_desde = '2000-01-01'` para que las facturas descuenten.
- **Pruebas e2e** (`tests/e2e/fase1…fase9`):
  - Crean sus propios datos con sufijos aleatorios, así que se pueden repetir.
  - Usan `activarControlInventario()` de `utilidades.ts` cuando necesitan que la factura
    descuente stock.
  - `elegirOpcion()` sirve para los `<select>`, porque `selectOption({label: RegExp})` rompe
    el build.
- **Capturas para revisar a ojo:** un script de Playwright con
  `executablePath: "/opt/pw-browsers/chromium"`, en PC (1280 px) y en teléfono (390 px).
- **No usar `pkill -f "next start"`:** mata la propia shell. Usar `fuser -k 3000/tcp`.

---

## 12. Trampas conocidas (ya nos pasaron)

- **SQL Editor de Supabase:** confirma cada sentencia por separado. Todo lo que deba ser
  todo-o-nada va en un bloque `do` (§6).
- **Migraciones:** Samer a veces no recuerda cuáles pegó. Usar `revisar_migraciones.sql`.
- **`create or replace function`:** reemplaza la definición completa. Copiar la última
  versión (puede estar en una migración posterior a la original), conservar
  `security definer` / `set search_path` y, si cambian los parámetros, borrar la vieja con
  `drop function`.
- **Vistas que dependen de una columna:** antes de cambiar el tipo de la columna, revisar si
  alguna vista la usa.
- **PostgREST:** en las vistas, los ids son nullables en los tipos de TypeScript. Filtrar
  `x.id !== null` antes de usarlos.
- **URLs con coma:** `?sel=1,2` llega como `sel=1%2C2`. Las pruebas deben aceptar ambas formas.
- **Facturas de prueba en local:** las e2e anulan las suyas. Para ver reportes con datos,
  emitir facturas por SQL con `request.jwt.claims` del admin.
- **Producción es en vivo:** la primera vez que Samer vea un cambio será en su sistema real.
  Probar bien antes de hacer push a la rama de producción.

---

## 13. Cómo trabajar con Samer (estilo de entrega)

- Responder en **español sencillo**, en párrafos cortos, sin jerga técnica. Cuando aplique,
  decir **dónde lo ve** en el menú.
- Si hay SQL que pegar: el enlace de GitHub de la rama de producción y cómo pegarlo (Copy raw
  file → SQL Editor → Run). Si no hay: decir explícitamente "**no hace falta pegar ningún
  SQL**".
- **Antes de cambiar o borrar datos de producción:** dale un SQL **de solo lectura** primero,
  para ver qué hay. Las correcciones deben ser repetibles y comprobar que los totales no
  cambian.
- Cuando algo "no cuadra", **primero averiguar qué está comparando**. Ejemplo: comparó
  "Compras del mes" con "deuda total". Se resolvió con un SQL de diagnóstico de solo lectura
  que listaba solo las diferencias.
- Manda **notas de voz** (archivos .ogg): se pueden transcribir con faster-whisper en un venv
  aparte (ffmpeg para convertir a float32 de 16 kHz).
- **Capturas:** ver qué señala y ajustar justo eso. Si pide algo ambiguo que afecta dinero,
  preguntar con opciones concretas.

---

## 14. Ideas y pendientes (nada empezado)

- Inventario de insumos (cuántas bolsas, guantes… quedan). Samer **no lo quiere todavía**.
- Comprimir fotos al subirlas: no hace falta por ahora (casi no sube fotos).
- Dominio propio (§3).
- Lotes FIFO: la base los soporta (`lotes`, `empresa.lotes_activos`), pero la interfaz no.
- Que `factura_numero_inicial` siga la numeración del programa de Windows, si Samer lo pide.
- Tarjetas del Dashboard: con Gastos y Nómina son 9 en una cuadrícula de 4 columnas, y la
  última fila queda con una sola. Cosmético.

---

## 15. Bitácora de sesiones

| Fecha | Qué se hizo |
|---|---|
| 2026-11-04 | Nómina por pagos en vez de periodos (§7.7): botones Pagar y Adelanto, "Pagar a los fijos" (pago parcial = acumula), panel con saldo total, último pago, ganado y adelantos desde el último pago, días trabajados del mes y tareas del mes (destajo); reporte por defecto desde el último pago. Sin migración. |
| 2026-11-03 | Este HANDOFF reescrito como documento maestro (para Codex y otros agentes). `AGENTS.md` lo señala. Se agregaron `scripts/levantar-local.sh` y `supabase/utilidades/revisar_migraciones.sql`. |
| 2026-11-02 | `robots.txt` + `noindex` (aparecían robots de Linux en las estadísticas de Vercel). Samer decide no migrar ERP Clientes. Sin fotos, el plan gratis de Supabase sobra; se recomendó respaldo semanal en Excel. |
| 2026-10-29 (cont.) | Módulo **Gastos** (migración 20261030), reporte "Gastos por categoría", tarjeta en el Dashboard, Catálogos → Gastos. |
| 2026-10-29 | Reporte "Ventas a un cliente" (migración 20261029). |
| 2026-10-26 | Reporte "Saldos de proveedores". "Ventas por producto" une USD y COP. Next.js 16.4.0 → 16.4.3 (seguridad). |
| 2026-10-19 (cont.) | Nómina separada en Personal fijo / Por destajo (solo pantalla). |
| 2026-10-19 | Facturar sin descontar inventario hasta el conteo (migración 20261028). Sello de la empresa en la factura. Nuevo estilo del estado de cuenta de proveedores. |
| 2026-10-16 (cont. 4) | Reporte "Fruta recibida" (migración 20261027). Tarjeta de compras/cobrado en filas por moneda. |
| 2026-10-16 (cont. 2–3) | Ficha de proveedor: precio por kilo y cestas cuando aplican; piña por unidad; entrega sin nota ni foto; compra por cesta en cestas o kilos (migración 20261026). Migración de proveedores USD. |
| 2026-10-16 (cont.) | Migración de proveedores COP desde la hoja (script + SQL con verificación de saldos). |
| 2026-10-16 | Blanco y negro (sin morado), logo de inicio más chico, marca de agua de frutas en la factura, script para borrar datos de prueba. |
| 2026-10-15 | Una sola ubicación (migración 20261025). |
| 2026-10-14 | Esquema completo y Fases 1–8: base, catálogos, proveedores, clientes, facturación, inventario, nómina, dashboard y reportes (migraciones 20261014–20261024). Separación de fruta comprada y bolsas de 800 g y 1 kg. Los pagos se aplican solos. |
