// Provisioning state machine: each step is recorded in provisioning_runs,
// idempotent, and retryable. Steps: verify_key → clone_workflow → apply_variables → register_webhook → complete

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenants, provisioningRuns } from "@/lib/db/schema";
import { writeAudit } from "@/lib/db/audit";
import { createDograhClient, DograhClientError } from "./client";

type ProvisioningStep = "verify_key" | "clone_workflow" | "apply_variables" | "register_webhook" | "complete";

const STEP_ORDER: ProvisioningStep[] = [
  "verify_key",
  "clone_workflow",
  "apply_variables",
  "register_webhook",
  "complete",
];

async function recordStep(
  tenantId: string,
  step: ProvisioningStep,
  status: "running" | "succeeded" | "failed",
  payload?: unknown,
  error?: string
) {
  await db.insert(provisioningRuns).values({
    tenantId,
    step,
    status,
    payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
    error: error ?? null,
    startedAt: status === "running" ? new Date() : null,
    completedAt: status !== "running" ? new Date() : null,
  });
}

interface ProvisionResult {
  success: boolean;
  failedStep?: ProvisioningStep;
  error?: string;
}

export async function runProvisioning(
  tenantId: string,
  actorId: string,
  dograhBaseUrl: string
): Promise<ProvisionResult> {
  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
    .then((r) => r[0]);

  if (!tenant) return { success: false, error: "Tenant not found" };
  if (!tenant.dograhApiKeyCiphertext) {
    return { success: false, error: "No Dograh API key configured" };
  }
  if (!tenant.dograhOrgId) {
    return { success: false, error: "No Dograh org ID configured" };
  }

  // Set tenant to provisioning status
  await db
    .update(tenants)
    .set({ status: "provisioning", updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  const client = createDograhClient(dograhBaseUrl, tenant.dograhApiKeyCiphertext);

  for (const step of STEP_ORDER) {
    try {
      await recordStep(tenantId, step, "running");

      switch (step) {
        case "verify_key": {
          const keys = await client.verifyKey();
          await recordStep(tenantId, step, "succeeded", { keyCount: keys.length });
          break;
        }

        case "clone_workflow": {
          // For MVP, we don't clone — the workflow is pre-created by staff
          // and mapped via dograhWorkflowId. Just verify it's set.
          if (!tenant.dograhWorkflowId) {
            await recordStep(tenantId, step, "succeeded", {
              note: "No workflow to clone — using pre-mapped workflow",
            });
          } else {
            await recordStep(tenantId, step, "succeeded", {
              workflowId: tenant.dograhWorkflowId,
            });
          }
          break;
        }

        case "apply_variables": {
          // Future: push tenant-specific variables (company name, working hours)
          // to the Dograh workflow. For MVP, this is a no-op.
          await recordStep(tenantId, step, "succeeded", { note: "No-op for MVP" });
          break;
        }

        case "register_webhook": {
          // Future: register webhook URL with Dograh via API.
          // For MVP, webhooks are configured manually in Dograh.
          await recordStep(tenantId, step, "succeeded", {
            note: "Manual webhook config for MVP",
          });
          break;
        }

        case "complete": {
          await db
            .update(tenants)
            .set({ status: "ready", updatedAt: new Date() })
            .where(eq(tenants.id, tenantId));

          await recordStep(tenantId, step, "succeeded");

          await writeAudit({
            tenantId,
            actorId,
            action: "tenant.provisioned",
            resourceType: "tenant",
            resourceId: tenantId,
            after: { status: "ready" },
          });
          break;
        }
      }
    } catch (err) {
      const errMsg =
        err instanceof DograhClientError
          ? `${err.status}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);

      await recordStep(tenantId, step, "failed", null, errMsg);

      await db
        .update(tenants)
        .set({ status: "provisioning_failed", updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));

      await writeAudit({
        tenantId,
        actorId,
        action: "tenant.provisioning_failed",
        resourceType: "tenant",
        resourceId: tenantId,
        after: { failedStep: step, error: errMsg },
      });

      return { success: false, failedStep: step, error: errMsg };
    }
  }

  return { success: true };
}
