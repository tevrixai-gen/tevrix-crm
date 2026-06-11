import { NextResponse } from "next/server";
import { processPendingInbox } from "@/lib/dograh/projector";

// POST /api/jobs/process-inbox — called by Cloud Tasks or cron
// Processes all pending webhook inbox entries through the projector
export async function POST() {
  // TODO: In production, verify OIDC token from Cloud Tasks/Scheduler
  const count = await processPendingInbox();
  return NextResponse.json({ processed: count });
}
