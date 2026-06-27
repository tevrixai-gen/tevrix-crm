import { z } from "zod";

const VALID_KINDS = ["hubspot", "zoho", "salesforce", "sheets", "webhook"] as const;
const VALID_TRIGGERS = ["on_qualified", "on_any_completed", "on_keyword"] as const;

export const createIntegrationSchema = z.object({
  kind: z.enum(VALID_KINDS),
  displayName: z.string().max(100).optional(),
  triggerRule: z.enum(VALID_TRIGGERS).optional().default("on_qualified"),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
