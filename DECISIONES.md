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
- **Forma MP / PT**: un mismo código (p. ej. 1 = Guanábana) tiene stock separado de **materia prima** (fruta recibida, kg) y **producto terminado** (pulpa). Las entregas entran como MP, la producción entra como PT (y opcionalmente descuenta MP), las facturas descuentan PT. Productos de tipo "materia prima" se venden desde MP.
- Las entregas suman a inventario el **peso neto** (kg) cuando la opción está activa, en la ubicación configurada.
- Con lotes activos, las salidas consumen el lote más viejo primero (FIFO); al reducir/anular una factura se devuelve a los mismos lotes.

## Proveedores
- Al registrar una entrega se **copian** `modo_pesaje` y `kg_por_cesta` del rubro: cambiar luego el rubro no altera entregas pasadas.
- La merma no puede superar el peso total.
- Las cestas siguen siendo un registro aparte (como en el sistema actual); la pantalla de entrega podrá crear el movimiento de cestas automáticamente.

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
