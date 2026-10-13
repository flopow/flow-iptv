// ─────────────────────────────────────────────────────────────
// FLOW IPTV — cliente Supabase
//
// createServerClient  → roda no servidor (server components, rotas,
//                       painel). Usa anon key; se SUPABASE_SERVICE_ROLE_KEY
//                       estiver presente, usa service role (operações
//                       administrativas validadas no servidor).
// createBrowserClient → usado em componentes client (login, histórico).
//
// O tipo Database tipa cada consulta com os Row types de
// src/lib/database.ts — nenhum cast inline em dados externos.
// ─────────────────────────────────────────────────────────────

import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { hasSupabaseEnv } from "@/lib/catalog";
import type { Database } from "@/lib/database";

export type { SupabaseClient, Database };

export function createServerClient(): SupabaseClient<Database> {
  if (!hasSupabaseEnv()) {
    throw new Error(
      "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local.",
    );
  }
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false } },
  );
}

export function createBrowserClient(): SupabaseClient<Database> {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase não configurado no cliente.");
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
