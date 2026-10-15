import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { checkCredentials, sessionCookie, verifySession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Entrar" };

interface LoginPageProps {
  searchParams: Promise<{ erro?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const erro = sp.erro;

  // já logado? vai direto pro painel
  const cookies = (await import("next/headers")).cookies;
  const token = (await cookies()).get("flow_admin")?.value;
  if (verifySession(token)) redirect("/admin");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-ink">Acesso restrito</h1>
        <p className="mt-1 text-sm text-muted">Entre com as credenciais do painel.</p>

        {erro ? (
          <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">
            Usuário ou senha incorretos.
          </p>
        ) : null}

        <form action="/api/admin/login" method="post" className="mt-6 space-y-4">
          <div>
            <label htmlFor="user" className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
              Usuário
            </label>
            <input
              id="user"
              name="user"
              autoComplete="username"
              required
              className="w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="pass" className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
              Senha
            </label>
            <input
              id="pass"
              name="pass"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-strong"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
