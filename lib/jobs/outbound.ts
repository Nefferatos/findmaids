import { createHmac } from "node:crypto";

export async function sendOutboundLeadEvent(
  event: "lead.created" | "lead.replied",
  payload: Record<string, unknown>,
) {
  const url = process.env.AI_OUTBOUND_WEBHOOK_URL;
  const secret = process.env.AI_OUTBOUND_WEBHOOK_SECRET;
  if (!url || !secret) return false;
  const body = JSON.stringify({
    event,
    sentAt: new Date().toISOString(),
    payload,
  });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-findmaids-signature": signature,
    },
    body,
    cache: "no-store",
  });
  return response.ok;
}
