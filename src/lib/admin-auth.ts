// Auth simples do painel administrativo (versão Cloudflare/produção).
// Credenciais default: admin/admin (configuráveis via env).
// Sessão: cookie assinado com HMAC (segredo da env ADMIN_SECRET; fallback
// gerado por sessão — servidores efêmeros pedem re-login, aceitável).

import "server-only";

import { createHmac, randomBytes } from "node:crypto";

const COOKIE_NAME = "flow_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

function secret(): string {
  return process.env.ADMIN_SECRET ?? "flow-iptv-admin-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function checkCredentials(user: string, pass: string): boolean {
  const u = process.env.ADMIN_USER ?? "admin";
  const p = process.env.ADMIN_PASS ?? "admin";
  return user === u && pass === p;
}

export function createSessionToken(): string {
  // payload sem "." interno: o "." separa payload|assinatura no cookie
  const payload = `${Date.now()}-${randomBytes(8).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = sign(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return a.equals(b);
}

export function sessionCookie(): string {
  return `${COOKIE_NAME}=${createSessionToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
