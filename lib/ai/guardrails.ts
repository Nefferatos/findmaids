const patterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?63|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g,
  /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g,
];

export function maskPii(text: string): string {
  return patterns.reduce((masked, pattern) => masked.replace(pattern, "[REDACTED]"), text);
}

export function checkInputLength(text: string, maxLength = 4000): boolean {
  return text.length <= maxLength;
}

export function looksLikePromptInjection(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[\s_-]+/g, " ");
  return [
    /ignore (all )?(previous|prior|above) instructions/,
    /disregard (all )?(previous|prior|above) instructions/,
    /reveal (the )?(system prompt|hidden instructions)/,
    /act as (an? )?(unrestricted|different) ai/,
    /override (the )?(system|safety) (prompt|rules)/,
  ].some((pattern) => pattern.test(normalized));
}