import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inventory } from "./localization-source.mjs";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src",
);
const entries = inventory(root);
const unique = [...new Set(entries.map((e) => e.message))].sort();
fs.writeFileSync(
  path.resolve(root, "../../docs/localization/inventory.json"),
  JSON.stringify(entries, null, 2) + "\n",
);
fs.writeFileSync(
  path.resolve(root, "../../docs/localization/messages.json"),
  JSON.stringify(unique, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    occurrences: entries.length,
    unique: unique.length,
    byKind: Object.fromEntries(
      [...new Set(entries.map((x) => x.kind))].map((k) => [
        k,
        entries.filter((x) => x.kind === k).length,
      ]),
    ),
  }),
);
