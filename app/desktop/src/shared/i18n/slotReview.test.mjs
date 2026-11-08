import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { setLocale, t, validateCatalog } from "./index.ts";
import {
  personaCatalogCopy,
  getPersonaCatalogSelectionAriaLabel,
} from "@/features/agents/ui/personaLibraryCopy";

function productionExpression(
  relativePath,
  needle,
  bindings,
  expectedCount = 1,
  occurrence = 0,
) {
  const source = fs.readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
  const file = ts.createSourceFile(
    relativePath,
    source,
    99,
    true,
    ts.ScriptKind.TSX,
  );
  const expressions = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(file) === "localize" &&
      node.getText(file).includes(needle)
    )
      expressions.push(node.getText(file));
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(
    expressions.length,
    expectedCount,
    `${relativePath}: unique production expression for ${needle}`,
  );
  return vm.runInNewContext(expressions[occurrence], {
    localize: t,
    ...bindings,
  });
}
test.afterEach(() => setLocale("en"));

test("mixed restart outcomes use complete English and Korean sentences at the actual rendering expression", () => {
  for (const restartedCount of [1, 2])
    for (const failedRestartCount of [0, 1, 2]) {
      setLocale("en");
      const english = productionExpression(
        "features/agents/ui/AgentDefaultsEditor.tsx",
        "Saved. Restarted {restarted}",
        { restartedCount, failedRestartCount },
      );
      assert.equal(
        english,
        `Saved. Restarted ${restartedCount} agent${restartedCount === 1 ? "" : "s"}.${failedRestartCount ? ` ${failedRestartCount} couldn't restart — check the Agents page.` : ""}`,
      );
      setLocale("ko");
      const korean = productionExpression(
        "features/agents/ui/AgentDefaultsEditor.tsx",
        "Saved. Restarted {restarted}",
        { restartedCount, failedRestartCount },
      );
      assert.equal(
        korean,
        `저장했습니다. 에이전트 ${restartedCount}개를 다시 시작했습니다.${failedRestartCount ? ` ${failedRestartCount}개는 다시 시작하지 못했습니다. 에이전트 페이지를 확인하세요.` : ""}`,
      );
    }
});

test("verification announcements preserve code digits and translate both complete instruction variants", () => {
  setLocale("ko");
  for (const codeEntry of [true, false]) {
    const message = productionExpression(
      "features/settings/ui/MobilePairingCard.tsx",
      "Verification code {first}",
      { codeEntry, sasCode: "123456" },
    );
    assert.match(message, /인증 코드 123 456이 준비되었습니다\./);
    assert.match(
      message,
      codeEntry
        ? /휴대폰의 Buzz 앱에 이 코드를 입력하세요/
        : /모바일 기기의 코드와 일치하는지 확인/,
    );
    assert.doesNotMatch(message, /Enter|Check|ready/);
  }
});

test("terminal labels translate closing state and retain arbitrary tab titles", () => {
  setLocale("ko");
  for (const [session, expected] of [
    [{ closing: true, title: "USER_TAB" }, "터미널 2, 닫는 중"],
    [{ closing: false, title: "USER_TAB" }, "터미널 2, USER_TAB"],
    [{ closing: false, title: "SHELL" }, "터미널 2"],
  ])
    assert.equal(
      productionExpression(
        "features/terminal/TerminalSubstrate.tsx",
        "Terminal {number}, closing",
        { session, index: 1 },
      ),
      expected,
    );
});

test("channel link actions and follow failures translate only owned prose", () => {
  setLocale("ko");
  for (const messageLink of [null, {}])
    for (const occurrence of [0, 1])
      assert.equal(
        productionExpression(
          "shared/ui/markdown/ChannelDeepLink.tsx",
          "Open message: {label}",
          { messageLink, label: "USER_CHANNEL" },
          2,
          occurrence,
        ),
        messageLink ? "메시지 열기: USER_CHANNEL" : "채널 열기: USER_CHANNEL",
      );
  for (const isFollowing of [true, false]) {
    const message = productionExpression(
      "features/profile/ui/UserProfilePrimaryActions.tsx",
      "Unfollow failed: {error}",
      { isFollowing, error: { message: "RAW_PROVIDER_ERROR" } },
    );
    assert.equal(
      message,
      `${isFollowing ? "팔로우 취소" : "팔로우"}에 실패했습니다: RAW_PROVIDER_ERROR`,
    );
  }
});

test("persona registry getters remain live and action accessibility preserves user identity", () => {
  setLocale("en");
  const copy = personaCatalogCopy;
  assert.match(copy.teamEmptyState, /No agents in My Agents/);
  setLocale("ko");
  assert.match(copy.teamEmptyState, /내 에이전트에 아직 에이전트가 없습니다/);
  assert.equal(
    getPersonaCatalogSelectionAriaLabel("USER_NAME", true),
    "내 에이전트에서 USER_NAME 선택 해제",
  );
  assert.equal(
    getPersonaCatalogSelectionAriaLabel("USER_NAME", false),
    "내 에이전트에서 USER_NAME 선택",
  );
  const catalog = JSON.parse(
    fs.readFileSync(
      new URL("./catalogs/slot-review.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(validateCatalog(catalog), []);
});
