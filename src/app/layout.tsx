import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import { ProveedorTema } from "@/components/app/proveedor-tema";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Unbounded({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: { default: "Tierra Santa", template: "%s · Tierra Santa" },
  description: "Sistema de gestión de Procesadora de Alimentos Tierra Santa",
  icons: { icon: "/logo-tierra-santa.png", apple: "/logo-tierra-santa.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ProveedorTema>
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-center" closeButton />
          </TooltipProvider>
        </ProveedorTema>
      </body>
    </html>
  );
}
