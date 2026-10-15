import { NextResponse } from "next/server";

import { checkCredentials, sessionCookie } from "@/lib/admin-auth";

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const user = String(form.get("user") ?? "");
  const pass = String(form.get("pass") ?? "");

  if (!checkCredentials(user, pass)) {
    return NextResponse.redirect(new URL("/login?erro=1", req.url));
  }

  const res = NextResponse.redirect(new URL("/admin", req.url));
  res.headers.append("Set-Cookie", sessionCookie());
  return res;
}
