import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, or, count, desc, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { normalizePhone } from "@/lib/phone";
import { createLeadSchema } from "@/lib/schemas/lead";

const LEAD_STATUSES = [
  "new", "queued", "calling", "connected", "not_answered",
  "callback", "qualified", "not_interested", "dnc", "failed",
] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];

export async function GET(req: NextRequest) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const search = params.get("search")?.trim() ?? "";
  const status = params.get("status");
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 25)));

  const conditions: SQL[] = [eq(leads.tenantId, tenant!.id)];

  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    conditions.push(eq(leads.status, status as LeadStatus));
  }
  if (search) {
    const pattern = `%${search}%`;
    const searchCond = or(
      ilike(leads.name, pattern),
      ilike(leads.phone, pattern),
      ilike(leads.email, pattern)
    );
    if (searchCond) conditions.push(searchCond);
  }

  const where = and(...conditions);

  const [rows, total] = await Promise.all([
    db.select().from(leads).where(where)
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: count() }).from(leads).where(where),
  ]);

  return NextResponse.json({
    leads: rows,
    total: total[0].count,
    page,
    limit,
    totalPages: Math.ceil(total[0].count / limit),
  });
}

export async function POST(req: NextRequest) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const parsed = createLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { phone, name, email, tags } = parsed.data;

  const normalized = normalizePhone(phone);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const inserted = await db
    .insert(leads)
    .values({
      tenantId: tenant!.id,
      phone: normalized.e164!,
      name: name?.trim() || null,
      email: email?.trim() || null,
      tags: Array.isArray(tags) ? tags : [],
    })
    .onConflictDoNothing({ target: [leads.tenantId, leads.phone] })
    .returning({ id: leads.id });

  if (inserted.length === 0) {
    return NextResponse.json(
      { error: "A lead with this phone number already exists" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, id: inserted[0].id }, { status: 201 });
}
