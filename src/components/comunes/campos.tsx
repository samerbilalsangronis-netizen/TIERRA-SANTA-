import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BaseCampo = { etiqueta: string; error?: string; ayuda?: React.ReactNode; requerido?: boolean; className?: string };

function Envoltura({ id, etiqueta, error, ayuda, requerido, className, children }: BaseCampo & { id: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {etiqueta}
        {requerido && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>
      ) : ayuda ? (
        <p className="text-xs text-muted-foreground">{ayuda}</p>
      ) : null}
    </div>
  );
}

export const CampoTexto = React.forwardRef<HTMLInputElement, BaseCampo & React.ComponentProps<"input">>(
  function CampoTexto({ etiqueta, error, ayuda, requerido, className, id, ...props }, ref) {
    const generado = React.useId();
    const idCampo = id ?? generado;
    return (
      <Envoltura id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda} requerido={requerido} className={className}>
        <Input id={idCampo} ref={ref} aria-invalid={!!error} aria-describedby={error ? `${idCampo}-error` : undefined} {...props} />
      </Envoltura>
    );
  },
);

export const CampoArea = React.forwardRef<HTMLTextAreaElement, BaseCampo & React.ComponentProps<"textarea">>(
  function CampoArea({ etiqueta, error, ayuda, requerido, className, id, ...props }, ref) {
    const generado = React.useId();
    const idCampo = id ?? generado;
    return (
      <Envoltura id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda} requerido={requerido} className={className}>
        <Textarea id={idCampo} ref={ref} aria-invalid={!!error} {...props} />
      </Envoltura>
    );
  },
);

/** Select nativo con el estilo de los inputs (mejor experiencia en celular). */
export const SelectNativo = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  function SelectNativo({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-10 sm:h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 [&>option]:bg-popover",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export const CampoSelect = React.forwardRef<HTMLSelectElement, BaseCampo & React.ComponentProps<"select">>(
  function CampoSelect({ etiqueta, error, ayuda, requerido, className, id, children, ...props }, ref) {
    const generado = React.useId();
    const idCampo = id ?? generado;
    return (
      <Envoltura id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda} requerido={requerido} className={className}>
        <SelectNativo id={idCampo} ref={ref} aria-invalid={!!error} {...props}>{children}</SelectNativo>
      </Envoltura>
    );
  },
);
