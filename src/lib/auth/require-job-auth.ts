import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export function requireJobAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.JOBS_SHARED_SECRET;
  if (!secret) return null; // no secret configured — allow (dev mode)

  const header = req.headers.get("x-jobs-secret") ?? "";
  if (
    header.length !== secret.length ||
    !timingSafeEqual(Buffer.from(header), Buffer.from(secret))
  ) {
    return UNAUTHORIZED;
  }
  return null;
}
