import assert from "node:assert/strict";
import test from "node:test";
import { inspectFile } from "./localization-source.mjs";
test("extracts visible labels but preserves machine values and user expressions", () => {
  const { found } = inspectFile(
    "Sample.tsx",
    `const x = <button data-testid="send-message" type="submit" aria-label="Send message">Send {userContent}</button>; const data={value:"private", label:"Private channel"};`,
  );
  assert.deepEqual(
    found.map((x) => x.message),
    ["Send message", "Send ", "Private channel"],
  );
});
test("captures whole interpolated presentation messages", () => {
  const { found } = inspectFile(
    "Sample.tsx",
    "const x=<button title={`Remove ${name} from ${channel}`}/>;",
  );
  assert.deepEqual(
    found.map((x) => x.message),
    ["Remove {value1} from {value2}"],
  );
});
