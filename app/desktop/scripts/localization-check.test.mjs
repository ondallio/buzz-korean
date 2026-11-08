import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSource } from "./localization-check.mjs";
test("reports missing Korean and named values from actual calls", () => {
  const r = analyzeSource("X.tsx", 'const x=t("Hello {name}",{});', {});
  assert.equal(r.missing[0].message, "Hello {name}");
  assert.equal(r.valueErrors[0].missingValue, "name");
});
test("checks whole rich branches and camelCase accessible labels without translating conditions", () => {
  const r = analyzeSource(
    "X.tsx",
    'const x=<><LocalizedMessage message={mode==="open"?"Hi {name}":"Bye {name}"} values={{name:user}}/><Spinner ariaLabel="Loading"/></>;',
    { "Hi {name}": "안녕 {name}", "Bye {name}": "잘 가요 {name}" },
  );
  assert.equal(r.missing.length, 0);
  assert.equal(r.valueErrors.length, 0);
  assert.equal(r.unwrappedAttributes[0].message, "Loading");
});

test("detects raw custom-prop templates and feedback while preserving data-only templates", () => {
  const r = analyzeSource(
    "X.tsx",
    'const x=<><Chip triggerAriaLabel={`Open profile for ${name}`}/><View title={`#${name}`}/><Panel headerSubtitle="Some app help"/></>; setSaveError(error.message ?? "Could not save.");',
    {},
  );
  assert.equal(r.unwrappedAttributes.length, 2);
  assert.equal(r.unwrappedAttributes[0].attribute, "triggerAriaLabel");
  assert.equal(r.unwrappedFeedback[0].message, "Could not save.");
});
