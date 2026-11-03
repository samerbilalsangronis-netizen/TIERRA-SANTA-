# Tierra Santa · instrucciones para agentes (Codex, Claude Code y otros)

**Antes de hacer cualquier cosa, lee [`HANDOFF.md`](HANDOFF.md) completo.** Ahí está qué es
el sistema, cómo funciona cada módulo, cómo se despliega, cómo se cambia la base de datos,
cómo se prueba y **por dónde quedamos** (§1). Las reglas de negocio están en
[`DECISIONES.md`](DECISIONES.md).

Lo esencial:
- Todo en **español**: interfaz, nombres en el código, commits y documentación.
- El dueño (Samer) **no programa**. Aplica los cambios de la base de datos pegando el SQL en
  Supabase → SQL Editor. **Nunca edites una migración ya aplicada**: crea una nueva en
  `supabase/migrations/` (reglas en HANDOFF §6) y dale el enlace del archivo.
- La rama **`claude/tender-curie-r25soh` es producción**: Vercel publica cada push. Prueba
  antes (HANDOFF §11).
- Next.js 16 tiene cambios incompatibles con lo que conoces (ver el bloque de abajo).
- Nada de datos reales (nombres, montos, exportaciones) en el repositorio.
- Al terminar: actualiza HANDOFF.md §1 (por dónde quedamos), la tabla de migraciones (§6) y
  la bitácora (§15).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
