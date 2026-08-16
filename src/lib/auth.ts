import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { requireResendKey } from "./mail";

async function sendAuthEmail(to: string, subject: string, text: string) {
  const apiKey = requireResendKey();
  if (!apiKey) return;
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "Wing Check <alerts@wingcheck.dev>",
    to,
    subject,
    text,
  });
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
    }) {
      await sendAuthEmail(
        user.email,
        "Reset your Wing Check password",
        `Click the link below to reset your password:\n\n${url}\n\nIf you didn't request this, you can safely ignore this email.`,
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
    }) {
      await sendAuthEmail(
        user.email,
        "Verify your Wing Check email",
        `Click the link below to verify your email:\n\n${url}\n\nIf you didn't sign up, you can safely ignore this email.`,
      );
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
  },
});
