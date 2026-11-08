import { preservedSourceMessages } from "@protected-localization";
import preservedMessages from "./catalogs/preserved.json";
import koreanCatalog from "./catalogs/index";
import { getLocale, type Locale } from "./store";

/** Named string and number values substituted into a complete sentence. */
export type TranslationValues = Readonly<Record<string, string | number>>;
/** A translator bound to one locale or the current device preference. */
export type Translator = (
  message: string,
  values?: TranslationValues,
) => string;

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const missingTranslations = new Set<string>();
const preservedMessageSet = new Set([
  ...preservedMessages,
  ...preservedSourceMessages,
]);
const MAX_MISSING_TRANSLATIONS = 2_000;

function catalogMessage(
  catalog: Readonly<Record<string, string>>,
  message: string,
): string | undefined {
  return Object.hasOwn(catalog, message) ? catalog[message] : undefined;
}

function placeholders(message: string): string[] {
  return [
    ...new Set(Array.from(message.matchAll(PLACEHOLDER), (m) => m[1])),
  ].sort();
}

/** List blank translations or translations that change the named placeholders. */
export function validateCatalog(
  catalog: Readonly<Record<string, string>>,
): string[] {
  const errors: string[] = [];
  for (const [source, translated] of Object.entries(catalog)) {
    if (!translated.trim()) errors.push(`${source}: empty translation`);
    if (placeholders(source).join("\0") !== placeholders(translated).join("\0"))
      errors.push(`${source}: placeholder mismatch`);
  }
  return errors;
}

/** Translate a source message against a supplied catalog and validate values. */
export function translateMessage(
  locale: Locale,
  catalog: Readonly<Record<string, string>>,
  message: string,
  values?: TranslationValues,
): string {
  const translated =
    locale === "ko" ? catalogMessage(catalog, message) : undefined;
  const template = translated?.trim() ? translated : message;
  if (placeholders(message).join("\0") !== placeholders(template).join("\0"))
    throw new Error(`Translation placeholder mismatch: ${message}`);
  return template.replace(PLACEHOLDER, (_, key: string) => {
    if (!values || !Object.hasOwn(values, key))
      throw new Error(`Missing translation value: ${key}`);
    return String(values[key]);
  });
}

/** Bind a translator to a language; useful for memoized React consumers. */
export function translatorFor(locale: Locale): Translator {
  return (message, values) => {
    if (
      locale === "ko" &&
      !catalogMessage(koreanCatalog, message)?.trim() &&
      !preservedMessageSet.has(message) &&
      missingTranslations.size < MAX_MISSING_TRANSLATIONS
    )
      missingTranslations.add(message);
    return translateMessage(locale, koreanCatalog, message, values);
  };
}

/** Translate at invocation time, including outside React. */
export const t: Translator = (message, values) =>
  translatorFor(getLocale())(message, values);

/** Missing Korean app copy observed in this process, excluding reviewed code/data forms; capped at 2,000. */
export function getMissingTranslations(): readonly string[] {
  return [...missingTranslations].sort();
}
