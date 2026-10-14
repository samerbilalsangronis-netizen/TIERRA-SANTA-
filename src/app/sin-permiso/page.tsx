import Link from "next/link";
import { ShieldX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function SinPermiso() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <ShieldX className="size-7" />
      </div>
      <h1 className="font-heading text-xl font-bold">Sin permiso</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Tu rol no tiene acceso a esta sección. Si lo necesitas, pídeselo al administrador.</p>
      <Link href="/dashboard" className={buttonVariants()}>Volver al inicio</Link>
    </main>
  );
}
