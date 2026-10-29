"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, MoreHorizontal, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmarAccion } from "@/components/comunes/confirmar-accion";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { formatearCantidad, formatearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { eliminarGasto } from "./acciones";
import { DialogoGasto } from "./dialogo-gasto";
import type { CatalogoGastos, FilaGasto } from "./datos";

/** Botón "Nuevo gasto" del encabezado (abre el formulario). */
export function BotonNuevoGasto({ catalogo, hoy }: { catalogo: CatalogoGastos; hoy: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button size="lg" onClick={() => setAbierto(true)}><Plus className="size-4" /> Nuevo gasto</Button>
      {abierto && <DialogoGasto catalogo={catalogo} hoy={hoy} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

/** Lista de gastos del periodo: corregir, eliminar y ver la foto del recibo. */
export function ListaGastos({ filas, catalogo, hoy, puedeCorregir }: {
  filas: FilaGasto[]; catalogo: CatalogoGastos; hoy: string; puedeCorregir: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<FilaGasto | null>(null);
  const [borrando, setBorrando] = useState<FilaGasto | null>(null);
  const [, iniciar] = useTransition();
  if (filas.length === 0) return <EstadoVacio icono={Receipt} titulo="Sin gastos" descripcion="No hay gastos con estos filtros." />;

  const cantidad = (g: FilaGasto) => (g.cantidad ? `${formatearCantidad(g.cantidad)} ${g.unidad ?? ""}`.trim() : "");
  const detalle = (g: FilaGasto) => [g.metodo, g.lugar, g.pagado_por && `Pagó: ${g.pagado_por}`, g.nota].filter(Boolean).join(" · ");
  const menu = (g: FilaGasto) => !puedeCorregir ? null : (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Acciones del gasto ${g.concepto} del ${formatearFecha(g.fecha)}`}><MoreHorizontal className="size-4" /></Button>} />
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => setEditando(g)}><Pencil className="size-4" /> Corregir</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => setBorrando(g)}><Trash2 className="size-4" /> Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const foto = (g: FilaGasto) => g.foto_firmada && (
    <a href={g.foto_firmada} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Ver foto del recibo"><Camera className="size-4" /></a>
  );

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Fecha</th><th className="p-3">Concepto</th><th className="p-3 text-right">Cantidad</th>
              <th className="p-3 text-right">Monto</th><th className="p-3">Detalle</th><th className="w-20 p-3" /></tr>
          </thead>
          <tbody className="divide-y">
            {filas.map((g) => (
              <tr key={g.id}>
                <td className="whitespace-nowrap p-3">{formatearFecha(g.fecha)}</td>
                <td className="p-3"><span className="font-medium">{g.concepto}</span><span className="block text-[11px] text-muted-foreground">{g.categoria}</span></td>
                <td className="tabular whitespace-nowrap p-3 text-right">{cantidad(g) || "—"}</td>
                <td className="tabular whitespace-nowrap p-3 text-right font-semibold">{formatearMonto(g.monto, g.moneda)}</td>
                <td className="max-w-[18rem] truncate p-3 text-xs text-muted-foreground" title={detalle(g)}>{detalle(g) || "—"}</td>
                <td className="p-3"><span className="flex items-center justify-end gap-1">{foto(g)}{menu(g)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {filas.map((g) => (
          <li key={g.id} className="flex items-start gap-2 rounded-2xl border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{g.concepto}</p>
                <p className="tabular font-semibold">{formatearMonto(g.monto, g.moneda)}</p>
              </div>
              <p className="text-xs text-muted-foreground">{formatearFecha(g.fecha)} · {g.categoria}{cantidad(g) ? ` · ${cantidad(g)}` : ""}</p>
              {detalle(g) && <p className="truncate text-xs text-muted-foreground">{detalle(g)}</p>}
            </div>
            {foto(g)}{menu(g)}
          </li>
        ))}
      </ul>

      {editando && <DialogoGasto catalogo={catalogo} hoy={hoy} gasto={editando} onCerrar={() => setEditando(null)} />}
      {borrando && (
        <ConfirmarAccion titulo="¿Eliminar este gasto?" textoConfirmar="Eliminar" destructivo
          descripcion={`${borrando.concepto} · ${formatearMonto(borrando.monto, borrando.moneda)} del ${formatearFecha(borrando.fecha)}. No se puede deshacer.`}
          abierto onAbiertoCambia={(v) => !v && setBorrando(null)}
          alConfirmar={() => iniciar(async () => {
            const r = await eliminarGasto(borrando.id);
            if (r.ok) { toast.success(r.mensaje); router.refresh(); } else toast.error(r.error);
            setBorrando(null);
          })} />
      )}
    </>
  );
}
