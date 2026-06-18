-- Add retry support to webhook_inbox
ALTER TYPE "webhook_inbox_status" ADD VALUE IF NOT EXISTS 'dead_letter';
ALTER TABLE "webhook_inbox" ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "webhook_inbox" ADD COLUMN IF NOT EXISTS "next_retry_at" timestamp;
