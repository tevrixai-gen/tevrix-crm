import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getTenantByUserId, getTenantById } from "@/lib/db/tenant-repo";
import AppSidebar from "@/components/layout/AppSidebar";
import ImpersonationBanner from "@/components/layout/ImpersonationBanner";
import CommandPalette from "@/components/layout/CommandPalette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  // Check for staff impersonation
  const cookieStore = await cookies();
  const impersonationCookie = cookieStore.get("impersonation");
  let impersonation: { staffUserId: string; tenantId: string; tenantName: string } | null = null;
  let tenant = null;

  if (impersonationCookie && (session.user as { isStaff?: boolean }).isStaff) {
    impersonation = JSON.parse(impersonationCookie.value);
    tenant = await getTenantById(impersonation!.tenantId);
  } else if ((session.user as { isStaff?: boolean }).isStaff) {
    redirect("/admin");
  } else {
    tenant = await getTenantByUserId(session.user.id);
  }

  if (!tenant) redirect("/onboarding");

  if (!impersonation && (tenant.status === "created" || tenant.status === "pending_approval")) {
    redirect("/pending");
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <CommandPalette />
      {impersonation && (
        <ImpersonationBanner tenantName={impersonation.tenantName ?? "Unknown"} />
      )}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar tenant={tenant} user={session.user} />
        <main className="flex-1 overflow-y-auto bg-background pt-14 lg:pt-0">
          {!impersonation && tenant.status === "paused" && (
            <div className="bg-yellow-100 border-b border-yellow-200 px-6 py-2 text-sm text-yellow-800">
              Your account is paused. Contact support to resume.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
