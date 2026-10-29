import {
  BarChart3, Boxes, FileText, LayoutDashboard, Receipt, Settings, Truck, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Permiso } from "@/lib/auth/roles";

export type ItemNavegacion = { titulo: string; href: string; icono: LucideIcon; permiso: Permiso };

export const NAVEGACION: ItemNavegacion[] = [
  { titulo: "Dashboard", href: "/dashboard", icono: LayoutDashboard, permiso: "ver_dashboard" },
  { titulo: "Facturación", href: "/facturacion", icono: FileText, permiso: "facturar" },
  { titulo: "Clientes", href: "/clientes", icono: Users, permiso: "ver_dashboard" },
  { titulo: "Proveedores", href: "/proveedores", icono: Truck, permiso: "ver_dashboard" },
  { titulo: "Inventario", href: "/inventario", icono: Boxes, permiso: "ver_dashboard" },
  { titulo: "Gastos", href: "/gastos", icono: Receipt, permiso: "ver_dashboard" },
  { titulo: "Nómina", href: "/nomina", icono: Wallet, permiso: "nomina" },
  { titulo: "Reportes", href: "/reportes", icono: BarChart3, permiso: "ver_dashboard" },
  { titulo: "Configuración", href: "/configuracion", icono: Settings, permiso: "ver_dashboard" },
];
