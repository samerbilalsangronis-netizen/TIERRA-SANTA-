import Image from "next/image";
import { LOGO_POR_DEFECTO_NEGRO, urlLogo } from "@/lib/empresa";

export type EmpresaHoja = { razon_social: string; rif: string; direccion: string; telefonos: string; logo_path: string | null } | null;

/** Hoja blanca lista para imprimir o guardar como PDF (igual en pantalla y en papel). */
export function Hoja({ children }: { children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-4xl rounded-xl bg-white p-5 text-[13px] text-neutral-900 shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none sm:p-8">
      {children}
    </article>
  );
}

export function EncabezadoHoja({ empresa, titulo, lineas }: { empresa: EmpresaHoja; titulo: React.ReactNode; lineas: React.ReactNode[] }) {
  const logo = empresa?.logo_path ? urlLogo(empresa.logo_path) : LOGO_POR_DEFECTO_NEGRO;
  return (
    <header className="flex flex-col gap-4 border-b border-neutral-300 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-24 shrink-0">
          <Image src={logo} alt="" fill sizes="96px" className="object-contain" unoptimized={logo.startsWith("http")} />
        </div>
        <div className="leading-tight">
          <p className="text-base font-bold">{empresa?.razon_social}</p>
          <p className="text-xs text-neutral-600">{[empresa?.rif, empresa?.telefonos].filter(Boolean).join(" · ")}</p>
          {empresa?.direccion && <p className="text-xs text-neutral-600">{empresa.direccion}</p>}
        </div>
      </div>
      <div className="sm:text-right">
        <p className="text-lg font-bold tracking-wide text-neutral-900">{titulo}</p>
        {lineas.filter(Boolean).map((l, i) => <p key={i} className="text-xs text-neutral-600">{l}</p>)}
      </div>
    </header>
  );
}
