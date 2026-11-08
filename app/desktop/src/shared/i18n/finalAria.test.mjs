import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setLocale, t } from "./index.ts";
import { Carousel, CarouselContent, CarouselItem } from "@/shared/ui/carousel";

function expressions(relativePath, attribute, needle, bindings, count = 1) {
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
  const found = [];
  function visit(node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(file) === attribute &&
      node.initializer?.getText(file).includes(needle)
    ) {
      assert.ok(ts.isJsxExpression(node.initializer));
      found.push(node.initializer.expression.getText(file));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(
    found.length,
    count,
    `${relativePath}: expected production sink count`,
  );
  return found.map((expression) =>
    vm.runInNewContext(expression, { localize: t, ...bindings }),
  );
}
test.afterEach(() => setLocale("en"));

test("mention toggles and recipient row actions translate complete variants and preserve user names", () => {
  setLocale("ko");
  for (const isAlwaysAddressed of [true, false])
    assert.deepEqual(
      expressions(
        "features/messages/ui/MentionAutocomplete.tsx",
        "aria-label",
        "automatically mention",
        { isAlwaysAddressed, suggestion: { displayName: "USER_NAME" } },
      ),
      [
        isAlwaysAddressed
          ? "이 스레드에서 USER_NAME 자동 멘션 끄기"
          : "USER_NAME 자동 멘션 켜기",
      ],
    );
  for (const isAlreadySelected of [true, false])
    assert.deepEqual(
      expressions(
        "features/messages/ui/NewMessageResultRow.tsx",
        "aria-label",
        "Already added",
        { isAlreadySelected, name: "USER_NAME" },
      ),
      [isAlreadySelected ? "USER_NAME 추가됨" : "USER_NAME 추가"],
    );
});

test("onboarding installation and settings loading labels preserve harness identity", () => {
  const runtime = { label: "USER_HARNESS" };
  for (const locale of ["en", "ko"]) {
    setLocale(locale);
    for (const installError of [null, "RAW_ERROR"]) {
      const [label] = expressions(
        "features/onboarding/ui/SetupStep.tsx",
        "aria-label",
        "Retry installing",
        { runtime, installError },
      );
      assert.equal(
        label,
        locale === "ko"
          ? `USER_HARNESS 설치${installError ? " 다시 시도" : ""}`
          : `${installError ? "Retry installing" : "Install"} USER_HARNESS`,
      );
    }
    for (const isInstalling of [true, false]) {
      const [label] = expressions(
        "features/settings/ui/HarnessRow.tsx",
        "aria-label",
        "{harness} installing",
        { runtime, isInstalling },
      );
      assert.equal(
        label,
        locale === "ko"
          ? `USER_HARNESS ${isInstalling ? "설치 중" : "연결 중"}`
          : `USER_HARNESS ${isInstalling ? "installing" : "connecting"}`,
      );
    }
  }
});

test("all degraded community triggers translate fallback names and retain actual community names", () => {
  setLocale("ko");
  for (const activeCommunity of [null, { name: "USER_COMMUNITY" }])
    assert.deepEqual(
      expressions(
        "features/communities/ui/CommunitySwitcher.tsx",
        "aria-label",
        "activeCommunity",
        { degraded: true, activeCommunity, connectionLabel: "연결 중…" },
        3,
      ),
      Array(3).fill(`${activeCommunity?.name ?? "커뮤니티"} — 연결 중…`),
    );
  for (const text of ["", "USER_STATUS"])
    assert.deepEqual(
      expressions(
        "features/user-status/ui/UserNameIndicators.tsx",
        "aria-label",
        "User status",
        { statusEmoji: "🙂", status: { text } },
      ),
      [`🙂 ${text || "사용자 상태"}`],
    );
});

test("actual carousel and slide role descriptions use the selected language", () => {
  for (const locale of ["en", "ko"]) {
    setLocale(locale);
    const html = renderToStaticMarkup(
      React.createElement(
        Carousel,
        null,
        React.createElement(
          CarouselContent,
          null,
          React.createElement(CarouselItem, null, "USER_SLIDE"),
        ),
      ),
    );
    assert.match(
      html,
      new RegExp(
        `aria-roledescription="${locale === "ko" ? "캐러셀" : "carousel"}"`,
      ),
    );
    assert.match(
      html,
      new RegExp(
        `aria-roledescription="${locale === "ko" ? "슬라이드" : "slide"}"`,
      ),
    );
    assert.match(html, /USER_SLIDE/);
  }
});
