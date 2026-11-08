import assert from "node:assert/strict";
import test from "node:test";
import { setLocale } from "@/shared/i18n";
import * as helpers from "./projectsViewHelpers.ts";
import {
  deleteHarnessConfirmMessage,
  deleteConfirmState,
} from "@/features/settings/ui/harnessGalleryLogic.ts";
import {
  adapterUpdateWarning,
  entryStatusLabel,
  installLinkLabel,
} from "@/features/settings/ui/harnessCatalogLogic.ts";

test("Korean project relative time uses complete messages without English plural suffixes", () => {
  try {
    setLocale("ko");
    assert.equal(helpers.relativeTime(1000, 1120), "2분 전");
    assert.equal(helpers.relativeTime(1000, 1001), "1초 전");
    setLocale("en");
    assert.equal(helpers.relativeTime(1000, 1120), "2 minutes ago");
  } finally {
    setLocale("en");
  }
});

test("project status translation is presentation-only and distinguishes Open from an action", () => {
  try {
    setLocale("ko");
    const status = "Open";
    assert.equal(helpers.projectWorkItemStatusLabel(status), "열림");
    assert.equal(status, "Open");
    assert.equal(helpers.projectWorkItemStatusLabel("In Progress"), "진행 중");
    assert.equal(
      helpers.projectWorkItemStatusLabel("custom-user-label"),
      "custom-user-label",
    );
    setLocale("en");
    assert.equal(helpers.projectWorkItemStatusLabel(status), "Open");
  } finally {
    setLocale("en");
  }
});

test("harness confirmation and adapter warning localize whole sentences and preserve command names", () => {
  try {
    setLocale("ko");
    assert.equal(
      deleteHarnessConfirmMessage("my-harness", 2),
      "에이전트 2개가 이 하네스를 사용하며 삭제 후 실행할 수 없게 됩니다. my-harness을(를) 삭제할까요?",
    );
    const pending = deleteConfirmState(
      "h",
      "my-harness",
      { isPending: true },
      { isPending: false },
    );
    assert.equal(pending.canConfirm, false);
    assert.equal(
      pending.message,
      "이 하네스를 사용하는 에이전트를 확인하는 중…",
    );
    assert.equal(
      adapterUpdateWarning({
        id: "test",
        command: "custom-acp",
        label: "Custom",
      }),
      "컴퓨터 전체의 custom-acp 어댑터를 교체합니다. 현재 설치된 어댑터를 사용하는 다른 도구도 업데이트된 버전으로 전환됩니다.",
    );
    assert.equal(
      entryStatusLabel({ authStatus: { status: "config_invalid" } }),
      "설정 오류",
    );
    assert.equal(
      installLinkLabel({
        installInstructionsUrl: "https://example.com/download",
      }),
      "다운로드 페이지",
    );
  } finally {
    setLocale("en");
  }
});

test("Korean absolute project dates keep the local date and preserve unknown status strings", () => {
  try {
    setLocale("ko");
    const now = new Date(2026, 10, 8, 12).getTime() / 1000;
    const created = new Date(2026, 9, 30, 12).getTime() / 1000;
    assert.equal(
      helpers.relativeTime(created, now),
      new Intl.DateTimeFormat("ko-KR", {
        month: "short",
        day: "numeric",
      }).format(new Date(created * 1000)),
    );
    assert.equal(helpers.pluralize(3, "commit"), "커밋 3개");
    assert.equal(
      helpers.projectWorkItemStatusLabel("constructor"),
      "constructor",
    );
  } finally {
    setLocale("en");
  }
});
