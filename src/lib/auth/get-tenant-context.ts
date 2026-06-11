import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./index";
import { getTenantByUserId, getTenantById } from "@/lib/db/tenant-repo";

interface TenantContext {
  userId: string;
  tenantId: string;
  isImpersonating: boolean;
  staffUserId?: string;
}

export async function getTenantContext(): Promise<TenantContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const impersonationCookie = cookieStore.get("impersonation");

  if (impersonationCookie && (session.user as { isStaff?: boolean }).isStaff) {
    const data = JSON.parse(impersonationCookie.value);
    const tenant = await getTenantById(data.tenantId);
    if (!tenant) redirect("/admin");
    return {
      userId: session.user.id,
      tenantId: tenant.id,
      isImpersonating: true,
      staffUserId: data.staffUserId,
    };
  }

  const tenant = await getTenantByUserId(session.user.id);
  if (!tenant) redirect("/onboarding");

  return {
    userId: session.user.id,
    tenantId: tenant.id,
    isImpersonating: false,
  };
}
