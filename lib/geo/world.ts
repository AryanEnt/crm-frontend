import countries from "i18n-iso-countries";
import enCountries from "i18n-iso-countries/langs/en.json" with { type: "json" };
import nationality from "i18n-nationality";
import enNationalities from "i18n-nationality/langs/en.json" with { type: "json" };

countries.registerLocale(enCountries);
nationality.registerLocale(enNationalities);

/** Markets we serve most often — pinned at the top of searchable lists. */
export const PRIORITY_COUNTRY_CODES = [
  "AU",
  "NP",
  "IN",
  "NZ",
  "GB",
  "US",
  "CA",
  "PH",
  "CN",
  "LK",
  "BD",
  "PK",
  "ID",
  "VN",
  "MY",
  "SG",
  "FJ",
  "AE",
  "ZA",
  "IR",
  "EG",
  "KE",
  "AF",
  "CO",
  "DE",
  "ZM",
] as const;

/** Friendlier labels where ISO official/alias names are awkward for CRM use. */
const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  AC: "Ascension Island",
  AE: "United Arab Emirates",
  BO: "Bolivia",
  BQ: "Caribbean Netherlands",
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
  CZ: "Czech Republic",
  FK: "Falkland Islands",
  FM: "Micronesia",
  GB: "United Kingdom",
  IR: "Iran",
  KP: "North Korea",
  KR: "South Korea",
  LA: "Laos",
  MD: "Moldova",
  MK: "North Macedonia",
  PS: "Palestine",
  RU: "Russia",
  SY: "Syria",
  TA: "Tristan da Cunha",
  TR: "Turkey",
  TW: "Taiwan",
  TZ: "Tanzania",
  US: "United States",
  VA: "Vatican City",
  VE: "Venezuela",
  VN: "Vietnam",
};

/** Demonyms that match existing lead data / natural English better than the package default. */
const NATIONALITY_OVERRIDES: Record<string, string> = {
  AE: "Emirati",
  AG: "Antiguan",
  BY: "Belarusian",
  CD: "Congolese",
  CG: "Congolese",
  CH: "Swiss",
  CI: "Ivorian",
  CZ: "Czech",
  DK: "Danish",
  FI: "Finnish",
  GB: "British",
  NL: "Dutch",
  NP: "Nepali",
  NZ: "New Zealander",
  PH: "Filipino",
  PL: "Polish",
  SE: "Swedish",
  SJ: "Svalbardian",
  TR: "Turkish",
  US: "American",
};

export type GeoOption = { value: string; label: string; code: string };

function priorityRank(code: string): number {
  const i = (PRIORITY_COUNTRY_CODES as readonly string[]).indexOf(code);
  return i === -1 ? PRIORITY_COUNTRY_CODES.length : i;
}

function sortGeoOptions(a: GeoOption, b: GeoOption): number {
  const byPriority = priorityRank(a.code) - priorityRank(b.code);
  if (byPriority !== 0) return byPriority;
  return a.label.localeCompare(b.label, "en");
}

/** Display name for an ISO 3166-1 alpha-2 country code. */
export function countryName(code: string): string | undefined {
  const upper = code.toUpperCase();
  if (COUNTRY_NAME_OVERRIDES[upper]) return COUNTRY_NAME_OVERRIDES[upper];
  return (
    countries.getName(upper, "en", { select: "alias" }) ??
    countries.getName(upper, "en") ??
    undefined
  );
}

/** Demonym / nationality label for an ISO country code. */
export function nationalityName(code: string): string | undefined {
  const upper = code.toUpperCase();
  if (NATIONALITY_OVERRIDES[upper]) return NATIONALITY_OVERRIDES[upper];
  return nationality.getName(upper, "en") || undefined;
}

function uniqueByValue(options: GeoOption[]): GeoOption[] {
  const seen = new Set<string>();
  const out: GeoOption[] = [];
  for (const opt of options) {
    const key = opt.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(opt);
  }
  return out;
}

const alpha2Codes = Object.keys(countries.getAlpha2Codes());

/** Full residency-country list (English names), priority markets first. */
export const COUNTRY_OPTIONS: GeoOption[] = uniqueByValue(
  alpha2Codes
    .map((code) => {
      const name = countryName(code);
      if (!name) return null;
      return { value: name, label: name, code };
    })
    .filter((o): o is GeoOption => o !== null)
    .sort(sortGeoOptions),
);

/** Full nationality (demonym) list, priority markets first. */
export const NATIONALITY_OPTIONS: GeoOption[] = uniqueByValue(
  alpha2Codes
    .map((code) => {
      const name = nationalityName(code);
      if (!name) return null;
      return { value: name, label: name, code };
    })
    .filter((o): o is GeoOption => o !== null)
    .sort(sortGeoOptions),
);

/** Resolve an ISO code from a stored country name (case-insensitive). */
export function countryCodeFromName(name: string): string | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return COUNTRY_OPTIONS.find((c) => c.label.toLowerCase() === needle)?.code;
}
