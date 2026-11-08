import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { setLocale } from "@/shared/i18n";
import {
  setup,
  deferred,
  KEY,
  TEXT,
} from "./useMentionSendFlow.test-support.mjs";
afterEach(() => setLocale("en"));
test("language change keeps nonmember invitation and sends its exact draft once", async () => {
  const s = await setup();
  assert.equal(s.result.current.nonMemberPromptProps.open, true);
  await s.act(async () => setLocale("ko"));
  assert.equal(s.result.current.nonMemberPromptProps.open, true);
  assert.equal(s.options.contentRef.current, TEXT);
  await s.invite();
  assert.equal(s.events("SEND").length, 1);
  assert.equal(s.events("SEND")[0][1], TEXT);
  assert.deepEqual(Array.from(s.events("SEND")[0][2]), [KEY]);
});
for (const stage of ["add", "publish"]) {
  test(`language change during delayed ${stage} preserves send ownership and cleanup`, async () => {
    const s = await setup();
    const gate = deferred();
    s.control[stage] = gate;
    await s.invite();
    assert.equal(s.result.current.isPreparingMentionSend, true);
    await s.act(async () => setLocale("ko"));
    assert.equal(s.result.current.isPreparingMentionSend, true);
    await s.finish(gate);
    assert.equal(s.events("SEND").length, 1);
    assert.equal(s.events("SEND")[0][1], TEXT);
    assert.deepEqual(Array.from(s.events("SEND")[0][2]), [KEY]);
    assert.equal(s.options.contentRef.current, "");
    assert.equal(s.result.current.isPreparingMentionSend, false);
  });
}
