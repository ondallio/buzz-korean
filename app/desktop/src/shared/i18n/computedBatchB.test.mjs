import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { setLocale, t } from "./index.ts";

function tree(file) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
function initializer(file, name, bindings = {}) {
  const source = tree(file);
  const nodes = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name)
      nodes.push(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(nodes.length, 1, `${file}: unique production ${name}`);
  return vm.runInNewContext(`(${nodes[0].getText(source)})`, {
    localize: t,
    localizeConstant: t,
    translateInterfaceText: t,
    translateFinalText: t,
    ...bindings,
  });
}
function expectBoth(file, name, bindings, english, korean) {
  setLocale("en");
  assert.equal(initializer(file, name, bindings), english);
  setLocale("ko");
  assert.equal(initializer(file, name, bindings), korean);
}
const home = "features/home/ui/";
const messages = "features/messages/ui/";
test.afterEach(() => setLocale("en"));

test("inbox context actions and headers translate complete context labels while retaining names", () => {
  const file = `${home}InboxDetailPane.tsx`;
  for (const [isThreadContext, isDirectMessage, english, korean] of [
    [true, false, "Open full thread", "전체 스레드 열기"],
    [false, true, "Open conversation", "대화 열기"],
    [false, false, "Open in channel", "채널에서 열기"],
  ])
    expectBoth(
      file,
      "openContextLabel",
      { isThreadContext, isDirectMessage },
      english,
      korean,
    );
  expectBoth(
    file,
    "contextLabel",
    {
      isThreadContext: true,
      isDirectMessage: true,
      item: { senderLabel: "USER_NAME" },
    },
    "Thread with USER_NAME",
    "USER_NAME님과의 스레드",
  );
});
test("inbox filter status handles reminder and draft counts without English plural fragments", () => {
  for (const [dueReminderCount, activeDraftCount, english, korean] of [
    [1, 0, "1 due reminder", "기한이 된 알림 1개"],
    [2, 0, "2 due reminders", "기한이 된 알림 2개"],
    [0, 1, "1 active draft", "작성 중인 초안 1개"],
    [0, 2, "2 active drafts", "작성 중인 초안 2개"],
  ])
    expectBoth(
      `${home}InboxFilterMenu.tsx`,
      "statusLabel",
      { dueReminderCount, activeDraftCount },
      english,
      korean,
    );
});
test("project inbox titles select complete task and review sentences without translating author data", () => {
  for (const [type, english, korean] of [
    [
      "pull-request",
      "USER_NAME sent you a review",
      "USER_NAME님이 리뷰를 보냈습니다",
    ],
    ["issue", "USER_NAME sent you a task", "USER_NAME님이 작업을 보냈습니다"],
  ]) {
    expectBoth(
      `${home}ProjectInboxDetailPane.tsx`,
      "inboxTitle",
      { authorLabel: "USER_NAME", workItem: { type } },
      english,
      korean,
    );
    expectBoth(
      `${home}ProjectInboxDetailPane.tsx`,
      "openLabel",
      { workItem: { type } },
      type === "pull-request" ? "Open review" : "Open task",
      type === "pull-request" ? "리뷰 열기" : "작업 열기",
    );
  }
});
test("inbox empty titles translate at the actual JSX consumption while filter keys stay canonical", () => {
  const file = `${home}InboxListPane.tsx`,
    source = tree(file);
  let expression;
  function visit(node) {
    if (
      ts.isJsxExpression(node) &&
      node.expression
        ?.getText(source)
        .includes("INBOX_UNREAD_EMPTY_STATE_TITLES[filter]")
    )
      expression = node.expression;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression);
  const bindings = {
    INBOX_UNREAD_EMPTY_STATE_TITLES: initializer(
      file,
      "INBOX_UNREAD_EMPTY_STATE_TITLES",
    ),
    INBOX_EMPTY_STATE_TITLES: initializer(file, "INBOX_EMPTY_STATE_TITLES"),
    filter: "needs_action",
  };
  for (const [locale, unreadOnly, expected] of [
    ["en", false, "Nothing needs action"],
    ["ko", false, "조치가 필요한 항목이 없습니다"],
    ["ko", true, "읽지 않은 조치 필요 항목이 없습니다"],
  ]) {
    setLocale(locale);
    assert.equal(
      vm.runInNewContext(expression.getText(source), {
        ...bindings,
        unreadOnly,
        localize: t,
      }),
      expected,
    );
    assert.equal(bindings.filter, "needs_action");
  }
});
test("microphone labels and permission guidance follow locale without changing mute state", () => {
  const file = "features/huddle/components/MicControls.tsx";
  for (const [micUnavailable, isEffectivelyMuted, en, ko] of [
    [true, false, "Microphone unavailable", "마이크를 사용할 수 없습니다"],
    [false, true, "Unmute microphone", "마이크 음소거 해제"],
    [false, false, "Mute microphone", "마이크 음소거"],
  ])
    expectBoth(
      file,
      "micButtonLabel",
      { micUnavailable, isEffectivelyMuted },
      en,
      ko,
    );
});
test("huddle unnamed participants use localized identity prefixes while authored names remain data", () => {
  const file = "features/huddle/components/ParticipantList.tsx";
  expectBoth(
    file,
    "displayName",
    { authoredName: undefined, isAgent: true, keyLabel: "USER_KEY" },
    "Agent USER_KEY",
    "에이전트 USER_KEY",
  );
  expectBoth(
    file,
    "displayName",
    { authoredName: undefined, isAgent: false, keyLabel: "USER_KEY" },
    "Participant USER_KEY",
    "참여자 USER_KEY",
  );
  expectBoth(
    file,
    "displayName",
    { authoredName: "Agent", isAgent: false, keyLabel: "USER_KEY" },
    "Agent",
    "Agent",
  );
});
test("attachment computed fallbacks localize but provider labels and filenames do not", () => {
  const file = `${messages}ComposerAttachments.tsx`;
  expectBoth(
    file,
    "mediaLabel",
    { attachment: { sha256: "RAW_HASH" }, isVideo: true, hash: "USER_HASH" },
    "Video attachment USER_HASH",
    "동영상 첨부 파일 USER_HASH",
  );
  expectBoth(
    file,
    "mediaLabel",
    {
      attachment: { displayLabel: "Attachment", sha256: "RAW_HASH" },
      isVideo: false,
      hash: "USER_HASH",
    },
    "Attachment",
    "Attachment",
  );
  expectBoth(
    file,
    "mediaLabel",
    {
      attachment: { filename: "USER_NAME.txt" },
      isVideo: false,
      hash: "USER_HASH",
    },
    "USER_NAME.txt",
    "USER_NAME.txt",
  );
});
test("thread summary names use complete count and time sentences", () => {
  const file = `${messages}MessageThreadSummaryRow.tsx`;
  for (const count of [1, 2])
    expectBoth(
      file,
      "summaryAriaLabel",
      {
        summary: { replyCount: count, lastReplyAt: 123 },
        replyLabel: count === 1 ? "reply" : "replies",
        formatThreadSummaryLastReplyTime: () => "USER_TIME",
      },
      `View thread with ${count} ${count === 1 ? "reply" : "replies"}, last reply USER_TIME`,
      `답글 ${count}개가 있는 스레드 보기, 마지막 답글 USER_TIME`,
    );
});
test("new-message placeholders preserve recipient names and handle zero and many recipients", () => {
  const file = `${messages}NewMessageScreen.tsx`;
  for (const [selectedUsers, en, ko] of [
    [
      [],
      "Choose a recipient to start a message",
      "메시지를 보낼 상대를 선택하세요",
    ],
    [[{ name: "Message" }], "Message Message", "Message에게 메시지 보내기"],
    [[{}, {}], "Message 2 people", "2명에게 메시지 보내기"],
  ])
    expectBoth(
      file,
      "composerPlaceholder",
      { selectedUsers, formatRecipientName: (user) => user.name },
      en,
      ko,
    );
});
test("composer defaults localize complete reply sentences while custom placeholders stay untouched", () => {
  const file = `${messages}MessageComposer.tsx`;
  expectBoth(
    file,
    "computedPlaceholder",
    {
      editTarget: null,
      placeholder: "Write a message…",
      replyTarget: null,
      channelName: "USER_CHANNEL",
    },
    "Write a message…",
    "Write a message…",
  );
  expectBoth(
    file,
    "computedPlaceholder",
    {
      editTarget: null,
      placeholder: undefined,
      replyTarget: { author: "USER_NAME" },
      channelName: "USER_CHANNEL",
    },
    "Reply to USER_NAME in #USER_CHANNEL",
    "#USER_CHANNEL에서 USER_NAME님에게 답장",
  );
  expectBoth(
    file,
    "computedPlaceholder",
    { editTarget: {}, placeholder: undefined },
    "Edit your message",
    "메시지를 수정하세요",
  );
});
test("onboarding avatar names translate only the missing-name fallback", () => {
  const file = "features/onboarding/ui/AvatarStep.tsx";
  expectBoth(
    file,
    "previewName",
    { name: { draftValue: "", savedValue: "" } },
    "Your avatar",
    "내 아바타",
  );
  expectBoth(
    file,
    "previewName",
    { name: { draftValue: "Your avatar", savedValue: "" } },
    "Your avatar",
    "Your avatar",
  );
});
test("backup storage titles describe canonical storage modes in the selected language", () => {
  const file = "features/onboarding/ui/BackupStep.tsx";
  for (const [identityStorage, en, ko] of [
    [
      "system-keyring",
      "Protected by your system keychain",
      "시스템 키체인으로 보호됨",
    ],
    [
      "local-file",
      "Stored in private device storage",
      "기기의 비공개 저장소에 저장됨",
    ],
    [
      "other",
      "Protected in private device storage",
      "기기의 비공개 저장소에서 보호됨",
    ],
  ])
    expectBoth(file, "storageTitle", { identityStorage }, en, ko);
});
test("Nostr bind renders localized copy controls while raw animation comparisons remain English", () => {
  const file = "features/profile/ui/NostrBindConsentDialog.tsx",
    source = tree(file);
  let aria;
  function visit(node) {
    if (
      ts.isJsxOpeningElement(node) &&
      node.attributes.properties.some(
        (p) =>
          ts.isJsxAttribute(p) &&
          p.name.getText(source) === "data-testid" &&
          p.initializer?.getText(source) === '"nostr-bind-sign-and-copy"',
      )
    )
      aria = node.attributes.properties.find(
        (p) => ts.isJsxAttribute(p) && p.name.getText(source) === "aria-label",
      ).initializer.expression;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(aria);
  for (const [isSigning, raw, ko] of [
    [true, "Signing…", "서명하는 중…"],
    [false, "Continue", "계속"],
  ]) {
    setLocale("ko");
    const copyButtonLabel = initializer(file, "copyButtonLabel", { isSigning });
    assert.equal(copyButtonLabel, raw);
    const copyButtonDisplayLabel = initializer(file, "copyButtonDisplayLabel", {
      copyButtonLabel,
      isSigning,
    });
    assert.equal(
      vm.runInNewContext(aria.getText(source), {
        copyButtonLabel,
        copyButtonDisplayLabel,
        localize: t,
      }),
      ko,
    );
  }
});
test("profile edit controls translate actions without translating metadata names", () => {
  const file = "features/settings/ui/ProfileSettingsCard.tsx";
  expectBoth(
    file,
    "accessibleLabel",
    { isEditing: true, label: "USER_FIELD" },
    "Done editing USER_FIELD",
    "USER_FIELD 편집 완료",
  );
  expectBoth(
    file,
    "accessibleLabel",
    { isEditing: false, label: "USER_FIELD" },
    "Edit USER_FIELD",
    "USER_FIELD 수정",
  );
  expectBoth(
    file,
    "resolvedName",
    {
      nextDisplayName: "Your profile",
      profile: null,
      fallbackDisplayName: null,
    },
    "Your profile",
    "Your profile",
  );
});
test("community rail summaries preserve names while localizing mention and unread variants", () => {
  const file = "features/sidebar/ui/CommunityRail.tsx";
  expectBoth(
    file,
    "tooltipLabel",
    {
      showBadge: true,
      showDot: false,
      mentionCount: 2,
      community: { name: "USER_COMMUNITY" },
    },
    "USER_COMMUNITY — 2 mentions",
    "USER_COMMUNITY — 멘션 2개",
  );
  expectBoth(
    file,
    "tooltipLabel",
    {
      showBadge: false,
      showDot: true,
      mentionCount: 0,
      community: { name: "USER_COMMUNITY" },
    },
    "USER_COMMUNITY — unread",
    "USER_COMMUNITY — 읽지 않음",
  );
});
test("relay reconnect status localizes while pending state remains boolean", () => {
  const file = "features/sidebar/ui/SidebarRelayConnectionCard.tsx";
  expectBoth(
    file,
    "reconnectTitle",
    { isWaitingOnReconnectHook: true },
    "Waiting to reconnect",
    "재연결 대기 중",
  );
  expectBoth(
    file,
    "reconnectDescription",
    { isWaitingOnReconnectHook: false },
    "Reconnecting",
    "재연결 중",
  );
});
test("section deletion describes zero and plural channels with full localized sentences", () => {
  const file = "features/sidebar/ui/ChannelSectionDialogs.tsx",
    source = tree(file);
  const fn = source.statements.find(
    (n) =>
      ts.isFunctionDeclaration(n) &&
      n.name?.text === "DeleteSectionAlertDialog",
  );
  let expression;
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(source) === "description")
      expression = n.initializer;
    ts.forEachChild(n, visit);
  }
  visit(fn);
  assert.ok(expression);
  for (const [channelCount, expected] of [
    [0, '"USER_SECTION" 섹션을 삭제할까요? 이 섹션에는 채널이 없습니다.'],
    [
      2,
      '"USER_SECTION" 섹션을 삭제할까요? 채널 2개가 기본 채널 그룹으로 이동합니다.',
    ],
  ]) {
    setLocale("ko");
    assert.equal(
      vm.runInNewContext(expression.getText(source), {
        channelCount,
        sectionName: "USER_SECTION",
        channelLabel: "2 channels",
        localize: t,
      }),
      expected,
    );
  }
});
test("add-community mode titles and descriptions translate without changing the mode", () => {
  const file = "features/communities/ui/AddCommunityDialog.tsx";
  expectBoth(
    file,
    "description",
    { mode: "join" },
    "Use the community URL or invite link you received.",
    "받은 커뮤니티 URL이나 초대 링크를 사용하세요.",
  );
});
test("video posting guidance localizes without changing comment availability", () => {
  const file = "shared/ui/VideoPlayer.tsx";
  expectBoth(
    file,
    "postDisabledReason",
    {
      reviewContext: { onSendComment() {}, disabled: true },
      isPostingReviewItem: false,
    },
    "Wait for the video message to finish sending.",
    "동영상 메시지 전송이 완료될 때까지 기다려 주세요.",
  );
});

