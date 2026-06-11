// Minimal RFC-4180 CSV parser — handles quoted fields, escaped quotes,
// CRLF/LF, and trailing newlines. No streaming; import files are bounded
// (~10k rows) so in-memory parsing is fine for MVP.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // Skip rows that are entirely empty
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      if (text[i + 1] === "\n") i++;
      pushRow();
      i++;
      continue;
    }
    if (c === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }

  // Final field/row (no trailing newline)
  if (field !== "" || row.length > 0) pushRow();

  return rows;
}

/** Guess which column holds which lead field from header names. */
export function suggestColumnMapping(headers: string[]): Record<string, number | null> {
  const norm = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

  const find = (...candidates: string[]): number | null => {
    for (const c of candidates) {
      const idx = norm.findIndex((h) => h.includes(c));
      if (idx !== -1) return idx;
    }
    return null;
  };

  return {
    phone: find("phone", "mobile", "contact", "number", "whatsapp"),
    name: find("name", "lead", "customer", "client"),
    email: find("email", "mail"),
  };
}
