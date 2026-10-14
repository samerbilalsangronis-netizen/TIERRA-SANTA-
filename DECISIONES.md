# Decisiones y supuestos

Cosas que el documento dejaba abiertas y cómo se resolvieron. Todas se pueden cambiar.

## General
- **Next.js 16 con Cache Components desactivado.** Toda la app es privada y depende de la sesión, así que cada página se renderiza por petición. Evita complejidad sin perder velocidad (la velocidad viene de consultas indexadas y agregados en Postgres).
- **`proxy.ts` en lugar de `middleware.ts`** (cambio de nombre de Next 16).
- **shadcn/ui con Base UI** (estilo por defecto actual de shadcn). En formularios se usan `<select>` nativos con el mismo estilo porque funcionan mejor en el teléfono.
- **Uso en PC y teléfono**: barra lateral fija en PC; en el teléfono, menú deslizable, listas en tarjetas en vez de tablas, campos de 40 px de alto y textos de 16 px (evita el zoom de iOS).
- Montos: `numeric(14,2)` en BD; en la app `decimal.js` con redondeo *half-up* (igual que `round()` de Postgres). Cantidades `numeric(14,3)`. Precio por kg de entregas `numeric(14,4)`.
- COP se muestra sin decimales (`COP $ 350.000`); USD y VES con 2.
- Zona horaria `America/Caracas` en BD (`public.hoy()`) y en la app.

## Usuarios y acceso
- Inicio de sesión **solo con correo y contraseña** (Supabase Auth). No hay suscripción ni vencimiento.
- Estados: ACTIVO, BLOQUEADO, INACTIVO. Solo entran los ACTIVOS. Si un usuario es bloqueado mientras navega, se cierra su sesión en la siguiente página; además la BD le niega todo (las políticas RLS usan `rol_actual()`, que exige ACTIVO).
- **El primer usuario creado en Supabase queda como admin** (para arrancar sin consola). Los siguientes nacen INACTIVOS y el panel de Usuarios les asigna rol y los activa con la clave de servicio; así, si alguien se registrara por su cuenta, no tendría acceso. El rol nunca se toma de datos que el propio usuario pueda enviar.
- Contraseñas: mínimo 8 caracteres con letras y números. Al crear un usuario se puede exigir que cambie la contraseña en su primer inicio.
- No se borran usuarios: se pasan a INACTIVO o BLOQUEADO. Un admin no puede quitarse su rol ni bloquearse a sí mismo.
- Instalación pensada para **Supabase web + Vercel**: `supabase/instalar.sql` se pega en el SQL Editor y en Vercel solo se configuran 3 variables de entorno.

## Roles (por defecto)
| | admin | facturación | operador | solo lectura |
|---|---|---|---|---|
| Configuración, usuarios, auditoría | ✔ | | | |
| Facturar, editar/anular, cobrar | ✔ | ✔ | | |
| Clientes (crear/editar) | ✔ | ✔ | | |
| Proveedores: entregas y cestas | ✔ | ✔ | ✔ | |
| Proveedores: abonos | ✔ | ✔ | | |
| Inventario: producción, traslados, merma | ✔ | ✔ | ✔ | |
| Inventario: ajustes por conteo | ✔ | | | |
| Nómina (todo, incluidos montos) | ✔ | | | |
| Consultar | ✔ | ✔ | ✔ | ✔ |

Quién puede **editar facturas emitidas** se configura en Empresa (por defecto admin y facturación).

## Facturación y cobros
- Número de factura: contador bloqueado dentro de la transacción ⇒ **sin huecos** aunque falle una emisión. Los borradores no consumen número. El prefijo es solo de presentación.
- IVA: se calcula sobre la base imponible total, `round(base × % / 100, 2)`, no línea por línea (evita diferencias de céntimos).
- La factura guarda una **copia de los datos del cliente** al emitir/editar, para que el documento impreso no cambie si luego se edita la ficha.
- Editar una factura emitida: mismo número; el inventario se ajusta solo por la diferencia; cada edición crea una versión con instantánea completa y las diferencias.
- Si al editar el total queda por debajo de lo pagado, se liberan las aplicaciones más recientes y el excedente queda como **saldo a favor**.
- Cambio de moneda con pagos (modo "convertir", configurable): los pagos se desaplican y se registran dos movimientos de conversión (−X en la moneda vieja, +X×tasa en la nueva) que se aplican a la factura. Así ningún saldo se convierte en silencio y todo queda trazado.
- No se puede cambiar el cliente de una factura que ya tiene pagos aplicados.
- **Anular** devuelve el inventario y libera los pagos como saldo a favor; la factura queda visible como ANULADA. Un borrador sí se puede descartar.
- Saldo a favor = Σ pagos − Σ aplicado (por moneda). Se aplica a otra factura con "aplicar saldo a favor".
- Facturas externas/históricas: origen `externa`, número libre, no tocan inventario.
- El sistema no afirma validez fiscal (SENIAT): título del documento y textos legales configurables.

