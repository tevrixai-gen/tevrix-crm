import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getTenantByUserId } from "@/lib/db/tenant-repo";
import AppSidebar from "@/components/layout/AppSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  // Staff bypass — they access /admin routes, not the client (app) shell
  if (session.user.isStaff) redirect("/admin");

  const tenant = await getTenantByUserId(session.user.id);

  if (!tenant) redirect("/onboarding");

  if (tenant.status === "created" || tenant.status === "pending_approval") {
    redirect("/pending");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar tenant={tenant} user={session.user} />
      <main className="flex-1 overflow-y-auto bg-background">
        {tenant.status === "paused" && (
          <div className="bg-warning/10 border-b border-warning/20 px-6 py-2 text-sm text-warning-foreground">
            Your account is paused. Contact support to resume.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
