import { useCallback, useMemo, useSyncExternalStore } from "react";
import { t, type Translator } from "./messages";
import { getLocale, subscribeLocale, type Locale } from "./store";

/** Subscribe a mounted component to language changes, including through memo. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, () => "en");
}

/** Subscribe to language changes with a stable translator that reads at invocation time. */
export function useTranslation(): { locale: Locale; t: Translator } {
  const locale = useLocale();
  return useMemo(() => ({ locale, t }), [locale]);
}

/** Recompute locale-sensitive derived labels, including labels returned by helpers. */
export function useLocaleMemo<T>(
  factory: () => T,
  dependencies: import("react").DependencyList,
): T {
  const locale = useLocale();
  // The caller owns its normal dependencies; this wrapper adds the device locale.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies are supplied by the caller and locale is an intentional invalidation signal.
  return useMemo(factory, [locale, ...dependencies]);
}

/** Memoize an event closure without restarting effects merely because language changes. */
export function useLocaleCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  dependencies: import("react").DependencyList,
): T {
  useLocale();
  // Shared translators/formatters read the current language when invoked. The
  // caller still owns dependencies for values captured from its render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies are supplied by the caller.
  return useCallback(callback, dependencies);
}