## Inventario
- Libro mayor de movimientos; la tabla `existencias` la mantiene un trigger. Los movimientos no se editan: se corrigen con otro movimiento.
- **El inventario solo crece con las entradas que registra la planta** (producción diaria). Lo que trae el proveedor **no** suma al inventario, porque la fruta se procesa antes de ser producto final (decisión de Samer, Fase 3). Se eliminó el interruptor de Configuración.
- Las facturas descuentan el inventario; al anular o reducir una factura, se devuelve.
- Existe la "forma" MP/PT en la base de datos para el futuro, pero hoy todo el stock es producto terminado (PT).
- Con lotes activos, las salidas consumen el lote más viejo primero (FIFO); al reducir/anular una factura se devuelve a los mismos lotes.

## Proveedores
- Un solo módulo para COP y USD: cada entrega y cada abono lleva su moneda; los saldos se muestran por moneda, nunca mezclados.
- **Modos de compra** (pedido de Samer): cada entrega se registra
  - **Por kilo:** kilos × precio por kilo; total = (kg − merma) × precio.
  - **Por unidad** (ej. piñas): unidades × precio por unidad; las "unidades dañadas" se descuentan.
  - **Por cesta:** cestas × precio por cesta (kg = cestas × kg por cesta; merma descontada al precio por kg).
  - "Precio total" (el VARIABLE del sistema anterior) solo se conserva para datos migrados.
- Cada producto tiene su modo por defecto ("Se compra" en Catálogos): las frutas iniciales quedaron **por kilo** y la piña **por unidad**. En cada entrega se puede cambiar.
- La pantalla muestra el cálculo en vivo y el **total siempre visible junto al botón Guardar**.
- Los kg por cesta se copian en la entrega: cambiar luego el producto no altera entregas pasadas.
- La merma (o las unidades dañadas) no puede superar lo recibido.
- **Proveedores de insumos** (bolsas, etiquetas, envases): los insumos son productos de categoría "insumo" en el mismo catálogo (no se facturan) y el proveedor tiene tipo Fruta / Insumos / Ambos. Para un proveedor de insumos solo aparecen insumos, sin merma ni cestas. El panel filtra por tipo. Por ahora los insumos **no** llevan inventario.
- **Cestas:** al registrar una entrega viene marcada la casilla "anotar estas cestas como entregadas"; ese movimiento queda enlazado a la entrega (se actualiza o borra con ella). Las devoluciones se registran aparte con el botón "Cestas".
- Foto de la entrega: se toma con la cámara del teléfono, se reduce a máx. 1600 px (JPEG) y se sube al bucket privado `entregas`; se ve con enlaces temporales. También se acepta una URL.
- Estado de cuenta: hoja imprimible (botón "Imprimir / PDF" → Guardar como PDF del navegador) y descarga en Excel. El cálculo lo hace Postgres (`estado_cuenta_proveedor`), con saldo anterior cuando se filtra por fecha.
- Permisos: operador y facturación registran entregas y cestas; abonos y eliminar entregas: admin y facturación; eliminar un proveedor: solo admin y solo si no tiene movimientos (si no, se desactiva).

## Nómina (según las capturas del sistema actual)
- Pantalla por empleado con **calendario mensual** que muestra lo ganado cada día; al tocar un día se abre la jornada.
- **Destajo**: Asistió / No asistió, justificada, lista de todas las tareas con su precio y la cantidad realizada (subtotal por tarea) y "pago adicional por día".
- **Fijo**: la tarifa diaria se define en la ficha del empleado; la jornada calcula sola: Asistió = tarifa, Media jornada = mitad, No asistió = 0. También admite tareas y pago adicional.
- Cada jornada guarda la tarifa vigente ese día y cada tarea su precio de ese día: cambiar precios no altera el pasado.
- Moneda de nómina: COP.
- Cierre de periodo: congela lo ganado (no se pueden editar jornadas ni abonos de ese rango), calcula saldo anterior + ganado − abonos y, opcionalmente, registra la **liquidación** para dejar el saldo en cero. Se puede reabrir con motivo.
- Las precargas de tareas usan los precios vistos en las capturas (Espicada de Fresa $5.000/cesta, Cortada de Durazno $10.000/cesta, etc.).

