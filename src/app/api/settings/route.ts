import { NextRequest, NextResponse } from "next/server";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { getTenantById, updateTenant } from "@/lib/db/tenant-repo";
import { writeAudit } from "@/lib/db/audit";

export async function GET() {
  const { error, tenant } = await requireTenantApi({ allowPaused: true });
  if (error) return error;

  const row = await getTenantById(tenant!.id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    companyName: row.companyName,
    companyWebsite: row.companyWebsite,
    industry: row.industry,
    dltEntityId: row.dltEntityId,
    callingWindowStart: row.callingWindowStart,
    callingWindowEnd: row.callingWindowEnd,
    timezone: row.timezone,
    planTier: row.planTier,
    escalationNumber: row.escalationNumber,
    escalationRule: row.escalationRule,
    valuePerQualifiedLead: row.valuePerQualifiedLead,
    costPerMinute: row.costPerMinute,
    avgHumanCallMinutes: row.avgHumanCallMinutes,
  });
}

const ALLOWED_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Pacific/Auckland",
  "Australia/Sydney",
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function PATCH(req: NextRequest) {
  const { error, tenant, userId } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if ("companyName" in body) patch.companyName = String(body.companyName).trim() || null;
  if ("companyWebsite" in body) patch.companyWebsite = String(body.companyWebsite).trim() || null;
  if ("industry" in body) patch.industry = String(body.industry).trim() || null;
  if ("dltEntityId" in body) patch.dltEntityId = String(body.dltEntityId).trim() || null;

  if ("callingWindowStart" in body) {
    const v = String(body.callingWindowStart);
    if (!TIME_RE.test(v)) return NextResponse.json({ error: "Invalid start time (HH:MM)" }, { status: 400 });
    patch.callingWindowStart = v;
  }
  if ("callingWindowEnd" in body) {
    const v = String(body.callingWindowEnd);
    if (!TIME_RE.test(v)) return NextResponse.json({ error: "Invalid end time (HH:MM)" }, { status: 400 });
    patch.callingWindowEnd = v;
  }
  if ("timezone" in body) {
    if (!ALLOWED_TIMEZONES.includes(body.timezone)) {
      return NextResponse.json({ error: "Unsupported timezone" }, { status: 400 });
    }
    patch.timezone = body.timezone;
  }

  // Escalation fields
  if ("escalationNumber" in body) {
    const v = String(body.escalationNumber).trim();
    if (v && !/^\+\d{7,15}$/.test(v)) {
      return NextResponse.json({ error: "Escalation number must be E.164 format (+91...)" }, { status: 400 });
    }
    patch.escalationNumber = v || null;
  }
  if ("escalationRule" in body) {
    const allowed = ["off", "on_qualified", "on_request", "on_keyword"];
    if (!allowed.includes(body.escalationRule)) {
      return NextResponse.json({ error: `Escalation rule must be one of: ${allowed.join(", ")}` }, { status: 400 });
    }
    patch.escalationRule = body.escalationRule;
  }

  // ROI inputs
  if ("valuePerQualifiedLead" in body) {
    const v = Number(body.valuePerQualifiedLead);
    if (isNaN(v) || v < 0) return NextResponse.json({ error: "Invalid value per qualified lead" }, { status: 400 });
    patch.valuePerQualifiedLead = String(v);
  }
  if ("costPerMinute" in body) {
    const v = Number(body.costPerMinute);
    if (isNaN(v) || v < 0) return NextResponse.json({ error: "Invalid cost per minute" }, { status: 400 });
    patch.costPerMinute = String(v);
  }
  if ("avgHumanCallMinutes" in body) {
    const v = Number(body.avgHumanCallMinutes);
    if (isNaN(v) || v <= 0) return NextResponse.json({ error: "Invalid avg human call minutes" }, { status: 400 });
    patch.avgHumanCallMinutes = String(v);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const before = {
    companyName: tenant!.companyName,
    companyWebsite: tenant!.companyWebsite,
    industry: tenant!.industry,
    callingWindowStart: tenant!.callingWindowStart,
    callingWindowEnd: tenant!.callingWindowEnd,
    timezone: tenant!.timezone,
  };

  const updated = await updateTenant(tenant!.id, patch as Parameters<typeof updateTenant>[1]);

  await writeAudit({
    tenantId: tenant!.id,
    actorId: userId!,
    action: "update_settings",
    resourceType: "tenant",
    resourceId: tenant!.id,
    before,
    after: patch,
  });

  return NextResponse.json({ ok: true, updated });
}
