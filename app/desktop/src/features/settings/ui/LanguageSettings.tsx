import {
  getNativeLocaleSyncStatus,
  subscribeNativeLocaleSync,
  retryNativeLocaleSync,
} from "@/shared/i18n/native";
import { useState, useSyncExternalStore } from "react";
import { setLocale, useTranslation, type Locale } from "@/shared/i18n";

/** Device language preference, with persistence errors shown beside the control. */
export function LanguageSettings() {
  const { locale, t } = useTranslation();
  const nativeStatus = useSyncExternalStore(
    subscribeNativeLocaleSync,
    getNativeLocaleSyncStatus,
    getNativeLocaleSyncStatus,
  );
  const [saveFailed, setSaveFailed] = useState(false);

  function changeLanguage(value: Locale): void {
    try {
      setLocale(value);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }

  return (
    <section
      className="space-y-3 rounded-xl border p-4"
      data-testid="language-settings"
    >
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="interface-language">
          {t("Language")}
        </label>
        <p
          className="text-sm text-muted-foreground"
          id="interface-language-description"
        >
          {t("Choose the language used by Buzz on this device.")}
        </p>
      </div>
      <select
        aria-describedby={
          saveFailed
            ? "interface-language-description interface-language-error"
            : "interface-language-description"
        }
        className="min-h-9 rounded-md border bg-background px-3 py-2 text-sm"
        data-testid="interface-language"
        id="interface-language"
        onChange={(event) =>
          changeLanguage(event.target.value === "ko" ? "ko" : "en")
        }
        value={locale}
      >
        <option lang="en" value="en">
          English
        </option>
        <option lang="ko" value="ko">
          한국어
        </option>
      </select>
      {nativeStatus.state === "error" && (
        <div role="alert" className="text-sm text-destructive">
          <p>
            {t(
              "The app language was saved, but native menus could not be updated. Try again.",
            )}
          </p>
          <button type="button" onClick={retryNativeLocaleSync}>
            {t("Retry")}
          </button>
        </div>
      )}
      {saveFailed && (
        <p
          className="text-sm text-destructive"
          id="interface-language-error"
          role="alert"
        >
          {t(
            "Could not save the language. Check storage access and try again.",
          )}
        </p>
      )}
    </section>
  );
}