## Logo
- Logo oficial (alas + monograma TS) convertido a PNG transparente: **blanco** para la app oscura (`/logo-tierra-santa.png`) y **negro** para papel y modo claro (`/logo-tierra-santa-negro.png`). El original queda en `public/marca/`. Desde Configuración se puede subir otro.

## Catálogos (Fase 2)
- Se administran en **Configuración → Catálogos** (solo admin). Todos los usuarios activos los pueden consultar.
- **Eliminar** solo funciona si el registro nunca se usó; si ya tiene historial, la app sugiere **desactivarlo** (deja de aparecer para elegir, pero el historial queda intacto).
- Productos: el código es entero, único y editable. El sistema propone el siguiente libre. Un rubro FIJO exige kg por cesta (excepto los de tipo "producto terminado", que no se compran a proveedores).
- Cambiar el precio de una tarea o los kg por cesta de un rubro no altera lo ya registrado (cada jornada/entrega guarda su copia).
- Solo puede haber una ubicación predeterminada; no se puede desactivar ni borrar la predeterminada, ni la moneda por defecto de la empresa.
- Tasas de cambio: una por día y par de monedas (registrar otra el mismo día la reemplaza). Son solo informativas.
- Los números se pueden escribir como "4.000", "2.500", "12,5" o "0,25".

## Respaldo
- **Configuración → General → Descargar respaldo en Excel** (solo admin): un .xlsx con una hoja por tabla y una hoja RESUMEN con el conteo de registros.

## Clientes (Fase 4)
- **Número de cliente:** consecutivo automático; solo el admin puede escribirlo o cambiarlo.
- **Estado:** CRÍTICO si debe algo en cualquier moneda; AL DÍA si no. La etiqueta de moneda (USD, COP, USD/COP o "-") y los totales del panel salen de Postgres.
- **Saldo por moneda** = pendiente de sus facturas − saldo a favor. Nunca se mezclan monedas.
- **Pagos (cambio pedido por Samer):** todo dinero recibido **se descuenta solo** de las facturas pendientes de esa moneda, de la más vieja a la más nueva. Ya no queda dinero "suelto" como saldo a favor: solo si el cliente pagó más de lo que debe en total, y en ese caso se descuenta solo de su **próxima** factura. Lo mismo pasa al anular una factura pagada o al bajar su total: lo pagado pasa a las otras facturas pendientes.
  - Cada factura tiene **"Pagar completa"** y **"Abonar"**, que abren un formulario simple con **un solo campo de monto** y muestran cómo queda la factura.
  - **Pago de varias facturas:** se marcan con casillas (misma moneda) y se indica en cada una "Completa" o el monto; o se escribe el monto recibido en "Registrar pago" y se reparte solo de la más vieja a la más nueva (ajustable antes de confirmar). Un solo recibo.
  - En pantalla se habla de "Debe" y "Pagó de más", no de "saldo a favor".
- Editar un pago permite cambiar fecha, método, referencia, nota, monto y reparto; la moneda no (se elimina y se registra de nuevo).
- **Facturas históricas/externas:** número libre, fecha, moneda, monto y soporte (PDF/foto subido al bucket privado `facturas`, o una URL). No tocan inventario. Se editan mientras el nuevo monto no sea menor a lo pagado.
- **Anular:** la factura queda visible como ANULADA y sale de la deuda; lo que tenía pagado se descuenta de las otras facturas pendientes.
- **Antigüedad de saldos:** 0–15, 16–30, 31–60 y +60 días desde la fecha de la factura; en la ficha (por moneda) y en un reporte general con Excel.
- **Recibo de pago** imprimible / PDF con logo, detalle de facturas abonadas y saldo a favor generado.
- Las facturas del sistema (con líneas de productos) se emiten desde Facturación (Fase 5) y aparecerán solas en la ficha.