test("real mounted inbox and relay components refresh EN→KO→EN with the same props and focused control", async () => {
  await import("../../../test-jsdom-setup.mjs");
  globalThis.requestAnimationFrame = window.requestAnimationFrame = (
    callback,
  ) => setTimeout(() => callback(performance.now()), 16);
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame = clearTimeout;
  const { default: React, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { InboxFilterMenu } = await import(
    "@/features/home/ui/InboxFilterMenu"
  );
  const { SidebarRelayConnectionCard } = await import(
    "@/features/sidebar/ui/SidebarRelayConnectionCard"
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let filterChanges = 0;
  const filterProps = Object.freeze({
    activeDraftCount: 0,
    dueReminderCount: 2,
    reminderCount: 2,
    filter: "mention",
    onFilterChange() {
      filterChanges += 1;
    },
  });
  const relayProps = Object.freeze({
    isReconnectPending: true,
    isWaitingOnReconnectHook: true,
    onReconnect() {
      throw new Error("Locale change must not reconnect");
    },
  });
  try {
    await act(async () => {
      setLocale("en");
      root.render(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(InboxFilterMenu, filterProps),
          React.createElement(SidebarRelayConnectionCard, relayProps),
        ),
      );
    });
    const button = host.querySelector('[data-testid="inbox-filter-trigger"]');
    assert.ok(button);
    button.focus();
    for (const locale of ["en", "ko", "en"]) {
      await act(async () => setLocale(locale));
      const expectedTitle =
        locale === "ko" ? "재연결 대기 중" : "Waiting to reconnect";
      for (
        let attempt = 0;
        attempt < 50 && !host.textContent.includes(expectedTitle);
        attempt += 1
      ) {
        await act(
          async () => new Promise((resolve) => setTimeout(resolve, 20)),
        );
      }
      assert.equal(
        host.querySelector('[data-testid="inbox-filter-trigger"]'),
        button,
      );
      assert.equal(document.activeElement, button);
      assert.match(
        button.getAttribute("aria-label"),
        locale === "ko" ? /기한이 된 알림 2개/ : /2 due reminders/,
      );
      assert.match(
        host.textContent,
        locale === "ko" ? /재연결 대기 중/ : /Waiting to reconnect/,
      );
      assert.equal(filterProps.filter, "mention");
      assert.equal(filterChanges, 0);
    }
  } finally {
    await act(async () => root.unmount());
    host.remove();
    setLocale("en");
  }
});
