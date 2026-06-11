// Resolves a campaign's audience from its lead filter. DNC leads are
// excluded unconditionally — there is no way to opt out of that filter.

import { and, eq, inArray, arrayOverlaps, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";

export interface LeadFilter {
  statuses?: string[]; // e.g. ["new", "callback"]
  tags?: string[];     // any-overlap match
}

const FILTERABLE_STATUSES = [
  "new", "queued", "calling", "connected", "not_answered",
  "callback", "qualified", "not_interested", "failed",
] as const;
type FilterableStatus = (typeof FILTERABLE_STATUSES)[number];

export async function resolveAudience(tenantId: string, filter: LeadFilter | null) {
  const conditions: SQL[] = [
    eq(leads.tenantId, tenantId),
    eq(leads.isDnc, false), // hard rule: never dial DNC
  ];

  const statuses = (filter?.statuses ?? []).filter((s): s is FilterableStatus =>
    (FILTERABLE_STATUSES as readonly string[]).includes(s)
  );
  if (statuses.length > 0) {
    conditions.push(inArray(leads.status, statuses));
  }

  if (filter?.tags && filter.tags.length > 0) {
    conditions.push(arrayOverlaps(leads.tags, filter.tags));
  }

  return db
    .select({
      id: leads.id,
      phone: leads.phone,
      name: leads.name,
    })
    .from(leads)
    .where(and(...conditions));
}
