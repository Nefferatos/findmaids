export const rankingWeights = {
  planPriority: 0.25,
  rating: 3,
  reviewCount: 0.15,
  profileCompleteness: 2,
  recentActivity: 1,
} as const;

export type RankableAgency = {
  id: string;
  listingPriority: number;
  rating: number;
  reviewCount: number;
  profileCompleteness: number;
  daysSinceActivity: number;
};

export function scoreAgency(agency: RankableAgency, weights = rankingWeights) {
  const activity = Math.max(0, 1 - agency.daysSinceActivity / 90);
  return (
    agency.listingPriority * weights.planPriority +
    agency.rating * weights.rating +
    agency.reviewCount * weights.reviewCount +
    agency.profileCompleteness * weights.profileCompleteness +
    activity * weights.recentActivity
  );
}

export function rotateFeatured<T extends { id: string }>(
  items: T[],
  date = new Date(),
): T[] {
  if (items.length < 2) return items;
  const dayNumber = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      86_400_000,
  );
  const offset = ((dayNumber % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}