## Facturación (Fase 5)
- **Pantalla de emisión** pensada para teclado: el cliente se busca por número, nombre o cédula/RIF (Enter elige); en cada línea se escribe el **código** (o parte del nombre) y Enter pasa a cantidad → precio → línea nueva. Ctrl+Enter emite. En el teléfono las líneas se ven como tarjetas y el total con el botón Emitir quedan fijos abajo.
- Solo se facturan productos de categoría **fruta** que no sean "materia prima".
- **Precio sugerido**: el último precio usado con ese cliente en esa moneda (se puede cambiar).
- Se muestra el stock disponible de cada producto en la ubicación de salida. Si no alcanza: aviso (se puede emitir) o bloqueo, según Configuración → Empresa.
- Al emitir se puede anotar lo **cobrado al entregar** ("Pagó completo" llena el total; "Contado" lo marca solo) y las **cajas que se lleva**. Todo en una sola transacción.
- **Borradores**: no tienen número ni tocan inventario/saldos; se continúan y se emiten después, o se descartan.
- **Duplicar** abre una factura nueva con las mismas líneas y la fecha de hoy (no se guarda hasta emitir o guardar borrador).
- **Editar**: mismo número; se puede dejar un motivo. El historial muestra quién, cuándo y qué cambió.
- **PDF** tamaño carta generado en el servidor (@react-pdf/renderer) con el mismo contenido que la hoja en pantalla: logo, datos de la empresa, título configurable, número con prefijo, cliente, líneas, totales, **monto en letras**, firmas, pie y textos legales, páginas numeradas, sello ANULADA. El botón "Imprimir" usa la hoja HTML.
- Listado con búsqueda por nº de factura (con o sin ceros/prefijo), cliente, cédula/RIF o producto; filtros por estado, moneda y fechas; totales del filtro por moneda; 50 por página. Las facturas históricas también aparecen y abren la ficha del cliente.
- Permisos: los usuarios sin sesión ya no pueden ejecutar ninguna función de la base de datos (salvo el nombre y logo de la pantalla de inicio).

## Inventario (Fase 6)
- El inventario es **solo de producto terminado** (frutas que se venden). Sube con la **producción** y baja con **facturas**, **merma** y **ajustes**. Las entregas de proveedores no entran (confirmado por Samer).
- **Producción diaria:** una pantalla con todos los productos; se escribe solo lo producido (Enter pasa al siguiente). Fecha, ubicación, responsable (por defecto quien registra) y nota. Si se registró por error, el admin la elimina con motivo y el stock vuelve.
- **Merma:** producto terminado que se perdió; exige motivo. La registran admin, facturación y operador.
- **Traslado:** mueve entre ubicaciones; el total no cambia.
- **Ajuste por conteo:** solo admin; se escribe lo contado y el sistema registra la diferencia con su motivo.
- **Estado del stock:** Agotado (≤ 0), Bajo (menor al mínimo del producto), Normal. Las alertas del Dashboard ignoran los insumos.
- **Kardex** por producto con saldo después de cada movimiento, filtro por fechas y ubicación, y descarga a Excel. También hay Excel del stock actual.
- Las cantidades pueden quedar negativas si se factura sin stock con la opción "advertir" (se ve como Agotado).

## Fruta comprada vs. producto vendido (pedido de Samer)
- Se vende pulpa en **bolsas de 800 g y de 1 kg**. Por eso cada fruta se separó en tres productos:
  - **Guanábana** (código 901…909): la fruta que se compra; solo aparece en las **entregas de proveedores** (uso "Se compra").
  - **Guanábana 800 g** (conserva el código de siempre: **1** = Guanábana 800 g): se factura, se produce y lleva inventario en **bolsas**.
  - **Guanábana 1 kg** (código 101…109): igual, en bolsas.
- Las facturas, la producción y el inventario que ya existían con la fruta pasaron a la presentación de 800 g. Las entregas de proveedores siguen en la fruta.
- En Catálogos, el campo **Uso** decide dónde aparece cada producto: "Se vende" (facturas, inventario, producción), "Se compra" (entregas de proveedores) o "Se compra y se vende igual". Un producto nuevo de fruta nace como "Se vende" en bolsas.
- **Catálogo de productos en 3 pestañas:** "Se vende" (con código, fruta de origen y kg de pulpa por bolsa), "Fruta de proveedores" y "Insumos" (estas dos **sin código visible**: el sistema les asigna uno interno desde 901). En las entregas de proveedores la fruta se elige por nombre.

