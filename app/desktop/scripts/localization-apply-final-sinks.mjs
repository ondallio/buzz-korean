import fs from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import { componentBody } from "./localization-migrate.mjs";
import ko from "../src/shared/i18n/catalogs/index.ts";
const rows = JSON.parse(
  fs.readFileSync("../docs/localization/final-root-sinks.json", "utf8"),
);
const groups = Map.groupBy(rows, (r) => r.file),
  changed = [];
for (const [file, items] of groups) {
  const source = fs.readFileSync(file, "utf8"),
    hash = crypto.createHash("sha256").update(source).digest("hex");
  if (items.some((r) => r.fileSha256 !== hash))
    throw Error("Source drift " + file);
  const tree = ts.createSourceFile(
    file,
    source,
    99,
    true,
    file.endsWith("x") ? 4 : 3,
  );
  const edits = [];
  for (const r of items) {
    for (const v of r.variants)
      if (!(v.message in ko)) throw Error("Missing " + v.message);
    if (source.slice(r.start, r.end) !== r.rawNodeSource)
      throw Error("Node drift " + file);
    const msg = r.variants.reduceRight(
      (acc, v, i) =>
        i === r.variants.length - 1
          ? JSON.stringify(v.message)
          : `(${v.conditions.join(" && ")}) ? ${JSON.stringify(v.message)} : (${acc})`,
      "",
    );
    let text = `translateFinalText(${msg}${r.values.length ? ", { " + r.values.map(([k, v]) => `${JSON.stringify(k)}: String(${v})`).join(", ") + " }" : ""})`;
    if (r.jsxAttribute) text = "{" + text + "}";
    edits.push({ start: r.start, end: r.end, text });
  }
  let hook = false;
  function visit(n) {
    const body = componentBody(n);
    if (
      body &&
      !/\b(?:useAppTranslation|useAppLocale|useLocale|useTranslation|useInterfaceLocale|useLocaleMemo|useLocaleCallback)\(/.test(
        body.getText(tree),
      )
    ) {
      if (ts.isBlock(body))
        edits.push({
          start: body.getStart(tree) + 1,
          end: body.getStart(tree) + 1,
          text: "\n useFinalLocale();\n",
        });
      else {
        edits.push({
          start: body.getStart(tree),
          end: body.getStart(tree),
          text: "{ useFinalLocale(); return (",
        });
        edits.push({ start: body.end, end: body.end, text: "); }" });
      }
      hook = true;
    }
    ts.forEachChild(n, visit);
  }
  visit(tree);
  let out = source;
  for (const e of edits.sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  out =
    `import { t as translateFinalText${hook ? ", useLocale as useFinalLocale" : ""} } from "@/shared/i18n";\n` +
    out;
  fs.writeFileSync(file, out);
  changed.push({
    file,
    sites: items.length,
    sha256: crypto.createHash("sha256").update(out).digest("hex"),
  });
}
fs.writeFileSync(
  "../docs/localization/final-sinks-application.json",
  JSON.stringify(
    {
      changed,
      excluded: [
        "projects implementation delegated",
        "failureNoun sentence manual repair",
        "formatAgentCountLabel localized helper needs source review",
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log({ files: changed.length, sites: rows.length });
