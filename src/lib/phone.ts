// Phone normalization — Indian-first, E.164 output.
// Indian mobiles: 10 digits starting 6-9. Accepts common input shapes:
//   "98765 43210", "+91-98765-43210", "09876543210", "919876543210", "9876543210"
// Non-Indian numbers pass through only if already in valid E.164 (+<8-15 digits>).

export interface PhoneResult {
  ok: boolean;
  e164?: string;
  error?: string;
}

export function normalizePhone(raw: string, defaultCountry: "IN" = "IN"): PhoneResult {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Empty phone number" };
  }

  const hadPlus = raw.trim().startsWith("+");
  // Strip everything except digits
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 0) {
    return { ok: false, error: "No digits found" };
  }

  // Explicit international number (had a +). Validate generic E.164.
  if (hadPlus && !digits.startsWith("91")) {
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, error: "Invalid international number length" };
    }
    return { ok: true, e164: `+${digits}` };
  }

  // Indian-shaped inputs
  let national: string;

  if (digits.length === 10) {
    national = digits;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    national = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    national = digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith("091")) {
    national = digits.slice(3);
  } else {
    return { ok: false, error: `Cannot parse as Indian number (${digits.length} digits)` };
  }

  // Indian mobile numbers start with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(national)) {
    return { ok: false, error: "Indian mobile numbers must be 10 digits starting with 6-9" };
  }

  return { ok: true, e164: `+91${national}` };
}

export function formatPhoneDisplay(e164: string): string {
  // +919876543210 → +91 98765 43210
  if (e164.startsWith("+91") && e164.length === 13) {
    return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
  }
  return e164;
}
