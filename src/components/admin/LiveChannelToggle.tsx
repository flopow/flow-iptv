"use client";

import { useState } from "react";

interface LiveChannelToggleProps {
  id: string;
  name: string;
  category: string;
  src: string;
  active: boolean;
}

// Toggle de canal ao vivo: ativa/desativa no painel admin.
// O estado é persistido via API (commit + push → deploy).
export function LiveChannelToggle({ id, name, category, src, active }: LiveChannelToggleProps) {
  const [enabled, setEnabled] = useState(active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    const next = !enabled;
    try {
      const res = await fetch("/api/admin/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: next }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "falha ao alternar");
      setEnabled(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "falha ao alternar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-xl border border-line bg-background p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          className={`relative h-6 w-11 flex-none rounded-full transition-colors ${
            enabled ? "bg-emerald-500" : "bg-surface-strong"
          } ${saving ? "opacity-60" : ""}`}
          aria-label={`${enabled ? "Desativar" : "Ativar"} ${name}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted">
            {category} · {src}
          </p>
        </div>
        <span
          className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-black ${
            enabled ? "bg-emerald-100 text-emerald-800" : "bg-surface-strong text-muted"
          }`}
        >
          {enabled ? "ATIVO" : "OFF"}
        </span>
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-error">{error}</p> : null}
    </li>
  );
}
