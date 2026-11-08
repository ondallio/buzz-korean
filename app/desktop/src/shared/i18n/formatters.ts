import { formatLocalizedDateTime } from "@/shared/lib/datetime";
import { localeTag } from "./store";

type LocaleTag = ReturnType<typeof localeTag>;

/** Cache at most the two supported locales, selecting the current one per call. */
export function createLocaleDateTimeFormatter(
  options: Intl.DateTimeFormatOptions,
) {
  const formatters: Partial<Record<LocaleTag, Intl.DateTimeFormat>> = {};
  const current = () => {
    const locale = localeTag();
    formatters[locale] ??= new Intl.DateTimeFormat(locale, options);
    return formatters[locale];
  };
  return {
    format(value: Date | number): string {
      return formatLocalizedDateTime(
        current(),
        value instanceof Date ? value : new Date(value),
      );
    },
    formatToParts(value: Date | number): Intl.DateTimeFormatPart[] {
      return current().formatToParts(value);
    },
  };
}

/** Format numbers in the selected language without changing numeric values. */
export function createLocaleNumberFormatter(options: Intl.NumberFormatOptions) {
  const formatters: Partial<Record<LocaleTag, Intl.NumberFormat>> = {};
  const current = () => {
    const locale = localeTag();
    formatters[locale] ??= new Intl.NumberFormat(locale, options);
    return formatters[locale];
  };
  return {
    format(value: number): string {
      return current().format(value);
    },
    formatToParts(value: number): Intl.NumberFormatPart[] {
      return current().formatToParts(value);
    },
  };
}

/** Format relative durations in the selected language without fixing a timezone. */
export function createLocaleRelativeTimeFormatter(
  options: Intl.RelativeTimeFormatOptions,
) {
  const formatters: Partial<Record<LocaleTag, Intl.RelativeTimeFormat>> = {};
  const current = () => {
    const locale = localeTag();
    formatters[locale] ??= new Intl.RelativeTimeFormat(locale, options);
    return formatters[locale];
  };
  return {
    format(value: number, unit: Intl.RelativeTimeFormatUnit): string {
      return current().format(value, unit);
    },
  };
}
