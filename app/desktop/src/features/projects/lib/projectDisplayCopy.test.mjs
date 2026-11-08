import assert from "node:assert/strict";
import test from "node:test";
import { setLocale } from "@/shared/i18n";
import { formatProjectCount } from "./projectDisplayCopy.ts";

test.afterEach(() => setLocale("en"));
for (const [kind, singular, plural, unit] of [
  ["message", "message", "messages", "메시지"],
  ["member", "member", "members", "멤버"],
  ["repository", "repository", "repositories", "저장소"],
]) {
  test(`whole ${kind} count labels preserve singular/plural semantics and source number`, () => {
    assert.equal(formatProjectCount(kind, 1), `1 ${singular}`);
    assert.equal(formatProjectCount(kind, 1234), `1,234 ${plural}`);
    setLocale("ko");
    assert.equal(
      formatProjectCount(kind, 1),
      `${unit} 1${kind === "member" ? "명" : "개"}`,
    );
    assert.equal(
      formatProjectCount(kind, 1234),
      `${unit} 1,234${kind === "member" ? "명" : "개"}`,
    );
  });
}
test("truncated message count is a complete sentence variant, with unchanged numeric input", () => {
  const count = 1234;
  assert.equal(formatProjectCount("message", 1, true), "1+ message");
  assert.equal(formatProjectCount("message", count, true), "1,234+ messages");
  setLocale("ko");
  assert.equal(formatProjectCount("message", 1, true), "메시지 1개 이상");
  assert.equal(
    formatProjectCount("message", count, true),
    "메시지 1,234개 이상",
  );
  assert.equal(count, 1234);
});
