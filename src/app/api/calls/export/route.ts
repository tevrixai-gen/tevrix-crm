import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import type { SQL } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const days = Number(params.get("days") ?? 0);

  const conditions: SQL[] = [eq(calls.tenantId, tenant!.id)];
  if (days > 0) {
    conditions.push(gte(calls.createdAt, new Date(Date.now() - days * 86400_000)));
  }

  const rows = await db
    .select({
      phone: calls.phone,
      outcome: calls.outcome,
      durationSeconds: calls.durationSeconds,
      summary: calls.summary,
      costUsd: calls.costUsd,
      createdAt: calls.createdAt,
    })
    .from(calls)
    .where(and(...conditions))
    .orderBy(desc(calls.createdAt));

  const header = "Phone,Outcome,Duration (s),Summary,Cost (USD),Date";
  const csvRows = rows.map((r) =>
    [
      r.phone,
      r.outcome ?? "",
      r.durationSeconds ?? "",
      csvEscape(r.summary ?? ""),
      r.costUsd ?? "",
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
    ].join(",")
  );

  const csv = [header, ...csvRows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calls-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
