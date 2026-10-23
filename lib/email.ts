import { Resend } from "resend";
import { logger } from "@/lib/logger";

export async function sendEmail(to: string, subject: string, text: string) {
  if (process.env.EMAIL_DELIVERY_DISABLED === "true") {
    logger.info({ delivery: "disabled" }, "Email suppressed by test configuration");
    return;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.info({
      delivery: "disabled",
    }, "Email suppressed because provider is not configured");
    return;
  }
  const resend = new Resend(key);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "FindMaids <onboarding@resend.dev>",
    to,
    subject,
    text,
  });
}
