import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { buildMessageLink } from "@/features/messages/lib/messageLink";
import { getThreadReference } from "@/features/messages/lib/threading";

function transport(channel) {
  const url = new URL("./appLinkTransport.ts", import.meta.url);
  if (!fs.existsSync(url)) return (link) => link;
  const compiled = ts.transpileModule(
    fs.readFileSync(url, "utf8").replaceAll("import.meta.env", "__buildEnv"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    __buildEnv: { VITE_BUZZ_BUILD_CHANNEL: channel },
  });
  return exports.toDistributionLink;
}
function productionCopyMessageLink(channel, written) {
  const source = fs.readFileSync(
    new URL("../../features/messages/ui/MessageActionBar.tsx", import.meta.url),
    "utf8",
  );
  const file = ts.createSourceFile(
    "MessageActionBar.tsx",
    source,
    99,
    true,
    ts.ScriptKind.TSX,
  );
  const declaration = file.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "copyMessageLink",
  );
  assert.ok(declaration);
  const compiled = ts.transpileModule(declaration.getText(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return vm.runInNewContext(`${compiled}; copyMessageLink;`, {
    buildMessageLink,
    getThreadReference,
    toDistributionLink: transport(channel),
    copyTextToClipboard: (link) => written.push(link),
  });
}
for (const [fileName, inputs] of [
  [
    "../../features/projects/ui/ProjectsSelectionCountMenu.tsx",
    { links: ["buzz://project?d=user", "https://example.com/user"] },
  ],
  [
    "../../features/sidebar/ui/SidebarProjectsSection.tsx",
    { shareLink: "buzz://project?d=user" },
  ],
]) {
  for (const channel of ["korean", undefined]) {
    test(`project clipboard boundary ${fileName} respects ${channel ?? "official"} distribution`, () => {
      const source = fs.readFileSync(
        new URL(fileName, import.meta.url),
        "utf8",
      );
      const file = ts.createSourceFile(
        fileName,
        source,
        99,
        true,
        ts.ScriptKind.TSX,
      );
      const copies = [];
      function visit(node) {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(file) === "copyTextToClipboard"
        )
          copies.push(node);
        ts.forEachChild(node, visit);
      }
      visit(file);
      assert.equal(copies.length, 1);
      const expression = copies[0].arguments[0].getText(file);
      const compiled = ts.transpileModule(`result = ${expression};`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText;
      const context = {
        ...inputs,
        toDistributionLink: transport(channel),
        result: undefined,
      };
      vm.runInNewContext(compiled, context);
      const expected = (inputs.links ?? [inputs.shareLink])
        .map((link) =>
          channel === "korean"
            ? link.replace(/^buzz:\/\//, "buzz-korean://")
            : link,
        )
        .join("\n");
      assert.equal(context.result, expected);
      assert.ok(
        source.includes(
          'import { toDistributionLink } from "@/shared/lib/appLinkTransport"',
        ),
      );
    });
  }
}
for (const [channel, expectedScheme] of [
  ["korean", "buzz-korean"],
  [undefined, "buzz"],
]) {
  test(`copy-message OS transport uses ${expectedScheme} without changing canonical message data`, () => {
    const written = [];
    const copy = productionCopyMessageLink(channel, written);
    const message = {
      id: "user-event",
      tags: [
        ["e", "user-root", "", "root"],
        ["e", "user-parent", "", "reply"],
      ],
    };
    copy("user-channel", message);
    assert.deepEqual(written, [
      `${expectedScheme}://message?channel=user-channel&id=user-event&thread=user-root`,
    ]);
    assert.equal(
      buildMessageLink({ channelId: "user-channel", messageId: "user-event" }),
      "buzz://message?channel=user-channel&id=user-event",
    );
    assert.deepEqual(message, {
      id: "user-event",
      tags: [
        ["e", "user-root", "", "root"],
        ["e", "user-parent", "", "reply"],
      ],
    });
  });
}

test("OS link conversion preserves unrelated URLs, original content and identifier bytes", () => {
  const convert = transport("korean");
  for (const value of [
    "User text buzz://message?id=1",
    "https://example.com/?link=buzz://message",
    "buzz-korean://repo?d=user",
    "not a link",
  ]) {
    assert.equal(convert(value), value);
  }
  assert.equal(
    convert("buzz://repo?owner=USER&d=user%20data"),
    "buzz-korean://repo?owner=USER&d=user%20data",
  );
});
