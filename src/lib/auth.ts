import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }: { user: { email: string }; url: string }) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return;
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: "Wing Check <alerts@wingcheck.dev>",
        to: user.email,
        subject: "Reset your Wing Check password",
        text: `Click the link below to reset your password:\n\n${url}\n\nIf you didn't request this, you can safely ignore this email.`,
      });
    },
    async sendVerificationEmail({ user, url }: { user: { email: string }; url: string }) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return;
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: "Wing Check <alerts@wingcheck.dev>",
        to: user.email,
        subject: "Verify your Wing Check email",
        text: `Click the link below to verify your email:\n\n${url}\n\nIf you didn't sign up, you can safely ignore this email.`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
  },
});
