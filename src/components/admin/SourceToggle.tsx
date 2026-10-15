"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SourceName } from "@/lib/sources";

interface SourceToggleProps {
  name: SourceName;
  label: string;
  active: boolean;
}

export function SourceToggle({ name, label, active }: SourceToggleProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [name]: !active }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-xs text-muted">{active ? "Ativa" : "Desativada"}</p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={active}
        className={`relative h-6 w-11 flex-none rounded-full transition-colors disabled:opacity-50 ${
          active ? "bg-accent" : "bg-surface-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            active ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </li>
  );
}
