import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import AdminSidebar from "@/components/layout/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");
  if (!session.user.isStaff) redirect("/dashboard");

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar user={session.user} />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
