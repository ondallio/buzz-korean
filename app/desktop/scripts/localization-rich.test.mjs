import test from "node:test";
import assert from "node:assert/strict";
import { migrateRichSource } from "./localization-rich.mjs";
test("whole rich messages retain links and allow Korean word order", () => {
  const r = migrateRichSource(
    "X.tsx",
    "const X=()=> <p>Read <a href={url}>the docs</a> for {name}.</p>;",
  );
  assert.equal(r.messages[0].message, "Read {part1} for {part2}.");
  assert.match(r.source, /part1: \(<a href=\{url\}>the docs<\/a>\)/);
});
test("English suffix conditions become complete singular and plural messages", () => {
  const r = migrateRichSource(
    "X.tsx",
    'const X=()=> <p>{count} memory entr{count===1 ? "y" : "ies"} saved.</p>;',
  );
  assert.deepEqual(
    r.messages.map((m) => m.message),
    ["{part1} memory entry saved.", "{part1} memory entries saved."],
  );
  assert.doesNotMatch(r.source, /part2/);
});
test("does not combine separate paragraphs or repeated mapped items", () => {
  const r = migrateRichSource(
    "X.tsx",
    "const X=()=> <div><p>First</p><p>Second</p></div>;",
  );
  assert.equal(r.messages.length, 0);
});
