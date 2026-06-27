import { z } from "zod";

const scheduleSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
});

const retryConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  maxRetries: z.number().int().min(0).max(10).optional().default(2),
  maxAttempts: z.number().int().optional(),
  retryDelaySeconds: z.number().int().min(30).max(86400).optional().default(120),
  retryOnNoAnswer: z.boolean().optional().default(true),
  retryOnBusy: z.boolean().optional().default(true),
  retryOnVoicemail: z.boolean().optional().default(false),
});

const scheduleConfigSchema = z.object({
  enabled: z.boolean().optional(),
  timezone: z.string().optional(),
  slots: z.array(scheduleSlotSchema).optional(),
  windowStart: z.string().optional(),
  windowEnd: z.string().optional(),
});

const circuitBreakerSchema = z.object({
  enabled: z.boolean().optional(),
  failureThreshold: z.number().min(0).max(1).optional(),
  windowSeconds: z.number().int().min(10).optional(),
  minCallsInWindow: z.number().int().min(1).optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(200),
  leadFilter: z.object({
    statuses: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }).optional().nullable(),
  maxConcurrency: z.number().int().min(1).max(100).optional().default(5),
  retryConfig: retryConfigSchema.optional(),
  scheduleConfig: scheduleConfigSchema.optional().nullable(),
  schedule: z.object({
    windowStart: z.string().optional(),
    windowEnd: z.string().optional(),
  }).optional(),
  circuitBreaker: circuitBreakerSchema.optional().nullable(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
