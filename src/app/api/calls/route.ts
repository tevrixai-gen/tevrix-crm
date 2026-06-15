import { NextRequest, NextResponse } from "next/server";
import { and, eq, count, desc, gte, isNotNull, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";

const OUTCOMES = [
  "connected", "not_answered", "callback", "qualified",
  "not_interested", "dnc", "failed", "error",
] as const;
type Outcome = (typeof OUTCOMES)[number];

export async function GET(req: NextRequest) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const outcome = params.get("outcome");
  const campaignId = params.get("campaignId");
  const days = Number(params.get("days") ?? 0);
  const hasRecording = params.get("hasRecording");
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 25)));

  const conditions: SQL[] = [eq(calls.tenantId, tenant!.id)];

  if (outcome && (OUTCOMES as readonly string[]).includes(outcome)) {
    conditions.push(eq(calls.outcome, outcome as Outcome));
  }
  if (campaignId) {
    conditions.push(eq(calls.campaignId, campaignId));
  }
  if (days > 0) {
    conditions.push(gte(calls.createdAt, new Date(Date.now() - days * 86400_000)));
  }
  if (hasRecording === "true") {
    conditions.push(isNotNull(calls.recordingRef));
  }

  const where = and(...conditions);

  const [rows, total] = await Promise.all([
    db.select({
      id: calls.id,
      phone: calls.phone,
      outcome: calls.outcome,
      durationSeconds: calls.durationSeconds,
      summary: calls.summary,
      createdAt: calls.createdAt,
      campaignId: calls.campaignId,
      hasRecording: calls.recordingRef,
    })
      .from(calls)
      .where(where)
      .orderBy(desc(calls.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: count() }).from(calls).where(where),
  ]);

  return NextResponse.json({
    calls: rows.map((r) => ({ ...r, hasRecording: !!r.hasRecording })),
    total: total[0].count,
    page,
    limit,
    totalPages: Math.ceil(total[0].count / limit),
  });
}
