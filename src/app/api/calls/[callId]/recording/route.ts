import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";

// GET /api/calls/[callId]/recording — returns a short-lived playback URL.
// The ref is resolved on demand and never stored client-side. In production
// this mints a signed GCS URL; locally the engine's URL is passed through.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const { callId } = await params;
  const rows = await db
    .select({ recordingRef: calls.recordingRef })
    .from(calls)
    .where(and(eq(calls.id, callId), eq(calls.tenantId, tenant!.id)))
    .limit(1);

  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!rows[0].recordingRef) {
    return NextResponse.json({ error: "No recording for this call" }, { status: 404 });
  }

  // TODO(prod): exchange gs:// refs for a signed URL with a 15-minute expiry.
  return NextResponse.json({ url: rows[0].recordingRef, expiresInSeconds: 900 });
}
