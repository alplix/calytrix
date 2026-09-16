export const locales = [
  "en",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
  "ro",
  "el",
  "cs",
  "sk",
  "hu",
  "sv",
  "da",
  "fi",
  "no",
  "bg",
  "hr",
  "sl",
  "et",
  "lv",
  "lt",
  "ru",
  "uk",
  "tr",
  "zh",
  "vi",
  "ja",
  "ko",
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  ro: "Română",
  el: "Ελληνικά",
  cs: "Čeština",
  sk: "Slovenčina",
  hu: "Magyar",
  sv: "Svenska",
  da: "Dansk",
  fi: "Suomi",
  no: "Norsk",
  bg: "Български",
  hr: "Hrvatski",
  sl: "Slovenščina",
  et: "Eesti",
  lv: "Latviešu",
  lt: "Lietuvių",
  ru: "Русский",
  uk: "Українська",
  tr: "Türkçe",
  zh: "中文",
  vi: "Tiếng Việt",
  ja: "日本語",
  ko: "한국어",
};

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Picks the best supported locale from an `Accept-Language` header value. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const candidates = acceptLanguage
    .split(",")
    .map((part) => part.trim().split(";")[0].toLowerCase())
    .flatMap((tag) => [tag, tag.split("-")[0]]);

  for (const candidate of candidates) {
    if (isLocale(candidate)) return candidate;
  }
  return defaultLocale;
}
