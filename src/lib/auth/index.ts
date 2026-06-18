import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendMail } from "@/lib/email";

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
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Reset your Tevrix AI password",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#111">Reset your password</h2>
            <p>Hi ${user.name},</p>
            <p>Click the button below to reset your password. This link expires in 1 hour.</p>
            <a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">Reset Password</a>
            <p style="color:#666;font-size:13px">If you didn't request this, ignore this email.</p>
            <p style="color:#999;font-size:12px">— Tevrix AI</p>
          </div>
        `,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Verify your Tevrix AI email",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#111">Verify your email</h2>
            <p>Hi ${user.name},</p>
            <p>Click below to verify your email address.</p>
            <a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">Verify Email</a>
            <p style="color:#999;font-size:12px">— Tevrix AI</p>
          </div>
        `,
      });
    },
  },
  rateLimit: {
    enabled: true,
    window: 60, // seconds
    max: 20,    // auth attempts per window per IP
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 1,
      sendInvitationEmail: async (data) => {
        const acceptUrl = `${process.env.BETTER_AUTH_URL}/accept-invitation?id=${data.id}`;
        await sendMail({
          to: data.email,
          subject: `You're invited to ${data.organization.name} on Tevrix AI`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#111">You've been invited</h2>
              <p>${data.inviter.user.name} invited you to join <strong>${data.organization.name}</strong> on Tevrix AI as a ${data.role ?? "member"}.</p>
              <a href="${acceptUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">Accept Invitation</a>
              <p style="color:#666;font-size:13px">This invitation expires on ${new Date(data.invitation.expiresAt).toLocaleDateString()}.</p>
              <p style="color:#999;font-size:12px">— Tevrix AI</p>
            </div>
          `,
        });
      },
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
