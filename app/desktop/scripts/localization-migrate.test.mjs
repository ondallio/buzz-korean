import test from "node:test";
import assert from "node:assert/strict";
import { migrateSource } from "./localization-migrate.mjs";
test("localizes presentation only, subscribes component without remounting, and is idempotent", () => {
  const input =
    'export function Sample(){ return <button type="submit" data-testid="send">Send message</button>; }';
  const result = migrateSource("Sample.tsx", input, new Set(["Send message"]));
  assert.match(result, /useAppLocale\(\)/);
  assert.match(result, /localize\("Send message"\)/);
  assert.match(result, /type="submit" data-testid="send"/);
  assert.equal(
    migrateSource("Sample.tsx", result, new Set(["Send message"])),
    result,
  );
});
test("keeps module-level labels reactive using getters without changing enum values", () => {
  const result = migrateSource(
    "labels.ts",
    'export const options=[{value:"open",label:"Open channel"}];',
    new Set(["Open channel"]),
  );
  assert.match(result, /get label\(\)/);
  assert.match(result, /value:"open"/);
});
test("whole template messages preserve expression evaluation and named slots", () => {
  const result = migrateSource(
    "X.tsx",
    "export const X=()=> <button title={`Remove ${name}`}/>;",
    new Set(["Remove {value1}"]),
  );
  assert.match(
    result,
    /localize\("Remove \{value1\}", \{ "value1": String\(name\) \}\)/,
  );
  assert.match(result, /useAppLocale/);
});

test("never injects a locale hook into a nested event callback", () => {
  const result = migrateSource(
    "Sample.tsx",
    "export function Sample(){ return <button onClick={()=>{submit()}}>Send message</button>; }",
    new Set(["Send message"]),
  );
  assert.equal((result.match(/useAppLocale\(\)/g) || []).length, 1);
  assert.doesNotMatch(result, /onClick=\{\(\)=>\{\s*useAppLocale/);
});
test("expands English grammar suffixes into complete source messages", () => {
  const source =
    'export const X=()=> <button title={`Join (${count} participant${count===1?"":"s"})`}/>;';
  const result = migrateSource(
    "X.tsx",
    source,
    new Set(["Join ({value1} participant{value2})"]),
  );
  assert.match(result, /Join \(\{value1\} participant\)/);
  assert.match(result, /Join \(\{value1\} participants\)/);
  assert.doesNotMatch(result, /value2/);
});
