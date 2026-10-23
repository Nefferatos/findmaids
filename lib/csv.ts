export function parseCsvLine(line: string) {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error("Malformed CSV quoting.");
  fields.push(value);
  return fields;
}

export function parseCsv(text: string, maxRows = 500) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2 || lines.length > maxRows + 1)
    throw new Error(`CSV must contain a header and at most ${maxRows} rows.`);
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) throw new Error("CSV row has a different number of columns than the header.");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

export function escapeCsv(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
