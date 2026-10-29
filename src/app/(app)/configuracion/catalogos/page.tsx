import type { Metadata } from "next";
import Link from "next/link";
import { Coins, CreditCard, MapPin, Package, Receipt, Ruler, Wrench } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Catálogos" };

export default async function PaginaCatalogos() {
  await exigirPerfil("configuracion");
  const supabase = await crearClienteServidor();
  const contar = async (t: "productos" | "unidades" | "ubicaciones" | "monedas" | "metodos_pago" | "tareas_nomina" | "conceptos_gasto") =>
    (await supabase.from(t).select("*", { count: "exact", head: true })).count ?? 0;
  const [p, u, ub, m, mp, t, g] = await Promise.all(
    (["productos", "unidades", "ubicaciones", "monedas", "metodos_pago", "tareas_nomina", "conceptos_gasto"] as const).map(contar),
  );
  const tarjetas = [
    { href: "productos", titulo: "Productos / rubros", texto: "Código numérico para facturar, unidad, pesaje FIJO/VARIABLE y stock mínimo.", n: p, icono: Package },
    { href: "unidades", titulo: "Unidades", texto: "kg, unidad, cesta, caja, bolsa…", n: u, icono: Ruler },
    { href: "ubicaciones", titulo: "Ubicaciones", texto: "Planta, galpón, otra sede y cuartos fríos.", n: ub, icono: MapPin },
    { href: "monedas", titulo: "Monedas y tasas", texto: "USD, COP, VES y tasas de cambio informativas.", n: m, icono: Coins },
    { href: "metodos-pago", titulo: "Métodos de pago", texto: "Efectivo, transferencia, Zelle, Bancolombia…", n: mp, icono: CreditCard },
    { href: "tareas", titulo: "Tareas de nómina", texto: "Tareas a destajo con su precio por unidad.", n: t, icono: Wrench },
    { href: "gastos", titulo: "Conceptos de gastos", texto: "Guantes, aditivos, gasolina… agrupados por categoría.", n: g, icono: Receipt },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tarjetas.map((c) => (
        <Link key={c.href} href={`/configuracion/catalogos/${c.href}`} className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between">
            <c.icono className="size-5 text-primary" />
            <span className="tabular rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{c.n}</span>
          </div>
          <p className="mt-3 font-semibold group-hover:text-primary">{c.titulo}</p>
          <p className="text-sm text-muted-foreground">{c.texto}</p>
        </Link>
      ))}
    </div>
  );
}
