const patterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?63|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g,
  /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g,
  /\b(?:passport|national id|government id|sss|tin|philhealth|pag-ibig)\s*(?:no\.?|number|#)?\s*[:#-]?\s*[A-Z0-9-]{6,20}\b/gi,
  /\b(?:card|account)\s*(?:no\.?|number|#)?\s*[:#-]?\s*\d[\d -]{11,18}\b/gi,
];

export function maskPii(text: string): string {
  return patterns.reduce(
    (masked, pattern) => masked.replace(pattern, "[REDACTED]"),
    text,
  );
}

export function checkInputLength(text: string, maxLength = 4000): boolean {
  return text.length <= maxLength;
}

export function looksLikePromptInjection(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [
    /ignore (all )?(previous|prior|above) instructions?/,
    /disregard (all )?(previous|prior|above) instructions?/,
    /reveal (the )?(system prompt|hidden instructions|hidden system prompt)/,
    /act as (an? )?(unrestricted|different) ai/,
    /override (the )?(system|safety) (prompt|rules)/,
  ].some((pattern) => pattern.test(normalized));
}

export function classifySafetyIntent(
  text: string,
): "injection" | "refusal" | "handoff" | null {
  if (looksLikePromptInjection(text)) return "injection";
  if (
    /\b(?:\d{9,}|\[redacted\])\b.{0,80}\b(?:reveal|ignore|override|hidden|system prompt)\b/i.test(
      text,
    )
  )
    return "injection";
  if (
    /\b(?:talk to a human|human please|operator|agent please|tao po|tao ang kausap|kailangan ko ng tulong)\b/i.test(
      text,
    )
  )
    return "handoff";
  if (
    /\b(?:legal|immigration|visa|employment law|guarantee|guaranteed|private data|another (?:user|visitor|employer)|personal information.*(?:someone else|another)|batas|sigurado|garantiya)\b/i.test(
      text,
    )
  )
    return "refusal";
  return null;
}
