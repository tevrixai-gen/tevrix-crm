import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    DOGRAH_API_BASE_URL: z.string().url().default("https://api.dograh.com"),
    KMS_KEY_NAME: z.string().optional(),
    // 32-byte AES-256-GCM key, base64-encoded (44 chars). Lives in GCP Secret
    // Manager as `crm-encryption-key` (project tevrix-ecom-care).
    CRM_ENCRYPTION_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().length(44)
        : z.string().length(44).optional(),
    SMTP_USER: z.string().email().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    DOGRAH_API_BASE_URL: process.env.DOGRAH_API_BASE_URL,
    KMS_KEY_NAME: process.env.KMS_KEY_NAME,
    CRM_ENCRYPTION_KEY: process.env.CRM_ENCRYPTION_KEY,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
