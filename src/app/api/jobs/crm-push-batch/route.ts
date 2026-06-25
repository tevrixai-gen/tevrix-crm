import { NextResponse } from "next/server";
import { eq, or, and, lte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmSyncEvents } from "@/lib/db/schema";

export async function POST() {
  const pending = await db
    .select({ id: crmSyncEvents.id })
    .from(crmSyncEvents)
    .where(
      or(
        eq(crmSyncEvents.status, "pending"),
        and(
          eq(crmSyncEvents.status, "failed"),
          or(
            isNull(crmSyncEvents.lastAttemptAt),
            lte(crmSyncEvents.lastAttemptAt, new Date(Date.now() - 60_000))
          )
        )
      )
    )
    .limit(50);

  let succeeded = 0;
  let failed = 0;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  for (const event of pending) {
    try {
      const res = await fetch(`${baseUrl}/api/jobs/crm-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncEventId: event.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) succeeded++;
        else failed++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ total: pending.length, succeeded, failed });
}
