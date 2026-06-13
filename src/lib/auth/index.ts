import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  trustedOrigins: [process.env.BETTER_AUTH_URL!, process.env.NEXT_PUBLIC_APP_URL!].filter(Boolean),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // enable in prod once email is wired
  },
  rateLimit: {
    enabled: true,
    window: 60, // seconds
    max: 20,    // auth attempts per window per IP
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 1, // each user owns exactly one tenant
    }),
  ],
  user: {
    additionalFields: {
      isStaff: {
        type: "boolean",
        defaultValue: false,
        input: false, // never set from client
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min cache
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
