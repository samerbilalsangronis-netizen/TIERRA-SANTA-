import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
