import fs from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import { inspectFile, expandTemplate } from "./localization-source.mjs";
import { migrateSource } from "./localization-migrate.mjs";
import { migrateRichSource } from "./localization-rich.mjs";
const baseline = JSON.parse(
  fs.readFileSync("/private/tmp/buzz-ko-original-source.json", "utf8"),
);
const keys = new Set(
  JSON.parse(fs.readFileSync("../docs/localization/messages.json", "utf8")),
);
const owned = new Set([
  "desktop/src/shared/lib/datetime.ts",
  "desktop/src/features/messages/lib/dateFormatters.ts",
  "desktop/src/features/notifications/lib/notificationFormat.ts",
]);
const reviews = fs
  .readdirSync("../docs/localization")
  .filter((f) => /^batch-\d+-review\.json$/.test(f))
  .flatMap((f) => {
    const r = JSON.parse(fs.readFileSync("../docs/localization/" + f, "utf8"));
    return r.records ?? r.items ?? r.entries ?? [];
  });
for (const r of reviews) if (r.status === "excluded") keys.delete(r.source);
const previousHashes = JSON.parse(
  fs.readFileSync("../docs/localization/migration-hashes.json", "utf8"),
);
const nextHashes = {};
const hash = (s) => createHash("sha256").update(s).digest("hex");
const allRich = [];
const changed = [];
const templates = [];
for (const [file, before] of Object.entries(baseline)) {
  if (
    /(?:\.test\.|\.jsdom-test\.|\/testing\/|routeTree\.gen)/.test(file) ||
    owned.has(file)
  )
    continue;
  for (const item of inspectFile(file, before).found)
    if (ts.isTemplateExpression(item.node) && keys.has(item.message)) {
      const tree = ts.createSourceFile(
        file,
        before,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const expanded = expandTemplate(item.node, tree);
      if (expanded.variants.length > 1)
        for (const v of expanded.variants)
          templates.push({ message: v.message, file, line: item.line });
    }
  const rich = file.endsWith(".tsx")
    ? migrateRichSource(file, before)
    : { source: before, messages: [] };
  allRich.push(...rich.messages);
  let after = migrateSource(file, rich.source, keys);
  if (after === before) continue;
  if (file.endsWith("/SettingsPanels.tsx")) {
    after = 'import { LanguageSettings } from "./LanguageSettings";\n' + after;
    after = after.replace(
      '      <SettingsOptionGroupList>\n        <SettingsOptionGroup\n          data-testid="appearance-theme-card"',
      '      <LanguageSettings />\n      <SettingsOptionGroupList>\n        <SettingsOptionGroup\n          data-testid="appearance-theme-card"',
    );
  }
  const current = fs.readFileSync("../" + file, "utf8");
  if (current !== before && previousHashes[file] !== hash(current))
    throw new Error(
      `Refusing to overwrite edits outside the migration: ${file}`,
    );
  fs.writeFileSync("../" + file, after);
  nextHashes[file] = hash(after);
  changed.push(file);
}
fs.writeFileSync(
  "../docs/localization/migration-hashes.json",
  JSON.stringify(nextHashes, null, 2),
);
fs.writeFileSync(
  "../docs/localization/template-inventory.json",
  JSON.stringify(templates, null, 2),
);
fs.writeFileSync(
  "../docs/localization/rich-inventory.json",
  JSON.stringify(allRich, null, 2),
);
const unique = [...new Set(allRich.map((x) => x.message))].sort();
for (let i = 0; i < 3; i++)
  fs.writeFileSync(
    `../docs/localization/rich-${i + 1}-source.json`,
    JSON.stringify(
      unique.filter((_, n) => n % 3 === i),
      null,
      2,
    ),
  );
console.log(
  JSON.stringify({
    changedFiles: changed.length,
    richOccurrences: allRich.length,
    richMessages: unique.length,
  }),
);
