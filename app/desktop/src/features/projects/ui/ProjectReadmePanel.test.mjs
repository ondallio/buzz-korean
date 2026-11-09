import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(
  new URL("./ProjectReadmePanel.tsx", import.meta.url),
  "utf8",
);
const tree = ts.createSourceFile(
  "ProjectReadmePanel.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const names = [
  "decodeHtmlEntities",
  "htmlInlineToMarkdown",
  "normalizeReadmeMarkdown",
];
const functions = tree.statements.filter(
  (node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text),
);
assert.deepEqual(
  functions.map((node) => node.name.text),
  names,
  "Load the actual production normalization functions",
);
let productionCall = false;
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(tree) === "normalizeReadmeMarkdown"
  )
    productionCall = true;
  ts.forEachChild(node, visit);
}
visit(tree);
assert.equal(
  productionCall,
  true,
  "ReadmePanel must still call the normalization under test",
);
const compiled = ts.transpileModule(
  functions.map((node) => node.getText(tree)).join("\n"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  },
).outputText;
const normalize = vm.runInNewContext(`${compiled}\nnormalizeReadmeMarkdown`);

test("README normalization collapses three or more line breaks while preserving paragraph and line boundaries", () => {
  assert.equal(
    normalize(" First line.\nSecond line.\n\nThird.\n\n\n\nFourth. "),
    "First line.\nSecond line.\n\nThird.\n\nFourth.",
  );
});

test("README HTML normalization retains user text, links and inline markup without extra blank paragraphs", () => {
  assert.equal(
    normalize(
      '<h2>USER_TITLE &amp; notes</h2>\n<p>First<br>Second</p>\n\n<div><strong>USER_TEXT</strong> <a href="https://example.com/USER_PATH">USER_LINK</a></div>',
    ),
    "## USER_TITLE & notes\n\nFirst\nSecond\n\n**USER_TEXT** [USER_LINK](https://example.com/USER_PATH)",
  );
});
