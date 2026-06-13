import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  if ((session.user as { isStaff?: boolean }).isStaff) {
    redirect("/admin");
  }

  return <>{children}</>;
}
