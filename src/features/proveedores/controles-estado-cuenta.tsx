"use client";
import { usePathname, useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/comunes/campos";

export function BotonImprimir() {
  return (
    <Button onClick={() => window.print()} title="Imprimir o guardar como PDF">
      <Printer className="size-4" /> Imprimir / PDF
    </Button>
  );
}

export function FiltrosEstadoCuenta({ moneda, desde, hasta, monedas }: { moneda: string; desde: string; hasta: string; monedas: string[] }) {
  const router = useRouter();
  const ruta = usePathname();
  const ir = (c: Partial<{ moneda: string; desde: string; hasta: string }>) => {
    const f = { moneda, desde, hasta, ...c };
    router.replace(`${ruta}?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SelectNativo value={moneda} onChange={(e) => ir({ moneda: e.target.value })} className="h-9 w-24" aria-label="Moneda">
        {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
      </SelectNativo>
      <Input type="date" value={desde} onChange={(e) => ir({ desde: e.target.value })} className="h-9 w-[9.5rem]" aria-label="Desde" />
      <Input type="date" value={hasta} onChange={(e) => ir({ hasta: e.target.value })} className="h-9 w-[9.5rem]" aria-label="Hasta" />
    </div>
  );
}
