export function cleanOcrText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      let value = line.replace(/[ \t]+/g, " ").trim();
      // Form underlines/box borders often OCR as leading underscores or pipes.
      value = value.replace(/(:\s*)[_|~]+\s*(?=\S)/g, "$1");
      value = value.replace(/^[_|~]+\s*(?=\S)/, "");
      // Checkbox glyphs around the meal-preference options.
      value = value.replace(
        /\b[0OQIl1]{1,3}\s+(?=(?:No pork|No beef|Others)\b)/gi,
        "",
      );
      value = value.replace(/(?<=No pork|No beef)\s+[0OQIl1]{1,3}\b/gi, "");
      return value
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.;:])/g, "$1")
        .trim();
    })
    .filter(Boolean)
    .join("\n");
}
