import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { tenants, organization, member, user, auditLog, provisioningRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { legalTransitions } from "@/lib/db/tenant-status";
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
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{tenant.companyName ?? org.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ID: {tenant.id} &middot; Org: {org.slug}
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

      {/* Actions */}
      <TenantActions
        tenantId={tenantId}
        status={tenant.status}
        possibleTransitions={possibleTransitions}
        hasDograhMapping={!!tenant.dograhOrgId && !!tenant.dograhApiKeyCiphertext}
      />

      {/* Tenant Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border rounded-lg p-4 space-y-3">
          <h2 className="font-medium">Company Details</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Industry</dt>
            <dd>{tenant.industry ?? "—"}</dd>
            <dt className="text-muted-foreground">Website</dt>
            <dd>{tenant.companyWebsite ?? "—"}</dd>
            <dt className="text-muted-foreground">DLT Entity ID</dt>
            <dd>{tenant.dltEntityId ?? "—"}</dd>
            <dt className="text-muted-foreground">Calling window</dt>
            <dd>
              {tenant.callingWindowStart}–{tenant.callingWindowEnd} ({tenant.timezone})
            </dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="capitalize">{tenant.planTier}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(tenant.createdAt).toLocaleString("en-IN")}</dd>
            {tenant.approvedAt && (
              <>
                <dt className="text-muted-foreground">Approved</dt>
                <dd>{new Date(tenant.approvedAt).toLocaleString("en-IN")}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="border rounded-lg p-4 space-y-3">
          <h2 className="font-medium">Members</h2>
          <ul className="space-y-2 text-sm">
            {members.map((m) => (
              <li key={m.user.id} className="flex justify-between">
                <div>
                  <span className="font-medium">{m.user.name}</span>
                  <span className="text-muted-foreground ml-2">{m.user.email}</span>
                </div>
                <span className="text-muted-foreground capitalize">{m.member.role}</span>
              </li>
            ))}
            {members.length === 0 && (
              <li className="text-muted-foreground">No members yet</li>
            )}
          </ul>
        </section>
      </div>

      {/* Dograh Mapping */}
      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-medium">Dograh Engine Mapping</h2>
        <MappingForm
          tenantId={tenantId}
          current={{
            dograhOrgId: tenant.dograhOrgId ?? "",
            dograhWorkflowId: tenant.dograhWorkflowId ?? "",
            hasDograhApiKey: !!tenant.dograhApiKeyCiphertext,
            hasDograhWebhookSecret: !!tenant.dograhWebhookSecret,
          }}
        />
      </section>

      {/* Provisioning Timeline */}
      {provRuns.length > 0 && (
        <section className="border rounded-lg p-4 space-y-3">
          <h2 className="font-medium">Provisioning Timeline</h2>
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
                <span
                  className={`capitalize ${
                    run.status === "failed" ? "text-red-600" : ""
                  }`}
                >
                  {run.status}
                </span>
                {run.error && (
                  <span className="text-red-600 text-xs truncate max-w-xs">{run.error}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Audit Log */}
      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Audit Log</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit entries yet</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm py-1 border-b last:border-0">
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
      </section>
    </div>
  );
}
