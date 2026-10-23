import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const requestHumanHandoffInput = z.object({
  conversationId: z.string().min(1),
  visitorToken: z.string().min(32),
  reason: z.string().trim().min(3).max(1000),
});
export type RequestHumanHandoffInput = z.infer<typeof requestHumanHandoffInput>;

export async function requestHumanHandoff(input: RequestHumanHandoffInput) {
  const handoff = requestHumanHandoffInput.parse(input);
  const tokenHash = createHash("sha256")
    .update(handoff.visitorToken)
    .digest("hex");
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: handoff.conversationId,
      visitorTokenHash: tokenHash,
      status: { not: "CLOSED" },
    },
    include: { agency: { select: { id: true, name: true, email: true } } },
  });
  if (!conversation)
    throw new Error("Conversation access could not be verified.");
  const created = await prisma.handoffRequest.create({
    data: { conversationId: conversation.id, reason: handoff.reason },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: "HANDED_OFF" },
  });
  const recipients = conversation.agency?.email
    ? [conversation.agency.email]
    : await prisma.user
        .findMany({
          where: { role: "ADMIN", disabled: false },
          select: { email: true },
          take: 5,
        })
        .then((users) => users.map((user) => user.email));
  await Promise.allSettled(
    recipients.map((email) =>
      sendEmail(
        email,
        "FindMaids conversation needs a human",
        `A visitor requested help. Reason: ${handoff.reason.slice(0, 500)}${conversation.agency ? ` Agency: ${conversation.agency.name}.` : ""}`,
      ),
    ),
  );
  return { requested: true, handoffId: created.id };
}
