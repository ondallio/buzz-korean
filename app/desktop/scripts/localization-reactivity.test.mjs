import test from "node:test";
import assert from "node:assert/strict";
import { bindComponentTranslations } from "./localization-reactivity.mjs";
test("memoized copy depends on locale-bound translator rather than unused locale calls", () => {
  const input =
    'import { t as localize, useLocale as useAppLocale, getLocale as getAppLocale } from "@/shared/i18n"; export function X(){ useAppLocale(); const x=useMemo(()=>localize("Hello"),[getAppLocale()]); return <p>{x}</p>; }';
  const result = bindComponentTranslations("X.tsx", input);
  assert.match(result, /const \{ t: localize \} = useAppTranslation\(\)/);
  assert.match(result, /\[localize\]/);
  assert.doesNotMatch(result, /getAppLocale/);
});
