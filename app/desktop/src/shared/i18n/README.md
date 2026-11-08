# Desktop localization

`initializeLocale()` loads the device preference before the first React render.
Valid stored choices are `en` and `ko`. Without a valid choice, a Korean system
language selects Korean and other system languages select English. Node helpers
without a browser default to English.

React components call `useTranslation()` for a stable invocation-time `t` function, or
`useLocale()` when calling shared formatters. Each subscribed component updates
through `React.memo` without remounting or losing local state. Use `useLocaleMemo()` for derived translated labels: the stable `t` identity
alone does not invalidate a React memo. `useLocaleCallback()` keeps callback
identity stable across language changes; its translators and formatters read
the current language when invoked. This keeps connection effects from restarting.
Include ordinary captured values in the dependency arrays of both hooks.
`translatorFor(locale)` is available for explicitly locale-bound non-React work.

```tsx
function Example({ name }: { name: string }) {
  const { t } = useTranslation();
  return <p>{t("Hello {name}", { name })}</p>;
}
```

Pure helpers and notification delivery can call the exported `t()` function.
It reads the current locale at invocation time. Keep module-level labels as
source messages and translate when rendering or delivering them. Translating
once at module initialization freezes the old language.

The Korean catalog at `catalogs/index.ts` exports a source-English-keyed
`Record<string, string>`. Unknown messages retain their English source.
`getMissingTranslations()` reports observed missing Korean messages with a
2,000-entry cap. This fallback is not evidence of completed translation.
`validateCatalog()` rejects blank translations and mismatched named
placeholders. Missing interpolation arguments throw rather than showing an
incomplete sentence. Interpolation values are plain text and must not contain
translated protocol values, identifiers, or command names.

`setLocale()` writes one localStorage preference before notifying subscribers.
A write failure propagates and preserves the active locale. `LanguageSettings`
shows the failure next to its labeled select. Storage events update other
windows and `<html lang>` without recreating the application.

`localeTag()` returns `en-US` or `ko-KR` for `Intl` formatting. It does not select
a timezone. Cache formatter instances by locale and options, never solely by
module load time.

Retained app feedback uses `feedbackMessage(source, values)` and
`useLocalizedFeedback(null)`. This stores the source and copied scalar values,
then translates on render. Plain server/user strings stay verbatim even when
they happen to match a catalog key. Never translate rendered feedback again.
Use ordinary `useMemo` for canonical data or ownership/fence objects whose
identity must stay stable across locale changes; `useLocaleMemo` is for actual
translated presentation.
