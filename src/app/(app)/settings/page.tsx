import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { getTenantById } from "@/lib/db/tenant-repo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const { tenantId } = await getTenantContext();
  const tenant = await getTenantById(tenantId);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted-foreground">Company</dt>
            <dd>{tenant?.companyName ?? "—"}</dd>
            <dt className="text-muted-foreground">Industry</dt>
            <dd>{tenant?.industry ?? "—"}</dd>
            <dt className="text-muted-foreground">Website</dt>
            <dd>{tenant?.companyWebsite ?? "—"}</dd>
            <dt className="text-muted-foreground">DLT Entity ID</dt>
            <dd>{tenant?.dltEntityId ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calling Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted-foreground">Window</dt>
            <dd>{tenant?.callingWindowStart}–{tenant?.callingWindowEnd}</dd>
            <dt className="text-muted-foreground">Timezone</dt>
            <dd>{tenant?.timezone}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm capitalize">{tenant?.planTier} plan</p>
          <p className="text-xs text-muted-foreground mt-1">
            Contact support to upgrade your plan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
