import { Resend } from "resend";

export async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[email:development-only]", { to, subject, text });
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
