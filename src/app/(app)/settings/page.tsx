import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { getTenantById } from "@/lib/db/tenant-repo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Clock, CreditCard } from "lucide-react";

export default async function SettingsPage() {
  const { tenantId } = await getTenantContext();
  const tenant = await getTenantById(tenantId);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <CardTitle className="text-base">Company Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
            <dt className="text-muted-foreground">Company</dt>
            <dd className="font-medium">{tenant?.companyName ?? "—"}</dd>
            <dt className="text-muted-foreground">Industry</dt>
            <dd className="font-medium capitalize">{tenant?.industry ?? "—"}</dd>
            <dt className="text-muted-foreground">Website</dt>
            <dd className="font-medium">{tenant?.companyWebsite ?? "—"}</dd>
            <dt className="text-muted-foreground">DLT Entity ID</dt>
            <dd className="font-medium">{tenant?.dltEntityId ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <CardTitle className="text-base">Calling Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
            <dt className="text-muted-foreground">Window</dt>
            <dd className="font-medium">{tenant?.callingWindowStart}–{tenant?.callingWindowEnd}</dd>
            <dt className="text-muted-foreground">Timezone</dt>
            <dd className="font-medium">{tenant?.timezone}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <CreditCard className="h-4 w-4 text-violet-600" />
          </div>
          <CardTitle className="text-base">Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium capitalize">{tenant?.planTier} Plan</p>
          <p className="text-xs text-muted-foreground mt-1">
            Contact support to upgrade your plan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
