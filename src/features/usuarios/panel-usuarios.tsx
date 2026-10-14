"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, MoreHorizontal, Pencil, Search, Unlock, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { NOMBRE_ROL, type EstadoUsuario, type Rol } from "@/lib/auth/roles";
import { formatearFechaHora } from "@/lib/fechas";
import { cambiarEstadoUsuario } from "./acciones";
import { DialogoUsuario, DialogoRestablecer } from "./dialogos-usuario";

export type FilaUsuario = {
  id: string; email: string; nombre: string; rol: Rol; estado: EstadoUsuario;
  ultimo_acceso: string | null; debe_cambiar_clave: boolean;
};

export function EstadoBadge({ estado }: { estado: EstadoUsuario }) {
  const clases = {
    ACTIVO: "bg-success/15 text-success border-success/30",
    BLOQUEADO: "bg-destructive/15 text-destructive border-destructive/30",
    INACTIVO: "bg-muted text-muted-foreground border-border",
  }[estado];
  return <Badge variant="outline" className={clases}>{estado}</Badge>;
}

export function PanelUsuarios({ usuarios, yoId }: { usuarios: FilaUsuario[]; yoId: string }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<FilaUsuario | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [restablecer, setRestablecer] = useState<FilaUsuario | null>(null);
  const [, iniciar] = useTransition();

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? usuarios.filter((u) => `${u.nombre} ${u.email}`.toLowerCase().includes(q)) : usuarios;
  }, [usuarios, busqueda]);

  function cambiarEstado(u: FilaUsuario, estado: EstadoUsuario) {
    iniciar(async () => {
      const r = await cambiarEstadoUsuario(u.id, estado);
      if (r.ok) { toast.success(r.mensaje); router.refresh(); } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o correo…" className="pl-8" />
        </div>
        <Button onClick={() => setNuevo(true)}><UserPlus className="size-4" /> Nuevo usuario</Button>
      </div>

      {filtrados.length === 0 ? (
        <EstadoVacio icono={Users} titulo="No hay usuarios que coincidan" />
      ) : (
        <>
          {/* Tabla en PC */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">{u.nombre} {u.id === yoId && <span className="text-xs text-primary">(tú)</span>}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell>{NOMBRE_ROL[u.rol]}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={u.estado} />
                      {u.debe_cambiar_clave && <p className="mt-1 text-[11px] text-warning">Debe cambiar clave</p>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatearFechaHora(u.ultimo_acceso)}</TableCell>
                    <TableCell>
                      <MenuAcciones u={u} yoId={yoId} onEditar={setEditando} onRestablecer={setRestablecer} onEstado={cambiarEstado} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Tarjetas en celular */}
          <div className="grid gap-2 md:hidden">
            {filtrados.map((u) => (
              <div key={u.id} className="flex items-start justify-between gap-2 rounded-2xl border bg-card p-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{u.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <div className="flex items-center gap-2 text-xs"><EstadoBadge estado={u.estado} /> {NOMBRE_ROL[u.rol]}</div>
                </div>
                <MenuAcciones u={u} yoId={yoId} onEditar={setEditando} onRestablecer={setRestablecer} onEstado={cambiarEstado} />
              </div>
            ))}
          </div>
        </>
      )}

      <DialogoUsuario abierto={nuevo} onCerrar={() => setNuevo(false)} />
      <DialogoUsuario abierto={!!editando} usuario={editando ?? undefined} esYo={editando?.id === yoId} onCerrar={() => setEditando(null)} />
      <DialogoRestablecer usuario={restablecer} onCerrar={() => setRestablecer(null)} />
    </div>
  );
}

function MenuAcciones({
  u, yoId, onEditar, onRestablecer, onEstado,
}: {
  u: FilaUsuario; yoId: string;
  onEditar: (u: FilaUsuario) => void; onRestablecer: (u: FilaUsuario) => void; onEstado: (u: FilaUsuario, e: EstadoUsuario) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Acciones de ${u.email}`}><MoreHorizontal className="size-4" /></Button>} />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => onEditar(u)}><Pencil className="size-4" /> Editar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRestablecer(u)}><KeyRound className="size-4" /> Restablecer contraseña</DropdownMenuItem>
        {u.id !== yoId && (
          <>
            <DropdownMenuSeparator />
            {u.estado === "ACTIVO" ? (
              <DropdownMenuItem variant="destructive" onClick={() => onEstado(u, "BLOQUEADO")}><Lock className="size-4" /> Bloquear</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onEstado(u, "ACTIVO")}><Unlock className="size-4" /> Activar</DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
