"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Power, PowerOff, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { cn } from "@/lib/utils";
import { cambiarActivo, eliminarDeCatalogo } from "./acciones";

type Tabla = Parameters<typeof cambiarActivo>[0];

export type Columna<T> = { titulo: string; celda: (fila: T) => React.ReactNode; className?: string };

export function normalizarTexto(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function letraInicial(t: string) {
  const l = normalizarTexto(t.trim()).charAt(0).toUpperCase();
  return /[A-Z]/.test(l) ? l : "#";
}

/** Lista de catálogo: búsqueda, inactivos, agrupación A–Z, tabla en PC y tarjetas en teléfono. */
export function ListaCatalogo<T>({
  tabla, filas, clave, nombre, textoBusqueda, activo, columnas, tarjeta, agruparPorLetra = false,
  textoNuevo, onNuevo, onEditar, placeholder = "Buscar…", vacio,
}: {
  tabla: Tabla;
  filas: T[];
  clave: (f: T) => string | number;
  nombre: (f: T) => string;
  textoBusqueda: (f: T) => string;
  activo?: (f: T) => boolean;
  columnas: Columna<T>[];
  tarjeta: (f: T) => React.ReactNode;
  agruparPorLetra?: boolean;
  textoNuevo: string;
  onNuevo: () => void;
  onEditar: (f: T) => void;
  placeholder?: string;
  vacio: string;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [aEliminar, setAEliminar] = useState<T | null>(null);
  const [pendiente, iniciar] = useTransition();

  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    return filas.filter((f) => (verInactivos || !activo || activo(f)) && (!q || normalizarTexto(textoBusqueda(f)).includes(q)));
  }, [filas, busqueda, verInactivos, activo, textoBusqueda]);

  const grupos = useMemo(() => {
    if (!agruparPorLetra) return [["", visibles] as const];
    const m = new Map<string, T[]>();
    for (const f of [...visibles].sort((a, b) => nombre(a).localeCompare(nombre(b), "es"))) {
      const l = letraInicial(nombre(f));
      m.set(l, [...(m.get(l) ?? []), f]);
    }
    return [...m.entries()];
  }, [visibles, agruparPorLetra, nombre]);

  const inactivos = activo ? filas.filter((f) => !activo(f)).length : 0;

  function alternar(f: T) {
    iniciar(async () => {
      const r = await cambiarActivo(tabla, clave(f), !activo?.(f));
      if (r.ok) { toast.success(r.mensaje); router.refresh(); } else toast.error(r.error);
    });
  }

  function eliminar() {
    if (!aEliminar) return;
    const f = aEliminar;
    iniciar(async () => {
      const r = await eliminarDeCatalogo(tabla, clave(f));
      setAEliminar(null);
      if (r.ok) { toast.success(r.mensaje); router.refresh(); } else toast.error(r.error);
    });
  }

  const menu = (f: T) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Acciones de ${nombre(f)}`}><MoreHorizontal className="size-4" /></Button>} />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onEditar(f)}><Pencil className="size-4" /> Editar</DropdownMenuItem>
        {activo && (
          <DropdownMenuItem onClick={() => alternar(f)}>
            {activo(f) ? <><PowerOff className="size-4" /> Desactivar</> : <><Power className="size-4" /> Activar</>}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => setAEliminar(f)}><Trash2 className="size-4" /> Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={placeholder} className="pl-8" aria-label="Buscar" />
        </div>
        {activo && inactivos > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={verInactivos} onCheckedChange={(v) => setVerInactivos(Boolean(v))} />
            Ver inactivos ({inactivos})
          </label>
        )}
        <Button onClick={onNuevo} className="sm:ml-auto"><Plus className="size-4" /> {textoNuevo}</Button>
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio titulo={busqueda ? "Sin resultados" : vacio} descripcion={busqueda ? "Prueba con otra búsqueda." : undefined} />
      ) : (
        <>
          {/* PC */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnas.map((c) => <TableHead key={c.titulo} className={c.className}>{c.titulo}</TableHead>)}
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map(([letra, fs]) => (
                  <GrupoFilas key={letra || "todo"} letra={letra} columnas={columnas.length + 1}>
                    {fs.map((f) => (
                      <TableRow key={clave(f)} className={cn(activo && !activo(f) && "opacity-55")}>
                        {columnas.map((c) => <TableCell key={c.titulo} className={c.className}>{c.celda(f)}</TableCell>)}
                        <TableCell>{menu(f)}</TableCell>
                      </TableRow>
                    ))}
                  </GrupoFilas>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Teléfono */}
          <div className="space-y-3 md:hidden">
            {grupos.map(([letra, fs]) => (
              <div key={letra || "todo"} className="space-y-2">
                {letra && <p className="sticky top-14 z-[1] bg-background/90 py-1 text-xs font-bold text-primary backdrop-blur">{letra}</p>}
                {fs.map((f) => (
                  <div key={clave(f)} className={cn("flex items-start gap-2 rounded-2xl border bg-card p-3", activo && !activo(f) && "opacity-55")}>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEditar(f)}>{tarjeta(f)}</button>
                    {menu(f)}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{visibles.length} de {filas.length}</p>
        </>
      )}

      <AlertDialog open={!!aEliminar} onOpenChange={(v) => !v && setAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{aEliminar ? nombre(aEliminar) : ""}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede eliminar si nunca se ha usado. Si ya tiene movimientos, desactívalo para conservar el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={pendiente} onClick={eliminar}>Eliminar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GrupoFilas({ letra, columnas, children }: { letra: string; columnas: number; children: React.ReactNode }) {
  return (
    <>
      {letra && (
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableCell colSpan={columnas} className="py-1 text-xs font-bold text-primary">{letra}</TableCell>
        </TableRow>
      )}
      {children}
    </>
  );
}

export function EtiquetaEstado({ activo }: { activo: boolean }) {
  return activo
    ? <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Activo</Badge>
    : <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>;
}
