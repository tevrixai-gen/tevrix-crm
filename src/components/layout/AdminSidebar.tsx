"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Inbox, LayoutTemplate, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const nav = [
  { href: "/admin", label: "Queue", icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/inbox", label: "Webhook Inbox", icon: Inbox },
  { href: "/admin/templates", label: "Agent Templates", icon: LayoutTemplate },
];

interface Props {
  user: { name: string; email: string };
}

export default function AdminSidebar({ user }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r bg-card flex flex-col h-full shrink-0">
      <div className="px-5 py-5 border-b">
        <div className="flex items-center gap-2">
          <p className="font-semibold">Tevrix Admin</p>
          <Badge variant="secondary" className="text-xs">Staff</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.email}</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              (exact ? pathname === href : pathname.startsWith(href))
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground gap-3"
          onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/login"; } } })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
