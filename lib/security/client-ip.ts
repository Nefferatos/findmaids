/**
 * Source IP used for rate limiting.
 *
 * Cloudflare writes `cf-connecting-ip`, and a browser cannot set it, so it wins.
 * `x-forwarded-for` may contain client-supplied hops (Cloudflare appends to an
 * existing header), so only the **last** entry is used as a fallback — that is
 * the hop added by our own edge/proxy, not the value the caller typed.
 *
 * Deployments must therefore sit behind Cloudflare (or a proxy that overwrites
 * `X-Forwarded-For`); otherwise the remaining header is attacker-controlled and
 * rate limits can be bypassed by rotating it.
 */
export function clientIp(request: Request): string {
  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const last = hops.at(-1);
    if (last) return last;
  }
  return "unknown";
}
