import { NextRequest, NextResponse } from "next/server";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { createDograhClient } from "@/lib/dograh/client";

export async function POST(req: NextRequest) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  if (!tenant!.dograhApiKeyCiphertext || !tenant!.dograhWorkflowId) {
    return NextResponse.json(
      { error: "Your agent is not yet connected to the voice engine. Contact support." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { phoneNumber } = body;

  if (!phoneNumber) {
    return NextResponse.json({ error: "phoneNumber required" }, { status: 400 });
  }

  try {
    const dograhBaseUrl = process.env.DOGRAH_API_BASE_URL ?? "http://localhost:8000";
    const client = createDograhClient(dograhBaseUrl, tenant!.dograhApiKeyCiphertext);

    const workflowUuid = await client.resolveWorkflowUuid(tenant!.dograhWorkflowId);
    const result = await client.triggerTestCall(workflowUuid, {
      phone_number: phoneNumber,
      initial_context: {
        company_name: tenant!.companyName,
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
