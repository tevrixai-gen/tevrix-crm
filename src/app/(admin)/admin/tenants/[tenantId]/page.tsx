import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { tenants, organization, member, user, auditLog, provisioningRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { legalTransitions } from "@/lib/db/tenant-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Link2, Clock, FileText } from "lucide-react";
import Link from "next/link";
import TenantActions from "./TenantActions";
import MappingForm from "./MappingForm";

interface Props {
  params: Promise<{ tenantId: string }>;
}

export default async function TenantDetailPage({ params }: Props) {
  const { tenantId } = await params;

  const row = await db
    .select({ tenant: tenants, org: organization })
    .from(tenants)
    .innerJoin(organization, eq(tenants.organizationId, organization.id))
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!row[0]) notFound();
  const { tenant, org } = row[0];

  const [members, logs, provRuns] = await Promise.all([
    db
      .select({ user, member })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, tenant.organizationId)),
    db
      .select()
      .from(auditLog)
      .where(eq(auditLog.tenantId, tenantId))
      .orderBy(desc(auditLog.createdAt))
      .limit(20),
    db
      .select()
      .from(provisioningRuns)
      .where(eq(provisioningRuns.tenantId, tenantId))
      .orderBy(desc(provisioningRuns.createdAt))
      .limit(10),
  ]);

  const possibleTransitions = legalTransitions(tenant.status);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/tenants" className="text-sm text-muted-foreground hover:text-foreground">&larr; Tenants</Link>
          </div>
          <h1 className="text-2xl font-semibold">{tenant.companyName ?? org.name}</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {tenant.id} &middot; {org.slug}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            tenant.status === "live"
              ? "bg-green-100 text-green-800"
              : tenant.status === "paused"
                ? "bg-yellow-100 text-yellow-800"
                : tenant.status === "provisioning_failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-100 text-blue-800"
          }`}
        >
          {tenant.status.replace("_", " ")}
        </span>
      </div>

      <TenantActions
        tenantId={tenantId}
        status={tenant.status}
        possibleTransitions={possibleTransitions}
        hasDograhMapping={!!tenant.dograhOrgId && !!tenant.dograhApiKeyCiphertext}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <CardTitle className="text-base">Company Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2.5 text-sm">
              <dt className="text-muted-foreground">Industry</dt>
              <dd className="font-medium">{tenant.industry ?? "—"}</dd>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="font-medium">{tenant.companyWebsite ?? "—"}</dd>
              <dt className="text-muted-foreground">DLT Entity ID</dt>
              <dd className="font-medium">{tenant.dltEntityId ?? "—"}</dd>
              <dt className="text-muted-foreground">Calling window</dt>
              <dd className="font-medium">
                {tenant.callingWindowStart}–{tenant.callingWindowEnd} ({tenant.timezone})
              </dd>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium capitalize">{tenant.planTier}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">{new Date(tenant.createdAt).toLocaleString("en-IN")}</dd>
              {tenant.approvedAt && (
                <>
                  <dt className="text-muted-foreground">Approved</dt>
                  <dd className="font-medium">{new Date(tenant.approvedAt).toLocaleString("en-IN")}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <Users className="h-4 w-4 text-violet-600" />
            </div>
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {members.map((m) => (
                <li key={m.user.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-violet-700">{m.user.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium">{m.user.name}</p>
                      <p className="text-xs text-muted-foreground">{m.user.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded">{m.member.role}</span>
                </li>
              ))}
              {members.length === 0 && (
                <li className="text-muted-foreground text-center py-4">No members yet</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <Link2 className="h-4 w-4 text-amber-600" />
          </div>
          <CardTitle className="text-base">Dograh Engine Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <MappingForm
            tenantId={tenantId}
            current={{
              dograhOrgId: tenant.dograhOrgId ?? "",
              dograhWorkflowId: tenant.dograhWorkflowId ?? "",
              hasDograhApiKey: !!tenant.dograhApiKeyCiphertext,
              hasDograhWebhookSecret: !!tenant.dograhWebhookSecret,
            }}
          />
        </CardContent>
      </Card>

      {provRuns.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Clock className="h-4 w-4 text-green-600" />
            </div>
            <CardTitle className="text-base">Provisioning Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {provRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center gap-3 text-sm border-l-2 pl-3"
                  style={{
                    borderColor:
                      run.status === "succeeded"
                        ? "#22c55e"
                        : run.status === "failed"
                          ? "#ef4444"
                          : run.status === "running"
                            ? "#3b82f6"
                            : "#9ca3af",
                  }}
                >
                  <span className="font-mono text-xs text-muted-foreground w-32 shrink-0">
                    {run.createdAt ? new Date(run.createdAt).toLocaleString("en-IN") : "—"}
                  </span>
                  <span className="font-medium w-36">{run.step.replace("_", " ")}</span>
                  <span className={`capitalize ${run.status === "failed" ? "text-red-600" : run.status === "succeeded" ? "text-green-600" : ""}`}>
                    {run.status}
                  </span>
                  {run.error && (
                    <span className="text-red-600 text-xs truncate max-w-xs">{run.error}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <FileText className="h-4 w-4 text-gray-600" />
          </div>
          <CardTitle className="text-base">Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No audit entries yet</p>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 text-sm py-1.5 border-b last:border-0">
                  <span className="font-mono text-xs text-muted-foreground w-36 shrink-0">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString("en-IN") : "—"}
                  </span>
                  <span className="font-medium">{log.action}</span>
                  {log.actorId && (
                    <span className="text-muted-foreground text-xs">by {log.actorId.slice(0, 8)}…</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
