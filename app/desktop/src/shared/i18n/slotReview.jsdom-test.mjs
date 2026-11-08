import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { setLocale } from "./index.ts";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { TeamDialog } from "@/features/agents/ui/TeamDialog";
import { TeamSnapshotImportDialog } from "@/features/agents/ui/TeamSnapshotImportDialog";
import { EffortPickerField } from "@/features/agents/ui/EffortPickerField";
import { AddChannelBotReuseGuard } from "@/features/channels/ui/AddChannelBotReuseGuard";
import { ContributorsPanel } from "@/features/projects/ui/ProjectDetailFeedPanels";
import { EntityLinkAnchor } from "@/shared/ui/markdown/entityLinks";
import { ComposerMessageLinkNode } from "@/features/messages/lib/composerMessageLinkNode";

const mounted = [];
const editors = [];
test.afterEach(async () => {
  for (const editor of editors.splice(0)) editor.destroy();
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
  setLocale("en");
});
async function mount(Component, props) {
  window.matchMedia ??= (media) => ({
    media,
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  await act(async () =>
    root.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          ThemeProvider,
          { defaultTheme: "buzz" },
          React.createElement(Component, props),
        ),
      ),
    ),
  );
  return host;
}

test("real team dialog empty copy changes language without remounting its form input", async () => {
  setLocale("en");
  await mount(TeamDialog, {
    open: true,
    title: "User title",
    description: "User description",
    submitLabel: "User submit",
    initialValues: null,
    personas: [],
    error: null,
    isPending: false,
    onOpenChange() {},
    async onSubmit() {},
  });
  const dialog = document.querySelector('[role="dialog"]');
  assert.match(dialog.textContent, /No agents in My Agents yet/);
  const input = dialog.querySelector("input");
  await act(async () => setLocale("ko"));
  assert.match(dialog.textContent, /내 에이전트에 아직 에이전트가 없습니다/);
  assert.ok(dialog.querySelector("input") === input);
  assert.match(dialog.textContent, /User title/);
});

test("actual entity link accessible names translate while preserving href and repository name", async () => {
  setLocale("en");
  const href = `buzz://repo?owner=${"a".repeat(64)}&d=USER_REPOSITORY`;
  const host = await mount(EntityLinkAnchor, {
    href,
    children: "USER_REPOSITORY",
    relayOrigin: null,
    interactive: false,
    asChip: true,
    onOpenEntityLink() {},
  });
  const link = host.querySelector("[aria-label]");
  assert.equal(
    link.getAttribute("aria-label"),
    "Open repository USER_REPOSITORY",
  );
  await act(async () => setLocale("ko"));
  assert.ok(host.querySelector("[aria-label]") === link);
  assert.equal(link.getAttribute("aria-label"), "USER_REPOSITORY 저장소 열기");
  assert.equal(link.textContent, "USER_REPOSITORY");
});

test("actual contributor count title uses localized statistics without changing author data", async () => {
  setLocale("en");
  const host = await mount(ContributorsPanel, {
    activityCounts: {},
    contributorPubkeys: [],
    contributorPubkeysByGitIdentity: new Map(),
    profiles: {},
    repoContributors: [
      { name: "USER_AUTHOR", email: "user@example.test", commitCount: 2 },
    ],
  });
  const count = host.querySelector(
    '[data-testid="project-contributor-commit-count"]',
  );
  assert.equal(count.getAttribute("title"), "2 commits");
  await act(async () => setLocale("ko"));
  assert.ok(
    host.querySelector('[data-testid="project-contributor-commit-count"]') ===
      count,
  );
  assert.equal(count.getAttribute("title"), "커밋 2개");
  assert.match(host.textContent, /USER_AUTHOR/);
});

test("effort support notes and reuse status render full Korean sentences preserving machine choices", async () => {
  setLocale("ko");
  const effort = await mount(EffortPickerField, {
    backend: { type: "local" },
    choices: "unknown",
    value: "USER_EFFORT",
    storedEffort: "USER_EFFORT",
    disabled: false,
    onChange() {},
  });
  assert.match(
    effort.textContent,
    /USER_EFFORT 지원 여부는 아직 알 수 없습니다\. 다음 세션을 시작할 때 적용됩니다\./,
  );
  const reuse = await mount(AddChannelBotReuseGuard, {
    reusableAgent: { name: "USER_AGENT", status: "deployed" },
    forceNew: false,
    disabled: false,
    onForceNewChange() {},
  });
  assert.match(reuse.textContent, /USER_AGENT은 이미 실행 중입니다/);
  assert.equal(reuse.querySelector("select").value, "reuse");
});

test("team result preserves rich team name and displays complete translated profile failure sentence", async () => {
  setLocale("ko");
  const result = {
    team: { name: "USER_TEAM" },
    members: [
      {
        pubkey: "a",
        displayName: "USER_MEMBER",
        memoryErrors: [],
        memoryWritten: 0,
        memoryTotal: 0,
        profileSyncError: "RAW_DIAGNOSTIC",
      },
    ],
  };
  await mount(TeamSnapshotImportDialog, {
    open: true,
    preview: {},
    isConfirming: false,
    result,
    confirmError: null,
    onConfirm() {},
    onOpenChange() {},
  });
  const dialog = document.querySelector(
    '[data-testid="team-snapshot-import-dialog"]',
  );
  assert.match(
    dialog.textContent,
    /USER_TEAM을 만들었지만 멤버 1명의 프로필을 게시하지 못했습니다\./,
  );
  assert.match(dialog.textContent, /USER_MEMBER: RAW_DIAGNOSTIC/);
});

test("existing composer chip accessibility follows locale without replacing the chip or changing draft and selection", async () => {
  setLocale("en");
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [
      StarterKit,
      ComposerMessageLinkNode.configure({
        resolveChannelName: () => "USER_CHANNEL",
      }),
    ],
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "USER_DRAFT " },
            {
              type: "composerMessageLink",
              attrs: {
                href: "buzz://channel/9a1657ac-f7aa-5db0-b632-d8bbeb6dfb50",
                channelName: "USER_CHANNEL",
              },
            },
          ],
        },
      ],
    },
  });
  editors.push(editor);
  editor.commands.setTextSelection(3);
  const before = editor.getJSON();
  const selection = editor.state.selection;
  const chip = element.querySelector("[data-composer-buzz-link]");
  assert.equal(chip.getAttribute("aria-label"), "Open channel USER_CHANNEL");
  setLocale("ko");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(element.querySelector("[data-composer-buzz-link]") === chip);
  assert.equal(chip.getAttribute("aria-label"), "USER_CHANNEL 채널 열기");
  assert.equal(chip.getAttribute("title"), "USER_CHANNEL 채널 열기");
  assert.deepEqual(editor.getJSON(), before);
  assert.ok(editor.state.selection.eq(selection));
  editor.destroy();
  editors.pop();
  element.remove();
});
