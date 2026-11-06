export const SITE_LOCALE = "en-SG";
export const SITE_CURRENCY = "SGD";
export const SITE_TIME_ZONE = "Asia/Singapore";

export function formatSgd(
  amount: number,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat(SITE_LOCALE, {
    style: "currency",
    currency: SITE_CURRENCY,
    ...options,
  }).format(amount);
}

export function formatSingaporeDate(
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  return new Intl.DateTimeFormat(SITE_LOCALE, {
    timeZone: SITE_TIME_ZONE,
    ...options,
  }).format(value instanceof Date ? value : new Date(value));
}
