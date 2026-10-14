"use client";
import { useRef, useState } from "react";
import { Camera, ImageOff, Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearClienteNavegador } from "@/lib/supabase/client";

/** Reduce la foto en el teléfono antes de subirla (máx. 1600 px, JPEG). */
async function comprimir(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith("image/") || archivo.type === "image/heic") return archivo;
  const bitmap = await createImageBitmap(archivo).catch(() => null);
  if (!bitmap) return archivo;
  const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  return await new Promise((ok) => lienzo.toBlob((b) => ok(b ?? archivo), "image/jpeg", 0.82));
}

/**
 * Foto de la entrega: se toma con la cámara del teléfono (o se elige un archivo)
 * y se sube directo a Supabase Storage. También se acepta una URL.
 */
export function SubirFoto({
  proveedorId, ruta, url, vistaPrevia, onCambio,
}: {
  proveedorId: number; ruta: string | null; url: string | null; vistaPrevia: string | null;
  onCambio: (v: { ruta: string | null; url: string | null }) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [previa, setPrevia] = useState<string | null>(vistaPrevia ?? url);
  const [modoUrl, setModoUrl] = useState(Boolean(url && !ruta));

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    try {
      const blob = await comprimir(archivo);
      const ext = blob.type === "image/jpeg" ? "jpg" : (archivo.name.split(".").pop() ?? "jpg").toLowerCase();
      const destino = `${proveedorId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await crearClienteNavegador().storage.from("entregas").upload(destino, blob, {
        contentType: blob.type || archivo.type, upsert: false,
      });
      if (error) throw error;
      setPrevia(URL.createObjectURL(blob));
      onCambio({ ruta: destino, url: null });
      toast.success("Foto subida.");
    } catch (err) {
      toast.error(`No se pudo subir la foto: ${err instanceof Error ? err.message : "error"}`);
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>Foto de la entrega</Label>
      <div className="flex items-start gap-3">
        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
          {subiendo ? <Loader2 className="size-5 animate-spin text-muted-foreground" />
            : previa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previa} alt="Foto de la entrega" className="size-full object-cover" />
            ) : <ImageOff className="size-5 text-muted-foreground" />}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <input ref={entrada} type="file" accept="image/*" capture="environment" className="hidden" onChange={elegir} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={subiendo} onClick={() => entrada.current?.click()}>
              <Camera className="size-4" /> {previa ? "Cambiar foto" : "Tomar / subir foto"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setModoUrl((v) => !v)}>
              <Link2 className="size-4" /> URL
            </Button>
            {(previa || ruta || url) && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive"
                onClick={() => { setPrevia(null); onCambio({ ruta: null, url: null }); }}>
                <X className="size-4" /> Quitar
              </Button>
            )}
          </div>
          {modoUrl && (
            <Input placeholder="https://…" defaultValue={url ?? ""}
              onChange={(e) => { const v = e.target.value.trim(); setPrevia(v || null); onCambio({ ruta: null, url: v || null }); }} />
          )}
        </div>
      </div>
    </div>
  );
}
