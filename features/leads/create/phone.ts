export type PhoneCountry = {
  code: string;
  name: string;
  dial: string;
  /** Numbers are dialled nationally with a leading 0 that E.164 drops. */
  trunk: boolean;
  /** Digit groups for the national number, without the trunk 0. */
  groups: number[];
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "AU", name: "Australia", dial: "61", trunk: true, groups: [3, 3, 3] },
  { code: "NZ", name: "New Zealand", dial: "64", trunk: true, groups: [2, 3, 4] },
  { code: "NP", name: "Nepal", dial: "977", trunk: true, groups: [3, 3, 4] },
  { code: "IN", name: "India", dial: "91", trunk: true, groups: [5, 5] },
  { code: "PH", name: "Philippines", dial: "63", trunk: true, groups: [3, 3, 4] },
  { code: "LK", name: "Sri Lanka", dial: "94", trunk: true, groups: [2, 3, 4] },
  { code: "BD", name: "Bangladesh", dial: "880", trunk: true, groups: [4, 6] },
  { code: "PK", name: "Pakistan", dial: "92", trunk: true, groups: [3, 7] },
  { code: "CN", name: "China", dial: "86", trunk: true, groups: [3, 4, 4] },
  { code: "VN", name: "Vietnam", dial: "84", trunk: true, groups: [3, 3, 3] },
  { code: "ID", name: "Indonesia", dial: "62", trunk: true, groups: [3, 4, 4] },
  { code: "MY", name: "Malaysia", dial: "60", trunk: true, groups: [2, 4, 4] },
  { code: "SG", name: "Singapore", dial: "65", trunk: false, groups: [4, 4] },
  { code: "FJ", name: "Fiji", dial: "679", trunk: false, groups: [3, 4] },
  { code: "AE", name: "United Arab Emirates", dial: "971", trunk: true, groups: [2, 3, 4] },
  { code: "GB", name: "United Kingdom", dial: "44", trunk: true, groups: [4, 6] },
  { code: "US", name: "United States", dial: "1", trunk: false, groups: [3, 3, 4] },
  { code: "CA", name: "Canada", dial: "1", trunk: false, groups: [3, 3, 4] },
  { code: "ZA", name: "South Africa", dial: "27", trunk: true, groups: [2, 3, 4] },
];

export const DEFAULT_PHONE_COUNTRY = "AU";

export function phoneCountry(code: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.code === code) ?? PHONE_COUNTRIES[0]!;
}

/** Region from a locale such as "en-AU"; Australia when it is missing or not listed. */
export function countryFromLocale(locale: string | undefined): string {
  const region = locale?.split(/[-_]/).slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase();
  return region && PHONE_COUNTRIES.some((c) => c.code === region) ? region : DEFAULT_PHONE_COUNTRY;
}

export const phoneDigits = (raw: string) => raw.replace(/\D/g, "");

const isInternational = (raw: string) => raw.trim().startsWith("+");

/** Country for a "+…" number, longest dial code first; the current country wins ties (+1). */
export function detectDialCountry(raw: string, current?: string): string | null {
  if (!isInternational(raw)) return null;
  const digits = phoneDigits(raw);
  const matches = PHONE_COUNTRIES.filter((c) => digits.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length);
  if (matches.length === 0) return null;
  const best = matches[0]!.dial.length;
  const tied = matches.filter((c) => c.dial.length === best);
  return (tied.find((c) => c.code === current) ?? tied[0]!).code;
}

function group(digits: string, groups: number[]): string {
  const out: string[] = [];
  let i = 0;
  for (let g = 0; g < groups.length && i < digits.length; g++) {
    const size = g === groups.length - 1 ? digits.length - i : groups[g]!;
    out.push(digits.slice(i, i + size));
    i += size;
  }
  return out.join(" ");
}

/** National significant number: digits without the dial code or trunk 0. */
export function nationalNumber(raw: string, code: string): string {
  const c = phoneCountry(code);
  const digits = phoneDigits(raw);
  if (isInternational(raw)) return digits.startsWith(c.dial) ? digits.slice(c.dial.length) : digits;
  return c.trunk && digits.startsWith("0") ? digits.slice(1) : digits;
}

/** Display format while typing: "0412 345 678", "412 345 678" or "+61 412 345 678". */
export function formatPhone(raw: string, code: string): string {
  const digits = phoneDigits(raw);
  if (!digits) return isInternational(raw) ? "+" : "";
  const c = phoneCountry(code);
  if (isInternational(raw)) {
    if (!digits.startsWith(c.dial)) return `+${group(digits, [3, 3, 3, 3, 3])}`;
    const nsn = digits.slice(c.dial.length);
    return nsn ? `+${c.dial} ${group(nsn, c.groups)}` : `+${c.dial}`;
  }
  if (c.trunk && digits.startsWith("0")) {
    return group(digits, [c.groups[0]! + 1, ...c.groups.slice(1)]);
  }
  return group(digits, c.groups);
}

/** "+61412345678"; "" when there are no digits. */
export function toE164(raw: string, code: string): string {
  const digits = phoneDigits(raw);
  if (!digits) return "";
  if (isInternational(raw)) return `+${digits}`;
  return `+${phoneCountry(code).dial}${nationalNumber(raw, code)}`;
}

/**
 * Ways the same number is commonly stored, for duplicate lookups that match exactly:
 * E.164, and the national form with a trunk 0 ("0412345678").
 */
export function phoneVariants(raw: string, code: string): string[] {
  const e164 = toE164(raw, code);
  if (!e164) return [];
  const c = phoneCountry(code);
  const nsn = nationalNumber(raw, code);
  const national = c.trunk ? `0${nsn}` : nsn;
  return Array.from(new Set([e164, national]));
}

/** Expected national significant digits for a country (sum of display groups). */
export function expectedNationalLength(code: string): number {
  return phoneCountry(code).groups.reduce((sum, n) => sum + n, 0);
}

/**
 * Validates the national number length for the selected country.
 * Empty input is allowed (phone is optional); returns short/long when digits are present.
 */
export function phoneLengthIssue(raw: string, code: string): "short" | "long" | null {
  if (!phoneDigits(raw)) return null;
  const n = nationalNumber(raw, code).length;
  const expected = expectedNationalLength(code);
  if (n < expected) return "short";
  if (n > expected) return "long";
  return null;
}

/** User-facing message for a phone length issue in `code`'s country. */
export function phoneLengthMessage(raw: string, code: string): string | null {
  const issue = phoneLengthIssue(raw, code);
  if (!issue) return null;
  const c = phoneCountry(code);
  const expected = expectedNationalLength(code);
  const n = nationalNumber(raw, code).length;
  if (issue === "short") {
    return `${c.name} numbers need ${expected} digits (you entered ${n}).`;
  }
  return `${c.name} numbers are ${expected} digits (you entered ${n}).`;
}