## Gráfico de pulpa por rubro (Inventario)
- Dona con el **porcentaje de pulpa de cada fruta**: las bolsas se pasan a kg (bolsas × kg de pulpa por bolsa: 0,8 / 1) y se suman por fruta de origen (la de 800 g y la de 1 kg juntas). Se puede ver **en inventario** (lo que hay hoy) o **producido esta semana** (últimos 7 días).
- Muestra hasta 6 segmentos; si hay más rubros, los más pequeños se agrupan en "Otros". Cada fruta conserva siempre su color. Al tocar un rubro se ve su porcentaje en el centro. La leyenda lleva kg y porcentaje escritos.
- Los cálculos los hace Postgres (`pulpa_por_fruta`).

## Nómina (Fase 7)
- Solo el **admin** entra a Nómina (montos incluidos). Todo en COP.
- Pantalla con **Personal** (lista con lo que se le debe a cada uno) y **Tareas** (precios; se cambian en Catálogos). Ficha del empleado con **Calendario · Panel · Abonos · Reporte** y botones **Abonar, Editar, Eliminar**.
- **Calendario mensual** (Ant./Sig.) con lo ganado cada día; al tocar un día se abre "Jornada: <fecha>":
  - Por tarea: Asistió / No asistió, todas las tareas con su precio, cantidad y subtotal, pago adicional por día y "Ganado hoy".
  - Fijo: Asistió / Media jornada / No asistió con su tarifa diaria (completa / mitad / 0) y pago adicional. **Sin tareas** (pedido de Samer: el fijo cobra por día; en Asistencia del día tampoco tiene botón de tareas).
  - Falta justificada solo se marca cuando no asistió (no paga).
- **Asistencia del día:** todos los empleados con botones grandes; un toque guarda. El botón de tareas abre la jornada completa. Al cambiar la asistencia se conservan las tareas y su precio de ese día.
- **Abonos/adelantos** con monto, fecha, entregado por y nota. Lo que se le debe = ganado − abonos.
- **Periodos** (semanal por defecto, según Configuración → Empresa; se propone el siguiente). Antes de cerrar se ve el resumen calculado. Al **cerrar** se congela lo ganado y, si se marca, se registra el **pago** de lo que se debe (los saldos quedan en 0). En un periodo cerrado no se pueden crear, cambiar ni borrar jornadas ni abonos. **Reabrir** exige motivo y quita el pago automático.
- **Recibo por empleado** imprimible (uno por página) y **Excel** del periodo.

## Dashboard y reportes (Fase 8)
- **Periodo:** Hoy · Esta semana · Semana pasada · Este mes (por defecto) · Mes pasado · Rango. Se compara con el periodo anterior de igual largo; "esta semana" y "este mes" se comparan con los mismos días del periodo anterior (justo a mitad de mes). Semanas de lunes a domingo.
- **Cifras:** ventas USD y COP (nº de facturas), **productos vendidos** (bolsas y kg de pulpa, pedido de Samer), producción (kg), facturas (promedio por factura), cobrado, compras a proveedores (kg y % de merma) y nómina (solo admin). Flecha verde/roja según si mejoró o empeoró (en compras y nómina subir no es "bueno").
- **Rendimiento semanal** (pedido de Samer): lo vendido cada semana en las últimas 12; si una semana vendió más que la anterior la línea sube y el punto es verde ▲, si vendió menos baja y el punto es rojo ▼. Se ve en bolsas o en monto de la moneda elegida.
- Gráficos: ventas por día, productos más vendidos (top 5), mejores clientes (top 10). La moneda de los gráficos se elige arriba (por defecto la que más facturas tuvo).
- Columna de **alertas**: por cobrar USD/COP y los que deben desde hace más tiempo, stock bajo/agotado, cajas en clientes, cestas con proveedores y lo que se debe a proveedores.
- **Reportes** (pantalla, imprimir/PDF y Excel): ventas por producto, ventas por cliente, libro de facturas (con anuladas en 0), compras por proveedor con merma, producción diaria, cajas y cestas. Enlaces a los que ya existían (antigüedad, estados de cuenta, kardex, nómina).
- Ventas = facturas emitidas (anuladas y borradores no cuentan). Montos por producto sin IVA. Todas las sumas las hace Postgres.
