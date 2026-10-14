"use client";

import { useEffect, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/ui/icons";

// Alterna a classe .dark no <html> e persiste a escolha.
// O script inline no layout aplica o tema antes do primeiro paint
// (sem flash); este componente só reflete e alterna.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("flow-theme", next ? "dark" : "light");
    } catch {
      /* armazenamento indisponível — tema vale só para a sessão */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={dark ? "Modo claro" : "Modo escuro"}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
