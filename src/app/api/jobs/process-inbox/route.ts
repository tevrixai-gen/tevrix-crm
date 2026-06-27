import { NextRequest, NextResponse } from "next/server";
import { processPendingInbox } from "@/lib/dograh/projector";
import { requireJobAuth } from "@/lib/auth/require-job-auth";

export async function POST(req: NextRequest) {
  const authError = requireJobAuth(req);
  if (authError) return authError;

  const count = await processPendingInbox();
  return NextResponse.json({ processed: count });
}
