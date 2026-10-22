export function agencyScopedWhere<const T extends Record<string, unknown>>(
  agencyId: string,
  where: T = {} as T,
) {
  return { ...where, agencyId };
}
