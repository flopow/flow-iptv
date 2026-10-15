import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/admin-auth";

export async function GET(req: Request): Promise<Response> {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.headers.append("Set-Cookie", clearSessionCookie());
  return res;
}
