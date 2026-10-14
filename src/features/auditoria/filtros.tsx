"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/comunes/campos";

const TABLAS = [
  ["", "Todas las tablas"], ["facturas", "Facturas"], ["pagos_clientes", "Pagos de clientes"], ["pago_aplicaciones", "Aplicación de pagos"],
  ["clientes", "Clientes"], ["proveedores", "Proveedores"], ["entregas_proveedor", "Entregas"], ["abonos_proveedor", "Abonos a proveedores"],
  ["productos", "Productos"], ["existencias", "Inventario"], ["producciones", "Producción"], ["empleados", "Empleados"],
  ["jornadas", "Jornadas"], ["abonos_empleados", "Abonos a empleados"], ["profiles", "Perfiles"], ["usuarios", "Usuarios"],
  ["empresa", "Empresa"],
] as const;
const ACCIONES = ["", "CREAR", "EDITAR", "BORRAR", "EMITIR", "ANULAR", "AJUSTE", "CERRAR", "REABRIR", "CREAR_USUARIO", "RESTABLECER_CLAVE"];

type Filtros = Record<"tabla" | "accion" | "usuario" | "desde" | "hasta" | "registro", string>;

export function FiltrosAuditoria({ inicial }: { inicial: Filtros }) {
  const router = useRouter();
  const ruta = usePathname();
  const [f, setF] = useState(inicial);
  const set = (k: keyof Filtros) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  function aplicar(e?: React.FormEvent) {
    e?.preventDefault();
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    router.push(`${ruta}${qs.size ? `?${qs}` : ""}`);
  }

  return (
    <form onSubmit={aplicar} className="grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-3 lg:grid-cols-7">
      <SelectNativo value={f.tabla} onChange={set("tabla")} aria-label="Tabla">
        {TABLAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </SelectNativo>
      <SelectNativo value={f.accion} onChange={set("accion")} aria-label="Acción">
        {ACCIONES.map((a) => <option key={a} value={a}>{a || "Todas las acciones"}</option>)}
      </SelectNativo>
      <Input value={f.usuario} onChange={set("usuario")} placeholder="Usuario" />
      <Input value={f.registro} onChange={set("registro")} placeholder="ID registro" />
      <Input type="date" value={f.desde} onChange={set("desde")} aria-label="Desde" />
      <Input type="date" value={f.hasta} onChange={set("hasta")} aria-label="Hasta" />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1"><Filter className="size-4" /> Filtrar</Button>
        <Button type="button" variant="outline" size="icon" aria-label="Limpiar filtros"
          onClick={() => { setF({ tabla: "", accion: "", usuario: "", desde: "", hasta: "", registro: "" }); router.push(ruta); }}>
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}
