import { db } from "./index";
import { auditLog } from "./schema";

interface AuditEntry {
  tenantId?: string | null;
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
}

export async function writeAudit(entry: AuditEntry) {
  await db.insert(auditLog).values({
    tenantId: entry.tenantId ?? null,
    actorId: entry.actorId,
    action: entry.action,
    resourceType: entry.resourceType ?? null,
    resourceId: entry.resourceId ?? null,
    before: entry.before ? JSON.parse(JSON.stringify(entry.before)) : null,
    after: entry.after ? JSON.parse(JSON.stringify(entry.after)) : null,
  });
}
