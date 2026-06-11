// API-route guard: resolves the caller's tenant (including staff
// impersonation) or returns a JSON error response. Never trusts a tenantId
// from the request — the session is the only source of tenant identity.

import { headers, cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "./index";
import { getTenantByUserId, getTenantById } from "@/lib/db/tenant-repo";
import type { tenants } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type Tenant = InferSelectModel<typeof tenants>;

interface TenantApiContext {
  error: NextResponse | null;
  tenant: Tenant | null;
  userId: string | null;
  isImpersonating: boolean;
}

export async function requireTenantApi(options?: {
  /** Block writes when the tenant is paused (default true for mutations). */
  allowPaused?: boolean;
}): Promise<TenantApiContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      tenant: null,
      userId: null,
      isImpersonating: false,
    };
  }

  const isStaff = (session.user as { isStaff?: boolean }).isStaff === true;
  let tenant: Tenant | null = null;
  let isImpersonating = false;

  if (isStaff) {
    const cookieStore = await cookies();
    const imp = cookieStore.get("impersonation");
    if (!imp) {
      return {
        error: NextResponse.json(
          { error: "Staff must impersonate a tenant to use tenant APIs" },
          { status: 403 }
        ),
        tenant: null,
        userId: session.user.id,
        isImpersonating: false,
      };
    }
    const data = JSON.parse(imp.value) as { tenantId: string };
    tenant = await getTenantById(data.tenantId);
    isImpersonating = true;
  } else {
    tenant = await getTenantByUserId(session.user.id);
  }

  if (!tenant) {
    return {
      error: NextResponse.json({ error: "No tenant" }, { status: 404 }),
      tenant: null,
      userId: session.user.id,
      isImpersonating,
    };
  }

  if (options?.allowPaused === false && tenant.status === "paused") {
    return {
      error: NextResponse.json(
        { error: "Your account is paused. Contact support to resume." },
        { status: 403 }
      ),
      tenant,
      userId: session.user.id,
      isImpersonating,
    };
  }

  return { error: null, tenant, userId: session.user.id, isImpersonating };
}
