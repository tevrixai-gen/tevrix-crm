import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";

const EDITABLE_STATUSES = [
  "new", "callback", "qualified", "not_interested", "dnc",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const { leadId } = await params;
  const body = await req.json();

  // Tenant-scoped fetch — foreign tenant's lead is a 404, never a 403.
  const existing = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenant!.id)))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.name === "string") updates.name = body.name.trim() || null;
  if (typeof body.email === "string") updates.email = body.email.trim() || null;
  if (Array.isArray(body.tags)) updates.tags = body.tags;

  if (typeof body.isDnc === "boolean") {
    updates.isDnc = body.isDnc;
    if (body.isDnc) updates.status = "dnc";
  }

  if (typeof body.status === "string") {
    if (!(EDITABLE_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${EDITABLE_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.status = body.status;
    if (body.status === "dnc") updates.isDnc = true;
  }

  await db
    .update(leads)
    .set(updates)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenant!.id)));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const { leadId } = await params;

  const deleted = await db
    .delete(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenant!.id)))
    .returning({ id: leads.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
