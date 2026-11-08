import fs from "node:fs";
import ts from "typescript";
import { productionFiles } from "./localization-source.mjs";
const translatorNames = new Set([
  "t",
  "localize",
  "translateInterfaceText",
  "translateFinalText",
  "translatePairingStatus",
]);
const result = [];
for (const file of productionFiles("src")) {
  if (file.includes("/shared/i18n/")) continue;
  const s = fs.readFileSync(file, "utf8"),
    tree = ts.createSourceFile(file, s, 99, true, file.endsWith("x") ? 4 : 3),
    bindings = [],
    edits = [];
  function nearestFunction(n) {
    for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return p;
    return null;
  }
  function inventory(n) {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isArrayBindingPattern(n.name) &&
      n.initializer &&
      ts.isCallExpression(n.initializer) &&
      ["useState", "React.useState"].includes(
        n.initializer.expression.getText(tree),
      )
    ) {
      const setter = n.name.elements[1]?.name?.getText(tree),
        type = n.initializer.typeArguments
          ?.map((t) => t.getText(tree))
          .join("")
          .replace(/\s/g, "");
      if (
        setter &&
        /^set\w*(?:Error|Warning|Notice|StatusMessage)\w*$/.test(setter) &&
        (type === "string|null" ||
          type === "string" ||
          (!type &&
            n.initializer.arguments[0] &&
            ts.isStringLiteral(n.initializer.arguments[0])))
      )
        bindings.push({
          setter,
          call: n.initializer,
          owner: nearestFunction(n),
          dirty: false,
        });
    }
    ts.forEachChild(n, inventory);
  }
  inventory(tree);
  function collect(n, binding) {
    if (!n) return;
    if (
      ts.isCallExpression(n) &&
      translatorNames.has(n.expression.getText(tree))
    ) {
      edits.push({
        start: n.expression.getStart(tree),
        end: n.expression.end,
        text: "localizedFeedback",
      });
      binding.dirty = true;
    } else if (ts.isConditionalExpression(n)) {
      collect(n.whenTrue, binding);
      collect(n.whenFalse, binding);
    } else if (
      ts.isBinaryExpression(n) &&
      [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        n.operatorToken.kind,
      )
    ) {
      collect(n.left, binding);
      collect(n.right, binding);
    } else if (ts.isParenthesizedExpression(n)) collect(n.expression, binding);
    else if (ts.isArrowFunction(n)) {
      if (ts.isBlock(n.body)) {
        function returns(x) {
          if (ts.isReturnStatement(x)) collect(x.expression, binding);
          else if (!ts.isFunctionLike(x)) ts.forEachChild(x, returns);
        }
        returns(n.body);
      } else collect(n.body, binding);
    }
  }
  function visit(n) {
    if (ts.isCallExpression(n)) {
      const name = n.expression.getText(tree),
        matches = bindings.filter((b) => b.setter === name);
      for (let p = n.parent; p; p = p.parent) {
        const b = matches.find((b) => b.owner === p);
        if (b) {
          collect(n.arguments[0], b);
          break;
        }
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(tree);
  for (const b of bindings.filter((b) => b.dirty)) {
    edits.push({
      start: b.call.expression.getStart(tree),
      end: b.call.arguments.pos,
      text: "useLocalizedFeedback(",
    });
  }
  if (!edits.length) continue;
  let out = s;
  for (const e of edits.sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  out =
    'import { feedbackMessage as localizedFeedback, useLocalizedFeedback } from "@/shared/i18n";\n' +
    out;
  fs.writeFileSync(file, out);
  result.push({
    file,
    setters: bindings.filter((b) => b.dirty).map((b) => b.setter),
    translatedAssignments:
      edits.length - bindings.filter((b) => b.dirty).length,
  });
}
const recordPath = "../docs/localization/feedback-state-migration.json";
const previous = JSON.parse(fs.readFileSync(recordPath, "utf8"));
fs.writeFileSync(
  recordPath,
  JSON.stringify([...previous, ...result], null, 2) + "\n",
);
console.log({
  files: result.length,
  states: result.reduce((n, r) => n + r.setters.length, 0),
  assignments: result.reduce((n, r) => n + r.translatedAssignments, 0),
});
