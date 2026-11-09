import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import {
  buildMessageLink,
  parseMessageLink,
  isMessageLink,
} from "@/features/messages/lib/messageLink";
import { getThreadReference } from "@/features/messages/lib/threading";
import {
  resolveComposerMessageLinkAttributes,
  resolveExactLinkPaste,
} from "@/features/messages/lib/composerMessageLinkNode";
import {
  projectShareLink,
  repositoryShareLink,
  commitShareLink,
  issueShareLink,
  pullRequestShareLink,
} from "@/features/projects/lib/projectShareLinks";
import { projectSelectionShareLinks } from "@/features/projects/lib/projectSelection";
import { isEntityLink, parseEntityLink } from "./entityLink.ts";

function source(fileName) {
  const url = new URL(fileName, import.meta.url);
  return ts.createSourceFile(
    fileName,
    fs.readFileSync(url, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
function evaluate(expression, channel, bindings = {}) {
  const exports = {};
  const context = {
    exports,
    __buildEnv: { VITE_BUZZ_BUILD_CHANNEL: channel },
    ...bindings,
  };
  const transport = new URL("./appLinkTransport.ts", import.meta.url);
  if (fs.existsSync(transport)) {
    const text = fs
      .readFileSync(transport, "utf8")
      .replaceAll("import.meta.env", "__buildEnv");
    vm.runInNewContext(
      ts.transpileModule(text, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      context,
    );
    Object.assign(context, exports);
  }
  const compiled = ts.transpileModule(
    `globalThis.result = (${expression});`.replaceAll(
      "import.meta.env",
      "__buildEnv",
    ),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  vm.runInNewContext(compiled, context);
  return context.result;
}
function clipboardArgument(fileName, channel, bindings) {
  const file = source(fileName);
  const copies = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ["copyTextToClipboard", "writeTextToClipboard"].includes(
        node.expression.getText(file),
      )
    )
      copies.push(node);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(
    copies.length,
    1,
    `unique actual clipboard boundary ${fileName}`,
  );
  return evaluate(copies[0].arguments[0].getText(file), channel, bindings);
}
function productionMessageCopy(channel, written) {
  const file = source("../../features/messages/ui/MessageActionBar.tsx");
  const declaration = file.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "copyMessageLink",
  );
  assert.ok(declaration, "bind real shared action-rail/More-menu copy handler");
  return evaluate(declaration.getText(file), channel, {
    buildMessageLink,
    getThreadReference,
    copyTextToClipboard: (link) => written.push(link),
  });
}
const owner = "a".repeat(64);
const event = "b".repeat(64);
const hash = "c".repeat(40);
const repo = { repoAddress: `30617:${owner}:repo-api` };
const cases = [
  {
    name: "project",
    link: projectShareLink({ projectAddress: `30621:${owner}:project-api` }),
    expected: `buzz://project?owner=${owner}&d=project-api`,
    value: { type: "project", owner, dtag: "project-api" },
  },
  {
    name: "repository",
    link: repositoryShareLink(repo),
    expected: `buzz://repo?owner=${owner}&d=repo-api`,
    value: { type: "repo", owner, dtag: "repo-api" },
  },
  {
    name: "commit",
    link: commitShareLink(repo, hash),
    expected: `buzz://repo?owner=${owner}&d=repo-api&tab=commits&commit=${hash}`,
    value: {
      type: "repo",
      owner,
      dtag: "repo-api",
      tab: "commits",
      commitHash: hash,
    },
  },
  {
    name: "task",
    link: issueShareLink({ ...repo, id: event }),
    expected: `buzz://issue?id=${event}&owner=${owner}&d=repo-api`,
    value: { type: "issue", id: event, owner, dtag: "repo-api" },
  },
  {
    name: "review",
    link: pullRequestShareLink({ ...repo, id: event }),
    expected: `buzz://pr?id=${event}&owner=${owner}&d=repo-api`,
    value: { type: "pr", id: event, owner, dtag: "repo-api" },
  },
];
const boundaries = [
  ["../../features/projects/ui/ShareLinkButton.tsx", (link) => ({ link })],
  [
    "../../features/projects/ui/CopyShareLinkMenuItem.tsx",
    (link) => ({ link }),
  ],
  [
    "../../features/sidebar/ui/SidebarProjectsSection.tsx",
    (shareLink) => ({ shareLink }),
  ],
  [
    "../../features/projects/ui/ProjectsSelectionCountMenu.tsx",
    (link) => ({ links: [link] }),
  ],
];
for (const channel of ["korean", undefined]) {
  const distribution = channel ?? "official";
  test(`${distribution} copied messages round-trip through canonical parser, renderer precheck and composer paste`, () => {
    const written = [];
    const message = {
      id: "user-event",
      tags: [
        ["e", "user-root", "", "root"],
        ["e", "user-parent", "", "reply"],
      ],
    };
    const before = structuredClone(message);
    productionMessageCopy(channel, written)("user-channel", message);
    const expected =
      "buzz://message?channel=user-channel&id=user-event&thread=user-root";
    assert.equal(isMessageLink(written[0]), true);
    assert.deepEqual(written, [expected]);
    assert.deepEqual(parseMessageLink(written[0]), {
      ok: true,
      value: {
        channelId: "user-channel",
        messageId: "user-event",
        threadRootId: "user-root",
      },
    });
    assert.deepEqual(
      resolveComposerMessageLinkAttributes(written[0], () => "USER CHANNEL"),
      { channelName: "USER CHANNEL", href: expected },
    );
    assert.deepEqual(
      resolveExactLinkPaste(written[0], () => "USER CHANNEL"),
      { href: expected },
    );
    assert.equal(
      buildMessageLink({ channelId: "user-channel", messageId: "user-event" }),
      "buzz://message?channel=user-channel&id=user-event",
    );
    assert.deepEqual(message, before);
  });
  for (const [file, bindings] of boundaries) {
    test(`${distribution} actual ${file} clipboard output is cross-client entity compatible`, () => {
      for (const item of cases) {
        assert.equal(
          item.link,
          item.expected,
          `real ${item.name} producer retains its canonical coordinate`,
        );
        const copied = clipboardArgument(file, channel, bindings(item.link));
        assert.equal(isEntityLink(copied), true, item.name);
        assert.equal(copied, item.expected, item.name);
        assert.deepEqual(
          parseEntityLink(copied),
          { ok: true, value: item.value },
          item.name,
        );
        if (item.name !== "commit")
          assert.deepEqual(
            resolveExactLinkPaste(copied, () => undefined),
            { href: item.expected },
          );
      }
    });
  }
  test(`${distribution} multi-selection copies canonical deduplicated links without clearing selection`, () => {
    const file = source(
      "../../features/projects/ui/ProjectsSelectionCountMenu.tsx",
    );
    let callback;
    function visit(node) {
      if (
        ts.isVariableDeclaration(node) &&
        node.name.getText(file) === "handleAction"
      )
        callback = node.initializer.arguments[0];
      ts.forEachChild(node, visit);
    }
    visit(file);
    assert.ok(callback);
    const selectionItems = [
      {
        id: "one",
        kind: "project",
        title: "USER TITLE",
        shareLink: cases[0].link,
      },
      {
        id: "two",
        kind: "project",
        title: "SECOND TITLE",
        shareLink: cases[1].link,
      },
      {
        id: "duplicate",
        kind: "project",
        title: "USER TITLE",
        shareLink: cases[0].link,
      },
      {
        id: "unavailable",
        kind: "project",
        title: "PRESERVE TITLE",
        shareLink: null,
      },
    ];
    const before = structuredClone(selectionItems);
    const written = [];
    const handle = evaluate(callback.getText(file), channel, {
      projectSelectionShareLinks,
      selectionItems,
      copyTextToClipboard: (text) => written.push(text),
      selection: {
        clear() {
          throw new Error("Copy must preserve selection");
        },
      },
    });
    handle("copy");
    assert.deepEqual(written, [`${cases[0].expected}\n${cases[1].expected}`]);
    assert.deepEqual(selectionItems, before);
  });
  test(`${distribution} unrelated content and already supplied transport URLs retain original bytes`, () => {
    for (const input of [
      "User text buzz://message?id=1",
      "https://example.com/?link=buzz://message",
      "buzz-korean://repo?d=user",
      "not a link",
    ]) {
      for (const [file, bindings] of boundaries)
        assert.equal(clipboardArgument(file, channel, bindings(input)), input);
    }
  });
}
