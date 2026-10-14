"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function SelectorTema() {
  const { resolvedTheme, setTheme } = useTheme();
  const oscuro = resolvedTheme !== "light";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={oscuro ? "Modo claro" : "Modo oscuro"}
      onClick={() => setTheme(oscuro ? "light" : "dark")}
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}
