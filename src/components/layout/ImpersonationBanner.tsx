"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

interface Props {
  tenantName: string;
}

export default function ImpersonationBanner({ tenantName }: Props) {
  const router = useRouter();

  async function endImpersonation() {
    const res = await fetch("/api/admin/impersonate", { method: "DELETE" });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    }
  }

  return (
    <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between text-sm sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" />
        <span>
          Viewing as <strong>{tenantName}</strong> — changes here affect this tenant
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="text-orange-500 border-white bg-white hover:bg-orange-50"
        onClick={endImpersonation}
      >
        Exit Impersonation
      </Button>
    </div>
  );
}
