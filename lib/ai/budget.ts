import { prisma } from "@/lib/prisma";
import { budgetCheck } from "@/lib/ai/budget-policy";

const sgdPerUsd = Number(process.env.AI_SGD_PER_USD ?? 1.35);
const pricePerMillionInput = Number(process.env.AI_INPUT_USD_PER_MILLION ?? 3);
const pricePerMillionOutput = Number(
  process.env.AI_OUTPUT_USD_PER_MILLION ?? 15,
);

export function estimateCostSgd(inputTokens: number, outputTokens: number) {
  const usd =
    (inputTokens * pricePerMillionInput +
      outputTokens * pricePerMillionOutput) /
    1_000_000;
  return Math.round(usd * sgdPerUsd * 1_000_000) / 1_000_000;
}

export async function checkAiBudget(agencyId?: string) {
  const globalCap = Number(process.env.AI_MONTHLY_BUDGET_SGD ?? 1000);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const globalSpend = await prisma.aiCallLog.aggregate({
    where: { createdAt: { gte: monthStart }, status: "success" },
    _sum: { costEstimate: true },
  });
  const globalTotal = Number(globalSpend._sum.costEstimate ?? 0);
  if (globalTotal >= globalCap) return budgetCheck(globalTotal, globalCap);
  if (agencyId) {
    const [agencySpend, subscription] = await Promise.all([
      prisma.aiCallLog.aggregate({
        where: { agencyId, createdAt: { gte: monthStart }, status: "success" },
        _sum: { costEstimate: true },
      }),
      prisma.subscription.findFirst({
        where: { agencyId, status: "ACTIVE" },
        include: { plan: { select: { aiMonthlyBudgetSgd: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const cap = Number(
      subscription?.plan.aiMonthlyBudgetSgd ??
        process.env.AI_DEFAULT_AGENCY_BUDGET_SGD ??
        50,
    );
    return budgetCheck(
      globalTotal,
      globalCap,
      Number(agencySpend._sum.costEstimate ?? 0),
      cap,
    );
  }
  return budgetCheck(globalTotal, globalCap);
}
