/** Languages supported by the desktop interface. */
export type Locale = "en" | "ko";

/** Device-wide language preference, shared by desktop windows. */
export const LOCALE_STORAGE_KEY = "buzz.locale.v1";

const listeners = new Set<() => void>();
let currentLocale: Locale = "en";
let initialized = false;
let storageWindow: Window | undefined;

/** Resolve an explicit preference before falling back to the operating system. */
export function resolveLocale(
  preference: string | null | undefined,
  systemLanguage: string | undefined,
): Locale {
  if (preference === "ko" || preference === "en") return preference;
  return /^ko(?:-|$)/i.test(systemLanguage ?? "") ? "ko" : "en";
}

function storedLocale(): Locale {
  if (typeof window === "undefined") return "en";
  let preference: string | null = null;
  try {
    preference = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    preference = null;
  }
  return resolveLocale(preference, window.navigator?.language);
}

function applyLocale(locale: Locale): void {
  const changed = locale !== currentLocale;
  currentLocale = locale;
  globalThis.document?.documentElement?.setAttribute("lang", locale);
  if (changed) {
    for (const listener of listeners) listener();
  }
}

function onStorage(event: StorageEvent): void {
  if (event.key !== LOCALE_STORAGE_KEY && event.key !== null) return;
  if (event.storageArea !== null && event.storageArea !== window.localStorage)
    return;
  applyLocale(storedLocale());
}

/** Load and apply language before rendering without remounting the app. */
export function initializeLocale(): void {
  initialized = true;
  applyLocale(storedLocale());
  if (
    typeof window !== "undefined" &&
    typeof window.addEventListener === "function" &&
    storageWindow !== window
  ) {
    storageWindow?.removeEventListener?.("storage", onStorage);
    window.addEventListener("storage", onStorage);
    storageWindow = window;
  }
}

/** Current language for non-React formatters and notification delivery. */
export function getLocale(): Locale {
  if (!initialized) initializeLocale();
  return currentLocale;
}

/** Persist one language choice before exposing it; storage failures propagate. */
export function setLocale(locale: Locale): void {
  if (locale !== "en" && locale !== "ko")
    throw new Error("Unsupported interface language");
  getLocale();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
  applyLocale(locale);
}

/** Observe language changes in React and other live consumers. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** BCP 47 formatting locale without imposing a timezone. */
export function localeTag(locale: Locale = getLocale()): "en-US" | "ko-KR" {
  return locale === "ko" ? "ko-KR" : "en-US";
}
