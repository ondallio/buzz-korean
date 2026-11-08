import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ts from "typescript";
import {
  buildProjectsActivityDigest,
  formatProjectsActivityHighlight,
} from "../../features/projects/lib/projectsActivityDigest.ts";
import { SystemMessageRow } from "../../features/messages/ui/SystemMessageRow.tsx";
import { RemoveMembersConfirmDialog } from "../../features/agents/ui/RemoveMembersConfirmDialog.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";
import { LocalizedMessage } from "./LocalizedMessage.tsx";
import * as i18n from "./index.ts";

const mounted = [];
test.afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    await React.act(async () => root.unmount());
    container.remove();
  }
  i18n.setLocale("en");
});
async function mount(Component, props = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await React.act(async () =>
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          TooltipProvider,
          null,
          React.createElement(Component, props),
        ),
      ),
    ),
  );
  return container;
}
const normalize = (node) => {
  const copy = node.cloneNode(true);
  copy
    .querySelectorAll('[data-testid="message-timestamp"]')
    .forEach((timestamp) => {
      timestamp.replaceWith(document.createTextNode(" "));
    });
  return copy.textContent.replace(/\s+/g, " ").trim();
};
function sourceFunctions(relativePath, names, bindings = {}) {
  const url = new URL(`../../features/${relativePath}`, import.meta.url);
  const source = ts.createSourceFile(
    url.pathname,
    fs.readFileSync(url, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declarations = names.map((name) => {
    const node = source.statements.find(
      (entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name,
    );
    assert.ok(node, `actual production declaration ${name}`);
    return node.getText(source);
  });
  const exports = {};
  const compiled = ts.transpileModule(
    `${declarations.join("\n")}\nexports.Component = ${names.at(-1)};`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(compiled, {
    exports,
    React,
    LocalizedMessage,
    localize: i18n.t,
    useAppTranslation: i18n.useTranslation,
    ...bindings,
  });
  return exports.Component;
}
const viewer = "10".repeat(32);
const actor = "11".repeat(32);
const target = "12".repeat(32);
const profiles = Object.fromEntries(
  [
    [viewer, "Viewer"],
    [actor, "Alice"],
    [target, "You"],
  ].map(([key, displayName]) => [
    key,
    {
      avatarUrl: null,
      displayName,
      isAgent: false,
      name: null,
      nip05Handle: null,
      ownerPubkey: null,
    },
  ]),
);
function message(payload, id = "event-1") {
  return {
    id,
    author: "System",
    body: JSON.stringify(payload),
    createdAt: 1,
    depth: 0,
    kind: 40099,
    reactions: [],
    time: "12:00 PM",
  };
}
for (const [payload, korean, english] of [
  [
    { type: "topic_changed", actor, topic: "  You / API_field  " },
    "Alice 주제를 “You / API_field”(으)로 변경했습니다",
    "Alice changed the topic to “You / API_field”",
  ],
  [
    { type: "purpose_changed", actor, purpose: "   " },
    "Alice 목적을 지웠습니다",
    "Alice cleared the purpose",
  ],
  [
    { type: "member_removed", actor, target },
    "Alice 채널에서 You님을 내보냈습니다",
    "Alice removed You from the channel",
  ],
  [
    { type: "member_joined", actor, target: viewer },
    "나 Alice님의 초대로 참여했습니다",
    "You were added by Alice",
  ],
]) {
  test(`system row translates ${payload.type} preserving user content and identity`, async () => {
    i18n.setLocale("ko");
    const view = await mount(SystemMessageRow, {
      currentPubkey: viewer,
      message: message(payload),
      profiles,
    });
    const row = view.querySelector('[data-testid="system-message-row"]');
    assert.equal(normalize(row), korean);
    const timestamp = row.querySelector('[data-testid="message-timestamp"]');
    if (timestamp) {
      const localDate = new Date(1000);
      assert.ok(
        timestamp.textContent.startsWith(
          `${localDate.getFullYear()}년 ${localDate.getMonth() + 1}월 ${localDate.getDate()}일 `,
        ),
      );
      assert.match(timestamp.textContent, /오전|오후/);
      assert.doesNotMatch(timestamp.textContent, /AM|PM/);
    }
    await React.act(async () => i18n.setLocale("en"));
    assert.equal(normalize(row), english);
  });
}
for (const names of [
  ["고유 에이전트 API_key"],
  ["고유 에이전트 API_key", "Beta"],
]) {
  test(`destructive team confirmation keeps all ${names.length} targets and actions`, async () => {
    i18n.setLocale("ko");
    let removed = 0;
    let kept = 0;
    await mount(RemoveMembersConfirmDialog, {
      open: true,
      onOpenChange() {},
      isPending: false,
      memberNames: names,
      onKeepAgents: () => kept++,
      onRemoveAgents: () => removed++,
    });
    const dialog = document.querySelector('[role="alertdialog"]');
    for (const name of names) assert.ok(dialog.textContent.includes(name));
    assert.match(dialog.textContent, /팀에서 .*제거/);
    const buttons = [...dialog.querySelectorAll("button")];
    await React.act(async () =>
      buttons.find((button) => button.textContent === "에이전트 유지").click(),
    );
    await React.act(async () =>
      buttons.find((button) => button.textContent === "에이전트 제거").click(),
    );
    assert.equal(kept, 1);
    assert.equal(removed, 1);
  });
}
for (const openable of [false, true]) {
  for (const ownerName of [undefined, "You API_key"]) {
    test(`repository fallback whole sentence openable=${openable} owner=${ownerName}`, async () => {
      i18n.setLocale("ko");
      const navigations = [];
      const Component = sourceFunctions(
        "projects/ui/ProjectRepositoryUnavailableState.tsx",
        ["RepositoryOwnerReference", "AccessRestrictedDescription"],
        {
          UserAvatar: () => null,
          useAppNavigation: () => ({ goChannel: (id) => navigations.push(id) }),
          useChannelReference: () => ({
            id: "unchanged-channel-id",
            name: "user-authored-channel",
          }),
          isChannelReferenceOpenable: () => openable,
        },
      );
      const view = await mount(Component, {
        accessChannelId: "unchanged-channel-id",
        ownerName,
      });
      assert.match(view.textContent, /저장소 접근 권한/);
      assert.match(view.textContent, /초대를 요청하세요\./);
      assert.ok(!view.textContent.includes("Repository access"));
      if (ownerName) assert.ok(view.textContent.includes(ownerName));
      if (openable) {
        assert.equal(
          view.querySelector("button").textContent.trim(),
          "#user-authored-channel",
        );
        await React.act(async () => view.querySelector("button").click());
        assert.deepEqual(navigations, ["unchanged-channel-id"]);
      } else assert.equal(view.querySelector("button"), null);
      await React.act(async () => i18n.setLocale("en"));
      assert.match(view.textContent, /Repository access is granted through/);
      if (ownerName)
        assert.match(view.textContent, /You API_key, the repository owner,/);
    });
  }
}
test("all fragment catalog messages retain each interpolation exactly once", () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      new URL("./catalogs/fragments.json", import.meta.url),
      "utf8",
    ),
  );
  for (const [source, translated] of Object.entries(catalog)) {
    const slots = (text) =>
      [...text.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(slots(translated), slots(source), source);
    assert.notEqual(source, translated, source);
  }
});

test("owned production rich messages bind every slot and Korean catalog entry", () => {
  i18n.setLocale("ko");
  const progress = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../../docs/localization/fragment-repair-progress.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(progress.ownedFiles.length, 49);
  const literal = (node) =>
    node &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));
  function sources(node) {
    if (!node) return [];
    if (literal(node)) return [node.text];
    if (ts.isParenthesizedExpression(node)) return sources(node.expression);
    if (ts.isConditionalExpression(node))
      return [...sources(node.whenTrue), ...sources(node.whenFalse)];
    return [];
  }
  let checked = 0;
  for (const relativePath of progress.ownedFiles) {
    const path = new URL(`../../../../${relativePath}`, import.meta.url);
    const source = ts.createSourceFile(
      path.pathname,
      fs.readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function check(message, keys) {
      const slots = [
        ...new Set(
          [...message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(
            (match) => match[1],
          ),
        ),
      ];
      if (keys)
        for (const slot of slots)
          assert.ok(
            keys.includes(slot),
            `${relativePath}: ${message}: bound ${slot}`,
          );
      const values = Object.fromEntries(
        slots.map((slot) => [slot, `unchanged-${slot}`]),
      );
      const korean = i18n.t(message, values);
      checked++;
      if (
        /[A-Za-z]{2}/.test(message.replace(/\{[^{}]+\}/g, "")) &&
        message !== "npub1…"
      ) {
        assert.notEqual(
          korean,
          i18n.translateMessage("en", {}, message, values),
          `${relativePath}: Korean coverage for ${message}`,
        );
      }
    }
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ["localize", "t", "translateInterfaceText"].includes(
          node.expression.getText(source),
        )
      ) {
        for (const message of sources(node.arguments[0])) check(message, null);
      }
      if (
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText(source) === "LocalizedMessage"
      ) {
        const attrs = node.attributes.properties;
        const message = attrs.find(
          (attr) => attr.name?.getText(source) === "message",
        )?.initializer;
        const values = attrs.find(
          (attr) => attr.name?.getText(source) === "values",
        )?.initializer;
        const object =
          values && ts.isJsxExpression(values) ? values.expression : undefined;
        const keys =
          object && ts.isObjectLiteralExpression(object)
            ? object.properties.map((property) =>
                property.name?.getText(source).replace(/^['"]|['"]$/g, ""),
              )
            : null;
        for (const text of sources(
          message && ts.isJsxExpression(message) ? message.expression : message,
        ))
          check(text, keys);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.ok(checked >= 800, `checked ${checked} production message variants`);
});

for (const scenario of ["visible", "hidden", "private-agent"]) {
  test(`origin metadata translates while retaining navigation and privacy scenario=${scenario}`, async () => {
    i18n.setLocale("ko");
    const opened = [];
    const Component = sourceFunctions(
      "projects/ui/ProjectOriginReference.tsx",
      ["ProjectOriginReference"],
      {
        useAppNavigation: () => ({ goChannel: (id) => opened.push(id) }),
        useChannelReference: () => ({
          id: "private-canonical-id",
          name: "untouched-user-channel",
        }),
        isChannelReferenceOpenable: () => scenario === "visible",
      },
    );
    const view = await mount(Component, {
      channelId: scenario === "private-agent" ? null : "private-canonical-id",
      agentName: "Agent You / API_key",
    });
    assert.match(view.textContent, /시작/);
    if (scenario === "visible") {
      assert.equal(
        view.querySelector("button").textContent.trim(),
        "#untouched-user-channel",
      );
      await React.act(async () => view.querySelector("button").click());
      assert.deepEqual(opened, ["private-canonical-id"]);
    } else {
      assert.equal(view.querySelector("button"), null);
      assert.ok(!view.textContent.includes("private-canonical-id"));
      assert.ok(!view.textContent.includes("untouched-user-channel"));
      if (scenario === "private-agent")
        assert.ok(view.textContent.includes("Agent You / API_key"));
    }
    await React.act(async () => i18n.setLocale("en"));
    assert.match(view.textContent, /started/);
  });
}

for (const count of [1, 12, 120]) {
  test(`unread badge has one complete accessible count for ${count}`, async () => {
    i18n.setLocale("ko");
    const Component = sourceFunctions(
      "sidebar/ui/SidebarSection.tsx",
      ["formatUnreadCount", "UnreadCountBadge"],
      { cn: (...values) => values.filter(Boolean).join(" ") },
    );
    const view = await mount(Component, {
      channelName: "untouched-name",
      count,
    });
    assert.equal(
      view.querySelector('[aria-hidden="true"]').textContent,
      count > 99 ? "99+" : String(count),
    );
    assert.equal(
      view.querySelector(".sr-only").textContent,
      `읽지 않은 알림 ${count}개`,
    );
    assert.ok(
      view.querySelector('[data-testid="channel-unread-untouched-name"]'),
    );
    await React.act(async () => i18n.setLocale("en"));
    assert.equal(
      view.querySelector(".sr-only").textContent,
      `${count} unread notification${count === 1 ? "" : "s"}`,
    );
  });
}

for (const recent of [false, true]) {
  test(`project digest renders a complete rich sentence and updates language recent=${recent}`, async () => {
    const project = {
      id: "canonical-project-id",
      title: "User API_field title",
    };
    const input = {
      issues: recent
        ? [{ project, issue: { createdAt: 2000000000 - 60 } }]
        : [],
      nowSeconds: 2000000000,
      projects: [project],
      pullRequests: [],
      summaries: { [project.id]: { issueCount: 2000, prCount: 1 } },
    };
    const digest = buildProjectsActivityDigest(input);
    i18n.setLocale("ko");
    const Component = sourceFunctions(
      "projects/ui/ProjectsOverviewPanel.tsx",
      ["ProjectsActivityIntro"],
      { localeTag: i18n.localeTag, formatProjectsActivityHighlight },
    );
    const view = await mount(Component, { digest });
    const summary = view.querySelector(
      '[data-testid="projects-activity-summary"]',
    );
    assert.equal(
      summary.textContent,
      recent
        ? "이번 주: 새 작업 1개 및 활성 프로젝트 1개."
        : "현재 현황: 프로젝트 1개, 작업 2,000개 및 리뷰 1개.",
    );
    assert.equal(summary.querySelectorAll("strong").length, recent ? 2 : 3);
    await React.act(async () => i18n.setLocale("en"));
    assert.equal(
      summary.textContent,
      recent
        ? "This week: 1 task opened and 1 active project."
        : "Currently tracking 1 project, 2,000 tasks, and 1 review.",
    );
    assert.equal(project.title, "User API_field title");
    assert.deepEqual(buildProjectsActivityDigest(input), digest);
  });
}
