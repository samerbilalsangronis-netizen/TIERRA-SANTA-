"use client";
import { ThemeProvider } from "next-themes";

/** Modo oscuro por defecto, con opción de claro (se recuerda por navegador). */
export function ProveedorTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
