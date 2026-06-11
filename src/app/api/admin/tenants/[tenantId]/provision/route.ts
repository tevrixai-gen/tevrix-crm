import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/require-staff";
import { getTenantById } from "@/lib/db/tenant-repo";
import { runProvisioning } from "@/lib/dograh/provisioning";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { error, session } = await requireStaff();
  if (error) return error;

  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!tenant.dograhApiKeyCiphertext || !tenant.dograhOrgId) {
    return NextResponse.json(
      { error: "Map Dograh org and API key before provisioning" },
      { status: 400 }
    );
  }

  const dograhBaseUrl = process.env.DOGRAH_API_BASE_URL ?? "http://localhost:8000";
  const result = await runProvisioning(tenantId, session!.user.id, dograhBaseUrl);

  if (result.success) {
    return NextResponse.json({ ok: true, status: "ready" });
  }

  return NextResponse.json(
    { error: result.error, failedStep: result.failedStep },
    { status: 500 }
  );
}
