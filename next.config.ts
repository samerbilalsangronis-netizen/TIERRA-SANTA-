import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VISTA_PREVIA_LECTURA: process.env.VERCEL_ENV === "preview" ? "1" : "0",
  },
  // Toda la app es privada y depende de la sesión: se renderiza por petición.
  // (Ver DECISIONES.md · "Cache Components desactivado")
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  // El PDF de la factura lee el logo por defecto desde public/
  outputFileTracingIncludes: {
    "/facturacion/[id]/pdf": ["./public/logo-tierra-santa-negro.png", "./public/sello-tierra-santa.png"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    agentUpgrade: "security",
  },
};

export default nextConfig;
