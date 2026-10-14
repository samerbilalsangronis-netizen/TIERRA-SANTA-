// Roles y permisos de la UI (espejo de las políticas RLS en la base de datos).
export const ROLES = ["admin", "facturacion", "operador", "solo_lectura"] as const;
export type Rol = (typeof ROLES)[number];

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: "Administrador",
  facturacion: "Facturación",
  operador: "Operador",
  solo_lectura: "Solo lectura",
};

export const ESTADOS_USUARIO = ["ACTIVO", "BLOQUEADO", "INACTIVO"] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

export type Permiso =
  | "ver_dashboard"
  | "facturar"
  | "gestionar_clientes"
  | "cobrar"
  | "gestionar_proveedores"
  | "pagar_proveedores"
  | "inventario_operar"
  | "inventario_ajustar"
  | "nomina"
  | "reportes_financieros"
  | "configuracion"
  | "usuarios"
  | "auditoria";

const PERMISOS: Record<Rol, Permiso[]> = {
  admin: [
    "ver_dashboard", "facturar", "gestionar_clientes", "cobrar", "gestionar_proveedores", "pagar_proveedores",
    "inventario_operar", "inventario_ajustar", "nomina", "reportes_financieros", "configuracion", "usuarios", "auditoria",
  ],
  facturacion: [
    "ver_dashboard", "facturar", "gestionar_clientes", "cobrar", "gestionar_proveedores", "pagar_proveedores",
    "inventario_operar",
  ],
  operador: ["ver_dashboard", "gestionar_proveedores", "inventario_operar"],
  solo_lectura: ["ver_dashboard"],
};

export function puede(rol: Rol | null | undefined, permiso: Permiso): boolean {
  return rol ? PERMISOS[rol].includes(permiso) : false;
}
