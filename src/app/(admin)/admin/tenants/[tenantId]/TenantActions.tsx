"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye, Play } from "lucide-react";

interface Props {
  tenantId: string;
  status: string;
  possibleTransitions: string[];
  hasDograhMapping: boolean;
}

export default function TenantActions({ tenantId, status, possibleTransitions, hasDograhMapping }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function impersonate() {
    setLoading("impersonate");
    setError("");
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (res.ok) {
      const { redirectTo } = await res.json();
      router.push(redirectTo);
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Impersonation failed");
    }
    setLoading(null);
  }

  async function act(endpoint: string, targetStatus: string) {
    setLoading(targetStatus);
    setError("");
    const res = await fetch(`/api/admin/tenants/${tenantId}/${endpoint}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? `Failed (${res.status})`);
    } else {
      router.refresh();
    }
    setLoading(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {possibleTransitions.map((target) => {
          if (target === "paused") {
            return (
              <Button
                key={target}
                variant="destructive"
                size="sm"
                disabled={loading !== null}
                onClick={() => act("pause", target)}
              >
                {loading === target ? "Pausing..." : "Pause Tenant"}
              </Button>
            );
          }
          if (target === "live") {
            return (
              <Button
                key={target}
                variant="default"
                size="sm"
                disabled={loading !== null}
                onClick={() => act("resume", target)}
              >
                {loading === target ? "Resuming..." : "Go Live"}
              </Button>
            );
          }
          if (target === "provisioning" || target === "ready") {
            return (
              <Button
                key={target}
                variant="default"
                size="sm"
                disabled={loading !== null}
                onClick={() => act("approve", target)}
              >
                {loading === target ? "Approving..." : "Approve"}
              </Button>
            );
          }
          return null;
        })}
        {hasDograhMapping && (status === "pending_approval" || status === "provisioning_failed" || status === "ready") && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading !== null}
            onClick={() => act("provision", "provision")}
            className="gap-1"
          >
            <Play className="h-3.5 w-3.5" />
            {loading === "provision" ? "Provisioning..." : status === "provisioning_failed" ? "Retry Provisioning" : "Run Provisioning"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={impersonate}
          className="gap-1"
        >
          <Eye className="h-3.5 w-3.5" />
          {loading === "impersonate" ? "Entering..." : "View as Tenant"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
