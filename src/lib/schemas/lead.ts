import { z } from "zod";

export const createLeadSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
