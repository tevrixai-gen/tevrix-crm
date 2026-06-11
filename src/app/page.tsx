import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getTenantByUserId } from "@/lib/db/tenant-repo";

export default async function RootPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  if ((session.user as { isStaff?: boolean }).isStaff) redirect("/admin");

  const tenant = await getTenantByUserId(session.user.id);

  if (!tenant) redirect("/onboarding");

  if (tenant.status === "created" || tenant.status === "pending_approval") {
    redirect("/pending");
  }

  redirect("/dashboard");
}
