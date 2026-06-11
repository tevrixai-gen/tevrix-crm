import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getTenantByUserId } from "@/lib/db/tenant-repo";
import { createDograhClient } from "@/lib/dograh/client";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getTenantByUserId(session.user.id);
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 404 });

  if (!tenant.dograhApiKeyCiphertext || !tenant.dograhWorkflowId) {
    return NextResponse.json(
      { error: "Your agent is not yet connected to the voice engine. Contact support." },
      { status: 400 }
    );
  }

  if (tenant.status === "paused") {
    return NextResponse.json({ error: "Account is paused" }, { status: 403 });
  }

  const body = await req.json();
  const { phoneNumber } = body;

  if (!phoneNumber) {
    return NextResponse.json({ error: "phoneNumber required" }, { status: 400 });
  }

  const dograhBaseUrl = process.env.DOGRAH_API_BASE_URL ?? "http://localhost:8000";
  const client = createDograhClient(dograhBaseUrl, tenant.dograhApiKeyCiphertext);

  try {
    const result = await client.triggerTestCall(tenant.dograhWorkflowId, {
      phone_number: phoneNumber,
      initial_context: {
        company_name: tenant.companyName,
        test_call: true,
      },
    });

    return NextResponse.json({
      ok: true,
      runId: result.workflow_run_id,
      message: `Test call initiated to ${phoneNumber}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Call initiation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
