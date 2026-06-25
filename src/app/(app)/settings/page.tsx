import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { getTenantById } from "@/lib/db/tenant-repo";
import SettingsEditor from "./SettingsEditor";

export default async function SettingsPage() {
  const { tenantId } = await getTenantContext();
  const tenant = await getTenantById(tenantId);

  return (
    <SettingsEditor
      initial={{
        companyName: tenant?.companyName ?? "",
        companyWebsite: tenant?.companyWebsite ?? "",
        industry: tenant?.industry ?? "",
        dltEntityId: tenant?.dltEntityId ?? "",
        callingWindowStart: tenant?.callingWindowStart ?? "10:00",
        callingWindowEnd: tenant?.callingWindowEnd ?? "19:00",
        timezone: tenant?.timezone ?? "Asia/Kolkata",
        planTier: tenant?.planTier ?? "trial",
        escalationNumber: tenant?.escalationNumber ?? "",
        escalationRule: tenant?.escalationRule ?? "off",
        valuePerQualifiedLead: tenant?.valuePerQualifiedLead ?? "500",
        costPerMinute: tenant?.costPerMinute ?? "4",
        avgHumanCallMinutes: tenant?.avgHumanCallMinutes ?? "5",
      }}
    />
  );
}
