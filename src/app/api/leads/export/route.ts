import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";

export async function GET(_req: NextRequest) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const rows = await db
    .select({
      phone: leads.phone,
      name: leads.name,
      email: leads.email,
      status: leads.status,
      isDnc: leads.isDnc,
      tags: leads.tags,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(eq(leads.tenantId, tenant!.id))
    .orderBy(desc(leads.createdAt));

  const header = "Phone,Name,Email,Status,DNC,Tags,Created At";
  const csvRows = rows.map((r) =>
    [
      r.phone,
      csvEscape(r.name ?? ""),
      csvEscape(r.email ?? ""),
      r.status,
      r.isDnc ? "Yes" : "No",
      csvEscape((r.tags as string[])?.join("; ") ?? ""),
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
    ].join(",")
  );

  const csv = [header, ...csvRows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
