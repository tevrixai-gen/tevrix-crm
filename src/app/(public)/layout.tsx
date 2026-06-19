import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Zap, Phone, Users, BarChart3 } from "lucide-react";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");
  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[oklch(0.35_0.18_265)] to-[oklch(0.22_0.12_280)] text-white flex-col justify-between p-10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Tevrix AI</span>
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-3xl font-semibold leading-tight">
            Your AI voice agent,<br />ready to call.
          </h2>
          <div className="space-y-4">
            {[
              { icon: Phone, text: "Automated outbound calls at scale" },
              { icon: Users, text: "Qualify leads while you sleep" },
              { icon: BarChart3, text: "Real-time analytics & recordings" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-white/80">
                <div className="h-8 w-8 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/40">
          &copy; {new Date().getFullYear()} Tevrix AI. All rights reserved.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
