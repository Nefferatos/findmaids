export function isSameOriginMutation(input: {
  origin: string | null;
  fetchSite: string | null;
  expectedOrigin: string;
  hasCookie: boolean;
}) {
  if (input.fetchSite === "cross-site") return false;
  if (input.origin) {
    try {
      return new URL(input.origin).origin === input.expectedOrigin;
    } catch {
      return false;
    }
  }
  return !input.hasCookie || input.fetchSite === "same-origin";
}

export function isApiBodyWithinLimit(path: string, contentLength: string | null) {
  if (!contentLength) return true;
  if (!/^\d+$/.test(contentLength)) return false;
  const bytes = Number(contentLength);
  const maxBytes = path.startsWith("/api/agency/media")
    ? 10 * 1024 * 1024
    : path.startsWith("/api/agency/bank-transfer/proof")
      ? 9 * 1024 * 1024
      : 1024 * 1024;
  return Number.isSafeInteger(bytes) && bytes <= maxBytes;
}
