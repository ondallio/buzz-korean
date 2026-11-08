import ts from "../../desktop/node_modules/typescript/lib/typescript.js";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../desktop", import.meta.url));
const conf = ts.readConfigFile(`${root}/tsconfig.json`, ts.sys.readFile);
const cfg = ts.parseJsonConfigFileContent(conf.config, ts.sys, root);
const program = ts.createProgram(cfg.fileNames, cfg.options);
const checker = program.getTypeChecker();
const all = [];
const memoSymbols = new Map();
const varDeps = new Map();
const effects = [];
const refs = (n) => {
  const r = new Set();
  const visit = (x) => {
    if (ts.isIdentifier(x)) {
      const s = checker.getSymbolAtLocation(x);
      if (s) r.add(s);
    }
    ts.forEachChild(x, visit);
  };
  if (n) visit(n);
  return r;
};
for (const sf of program.getSourceFiles()) {
  if (
    !sf.fileName.startsWith(`${root}/src/`) ||
    /(?:\.test\.|\.jsdom-test\.|\/testing\/|\/shared\/i18n\/|routeTree\.gen|\/assets\/)/.test(
      sf.fileName,
    )
  )
    continue;
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer) {
      const syms = refs(n.name);
      const dep = refs(n.initializer);
      for (const s of syms) varDeps.set(s, dep);
      if (
        ts.isCallExpression(n.initializer) &&
        /\buseLocaleMemo$/.test(n.initializer.expression.getText(sf))
      ) {
        const call = n.initializer;
        const rec = {
          file: sf.fileName.slice(root.length + 1),
          line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
          binding: n.name.getText(sf),
          factory: call.arguments[0]?.getText(sf),
          dependencies: call.arguments[1]?.getText(sf),
          effects: [],
        };
        all.push(rec);
        for (const s of syms) memoSymbols.set(s, rec);
      }
    }
    if (
      ts.isCallExpression(n) &&
      /\buse(?:Layout)?Effect$/.test(n.expression.getText(sf)) &&
      n.arguments[1]
    )
      effects.push({ sf, node: n, refs: refs(n.arguments[1]) });
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
// Follow statically named JSX props into destructured component parameters.
// This catches a pure parent array that resets state in a child effect.
for (const sf of program.getSourceFiles()) {
  if (
    !sf.fileName.startsWith(`${root}/src/`) ||
    /(?:\.test\.|\.jsdom-test\.|\/testing\/)/.test(sf.fileName)
  )
    continue;
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const signature = checker
        .getTypeAtLocation(node.tagName)
        .getCallSignatures()[0];
      const declaration = signature?.getDeclaration();
      const parameter = declaration?.parameters?.[0];
      if (parameter && ts.isObjectBindingPattern(parameter.name)) {
        const parameters = new Map(
          parameter.name.elements.map((element) => [
            element.propertyName?.getText() ?? element.name.getText(),
            refs(element.name),
          ]),
        );
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || !attr.initializer) continue;
          const targets = parameters.get(attr.name.getText());
          if (!targets) continue;
          const dependencies = refs(attr.initializer);
          for (const target of targets) {
            const prior = varDeps.get(target) ?? new Set();
            for (const dependency of dependencies) prior.add(dependency);
            varDeps.set(target, prior);
          }
        }
      }
    }
    if (
      ts.isCallExpression(node) &&
      /^use[A-Z]/.test(node.expression.getText(sf)) &&
      !/^use(?:LocaleMemo|LocaleCallback|Memo|Callback|State|Ref|Effect|LayoutEffect|SyncExternalStore)$/.test(
        node.expression.getText(sf),
      )
    ) {
      const declaration = checker.getResolvedSignature(node)?.getDeclaration();
      for (let i = 0; i < (declaration?.parameters?.length ?? 0); i++) {
        const parameter = declaration.parameters[i];
        const argument = node.arguments[i];
        if (!argument) continue;
        const assign = (targets, dependencies) => {
          for (const target of targets) {
            const prior = varDeps.get(target) ?? new Set();
            for (const dependency of dependencies) prior.add(dependency);
            varDeps.set(target, prior);
          }
        };
        if (
          ts.isObjectBindingPattern(parameter.name) &&
          ts.isObjectLiteralExpression(argument)
        ) {
          for (const element of parameter.name.elements) {
            const key =
              element.propertyName?.getText() ?? element.name.getText();
            for (const property of argument.properties) {
              if (
                ts.isPropertyAssignment(property) &&
                property.name.getText() === key
              )
                assign(refs(element.name), refs(property.initializer));
              else if (
                ts.isShorthandPropertyAssignment(property) &&
                property.name.getText() === key
              )
                assign(refs(element.name), refs(property.name));
            }
          }
        } else if (ts.isIdentifier(parameter.name))
          assign(refs(parameter.name), refs(argument));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
for (const e of effects) {
  const seen = new Set();
  const found = new Set();
  const walk = (s, depth) => {
    if (seen.has(s) || depth > 8) return;
    seen.add(s);
    if (memoSymbols.has(s)) found.add(memoSymbols.get(s));
    for (const d of varDeps.get(s) || []) walk(d, depth + 1);
  };
  for (const s of e.refs) walk(s, 0);
  for (const rec of found)
    rec.effects.push({
      file: e.sf.fileName.slice(root.length + 1),
      line: e.sf.getLineAndCharacterOfPosition(e.node.getStart()).line + 1,
      source: e.node.getText(e.sf),
    });
}
const linked = all.filter((x) => x.effects.length);
console.log(
  JSON.stringify(
    { total: all.length, linked: linked.length, sites: linked },
    null,
    2,
  ),
);
