import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calls, leads } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const { callId } = await params;
  const rows = await db
    .select()
    .from(calls)
    .where(and(eq(calls.id, callId), eq(calls.tenantId, tenant!.id)))
    .limit(1);

  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Strip staff-only fields from the client payload
  const call: Partial<typeof rows[0]> = { ...rows[0] };
  delete call.costUsd;
  return NextResponse.json({ call: { ...call, hasRecording: !!rows[0].recordingRef } });
}

// PATCH — one-click actions from the call detail screen. Each action updates
// the linked lead (matched by phone when no leadId), keeping lead state the
// single source of truth.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const { callId } = await params;
  const body = await req.json();
  const action = body.action as string;

  const ACTION_TO_STATUS: Record<string, "qualified" | "callback" | "dnc"> = {
    mark_qualified: "qualified",
    schedule_followup: "callback",
    do_not_call: "dnc",
  };

  const newStatus = ACTION_TO_STATUS[action];
  if (!newStatus) {
    return NextResponse.json(
      { error: `action must be one of: ${Object.keys(ACTION_TO_STATUS).join(", ")}` },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(calls)
    .where(and(eq(calls.id, callId), eq(calls.tenantId, tenant!.id)))
    .limit(1);

  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const call = rows[0];

  const leadUpdates = {
    status: newStatus,
    isDnc: newStatus === "dnc" ? true : undefined,
    updatedAt: new Date(),
  };

  if (call.leadId) {
    await db
      .update(leads)
      .set(leadUpdates)
      .where(and(eq(leads.id, call.leadId), eq(leads.tenantId, tenant!.id)));
  } else if (call.phone) {
    await db
      .update(leads)
      .set(leadUpdates)
      .where(and(eq(leads.tenantId, tenant!.id), eq(leads.phone, call.phone)));
  }

  // Reflect the disposition on the call itself for list filtering
  await db
    .update(calls)
    .set({ outcome: newStatus })
    .where(eq(calls.id, call.id));

  return NextResponse.json({ ok: true, leadStatus: newStatus });
}
