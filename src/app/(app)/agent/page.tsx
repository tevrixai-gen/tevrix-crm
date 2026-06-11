import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { db } from "@/lib/db";
import { agentProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";

export default async function AgentPage() {
  const { tenantId } = await getTenantContext();

  const profiles = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.tenantId, tenantId))
    .limit(1);

  const agent = profiles[0] ?? null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Your Agent</h1>
        {agent && (
          <Badge variant={agent.isDraft ? "secondary" : "default"}>
            {agent.isDraft ? "Draft" : "Published"}
          </Badge>
        )}
      </div>

      {!agent ? (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <p className="text-muted-foreground">Agent editor coming in Phase 2</p>
          <p className="text-sm text-muted-foreground">
            Configure your AI agent's name, voice, language, and what it should achieve.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg p-4 space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24">Name:</span>
            <span>{agent.agentName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24">Language:</span>
            <span>{agent.language}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24">Goal:</span>
            <span>{agent.goal ?? "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
