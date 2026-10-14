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
- Fórmulas idénticas al sistema anterior (FIJO por cesta / VARIABLE por kg total, merma descontada al precio por kg). La pantalla muestra el cálculo en vivo antes de guardar.
- Al registrar una entrega se **copian** el pesaje y los kg por cesta del rubro: cambiar luego el rubro no altera entregas pasadas. Si al editar se cambia el rubro, se toma la configuración nueva.
- La merma no puede superar el peso total.
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
