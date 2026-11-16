# Revisión preventiva de historiales

Rama: `mejora/historiales-completos-preview`. Base de producción: `8bf99d0`.

**No fusionar ni promover a producción hasta que Samer revise y apruebe.** No hay migraciones SQL ni modificaciones a los registros comerciales.

## Cambios

- Proveedor: entregas, abonos y cestas por páginas de 50, conservando filtros y sección. Los totales del filtro se calculan aparte en el servidor con todas las filas; los saldos actuales continúan saliendo de las mismas vistas SQL.
- Nómina: pagos por páginas de 50. El reporte por fecha y el panel consultan sus propios pagos completos, no la página visible. También se recuperan completas las jornadas, los últimos pagos y lo pagado en la semana.
- Gastos: páginas de 50 y resumen independiente de todas las filas del filtro, sin firmar ni enviar al navegador comprobantes fuera de la página.
- Estados de cuenta de proveedores y clientes: lectura por lotes del resultado SQL completo, manteniendo los saldos que ya calcula Postgres. Las descargas Excel y la hoja para imprimir usan ese mismo resultado completo.
- Las lecturas por lotes avanzan por la cantidad realmente recibida: soportan un máximo de API menor que el tamaño solicitado. Los errores intermedios no se convierten en cifras parciales.
- Orden por fecha e ID para las páginas. Bajo operaciones concurrentes, recargar actualiza la consulta; no se pretende crear una instantánea de toda la base entre varias peticiones.

## Protección de la vista previa

En el build de Vercel con `VERCEL_ENV=preview`, `NEXT_PUBLIC_VISTA_PREVIA_LECTURA=1` activa un aviso y bloquea las peticiones de escritura de los clientes Supabase de la app (servidor, navegador y administración). Solo se permiten lectura, RPC de consulta en lista explícita, autenticación/refresco/cierre de sesión y enlaces firmados de documentos.

El login no llama a `registrar_acceso` en esta revisión. El proveedor de autenticación puede registrar su actividad normal de sesión. La protección no cambia permisos ni RLS de la base y no sustituye una base separada para pruebas destructivas. La conexión de Preview debe tener sus variables Supabase configuradas; no se añade ni mueve ninguna credencial en el código.

En producción la protección de revisión está desactivada por configuración de build, pero esta rama **no debe publicarse allí sin aprobación**.

## Comprobaciones

- Vitest: 64 pruebas, incluidas regresiones con 1.205 entregas, 605 pagos y 2.205 gastos, y respuestas limitadas a 17 filas.
- TypeScript y ESLint.
- Build de producción de Next.
- `node tests/revision/verificar-render.mjs`: levanta una API local con datos ficticios y verifica el HTML de las páginas reales, incluidas las páginas antiguas.
- `npx playwright test --config playwright.historiales.config.ts`: pruebas de interacción en PC y teléfono con esa API ficticia. Chromium está bloqueado en el entorno de preparación por una restricción de sockets; no se afirma que estas pruebas hayan pasado. Revisar visualmente en Vercel Preview antes de aprobar.
- No se ejecutan las pruebas originales de escritura contra producción. No se ha aplicado SQL.

## Qué revisar en Vercel

1. Verificar el aviso «Vista previa de revisión · Solo consulta».
2. consultar proveedores, cambiar entre Entregas/Abonos/Cestas y recorrer páginas. Al cambiar filtros se vuelve a la primera página y los totales consideran todo el filtro.
3. En Nómina → empleado → Pagos, recorrer el historial. Comparar saldo, último pago, panel y reporte con el sistema actual.
4. En Gastos, cambiar de página y comprobar que no cambian las tarjetas de totales. Cambiar las fechas sí debe actualizarlas.
5. Abrir estados de cuenta e imprimir/descargar Excel; comparar saldos con producción.
6. Revisar PC y teléfono. Los botones de guardar pueden abrir sus formularios, pero sus peticiones de escritura están bloqueadas en Preview.

## Alcance y siguientes pasos

Esta revisión atiende los límites de las fichas de proveedores, nómina y gastos y sus estados de cuenta. No pretende eliminar todos los límites de todos los módulos: siguen pendientes, por ejemplo, la ficha general de clientes, el libro de facturas de 500 filas y otros listados/reportes. No se modifican facturación, fórmulas de deuda ni control de inventario.

Los resúmenes recuperan columnas mínimas por lotes y suman en servidor para no exigir SQL sobre la base activa. El tiempo de consulta crece con el historial del filtro; si aumenta mucho, el siguiente paso es una función SQL de agregación en una migración nueva, probada y autorizada aparte.
