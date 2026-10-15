import { NextRequest, NextResponse } from "next/server";

// Protege o painel administrativo: sem sessão válida → /login.
// Verificação com Web Crypto (funciona em Edge/Workers, sem node:crypto).
async function verifyToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [payload, , sig] = parts;
  const secret = process.env.ADMIN_SECRET ?? "flow-iptv-admin-dev-secret";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const expected = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expectedHex = [...new Uint8Array(expected)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return expectedHex === sig;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get("flow_admin")?.value;
  if (await verifyToken(token)) return NextResponse.next();
  const url = new URL("/login", req.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
