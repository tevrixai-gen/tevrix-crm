CREATE TYPE "public"."crm_connection_status" AS ENUM('active', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."crm_kind" AS ENUM('hubspot', 'zoho', 'sheets', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."crm_sync_status" AS ENUM('pending', 'succeeded', 'failed', 'dead_lettered');--> statement-breakpoint
CREATE TYPE "public"."live_session_mode" AS ENUM('listen', 'whisper', 'barge');--> statement-breakpoint
ALTER TYPE "public"."webhook_inbox_status" ADD VALUE 'dead_letter';--> statement-breakpoint
CREATE TABLE "crm_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "crm_kind" NOT NULL,
	"display_name" text NOT NULL,
	"config_ciphertext" text,
	"trigger_rule" text DEFAULT 'on_qualified' NOT NULL,
	"status" "crm_connection_status" DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_connections_tenant_kind_name" UNIQUE("tenant_id","kind","display_name")
);
--> statement-breakpoint
CREATE TABLE "crm_sync_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"status" "crm_sync_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"error" text,
	"external_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_sync_events_unique" UNIQUE("connection_id","call_id")
);
--> statement-breakpoint
CREATE TABLE "live_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"mode" "live_session_mode" DEFAULT 'listen' NOT NULL,
	"livekit_room" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "escalated_to" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "escalation_outcome" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "escalation_number" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "escalation_rule" text DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "value_per_qualified_lead" numeric(10, 2) DEFAULT '500' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "cost_per_minute" numeric(10, 2) DEFAULT '4' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "avg_human_call_minutes" numeric(6, 2) DEFAULT '5' NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_inbox" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_inbox" ADD COLUMN "next_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "crm_connections" ADD CONSTRAINT "crm_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_events" ADD CONSTRAINT "crm_sync_events_connection_id_crm_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."crm_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_events" ADD CONSTRAINT "crm_sync_events_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_connections_tenant_idx" ON "crm_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "live_sessions_active_idx" ON "live_sessions" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "live_sessions_tenant_idx" ON "live_sessions" USING btree ("tenant_id","started_at");