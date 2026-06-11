import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { db } from "@/lib/db";
import { agentProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AgentEditor from "./AgentEditor";
import TestCallBox from "./TestCallBox";

export default async function AgentPage() {
  const { tenantId } = await getTenantContext();

  const profiles = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.tenantId, tenantId))
    .limit(1);

  const agent = profiles[0] ?? null;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Your Agent</h1>

      <AgentEditor
        initial={agent ? {
          agentName: agent.agentName,
          goal: agent.goal ?? "",
          language: agent.language,
          voiceId: agent.voiceId ?? "",
          isDraft: agent.isDraft,
        } : null}
      />

      <TestCallBox />
    </div>
  );
}
