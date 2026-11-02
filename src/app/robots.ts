import type { MetadataRoute } from "next";

/** Sistema interno: que ningún buscador lo recorra ni lo muestre. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
