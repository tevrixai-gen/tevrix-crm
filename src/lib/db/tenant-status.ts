import type { InferSelectModel } from "drizzle-orm";
import type { tenants } from "./schema";

type TenantStatus = InferSelectModel<typeof tenants>["status"];

const LEGAL_TRANSITIONS: Record<TenantStatus, TenantStatus[]> = {
  created: ["pending_approval"],
  pending_approval: ["provisioning", "paused"],
  provisioning: ["provisioning_failed", "ready"],
  provisioning_failed: ["provisioning"],
  ready: ["live", "paused"],
  live: ["paused"],
  paused: ["live", "provisioning"],
};

export function canTransition(from: TenantStatus, to: TenantStatus): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export function legalTransitions(from: TenantStatus): TenantStatus[] {
  return LEGAL_TRANSITIONS[from] ?? [];
}
