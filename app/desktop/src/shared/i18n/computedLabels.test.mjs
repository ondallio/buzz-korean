import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { setLocale, t, useLocale, useTranslation } from "./index.ts";
import { LocalizedMessage } from "./LocalizedMessage.tsx";
import { resolveToolImageSrc } from "@/features/agents/ui/agentSessionUtils";

function productionFunction(relativePath, name, bindings = {}) {
  const source = fs.readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
  const tree = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const node = tree.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === name,
  );
  assert.ok(node, `Actual production function ${name} exists`);
  const code = ts.transpileModule(
    node.getText(tree).replace(/^export\s+/, ""),
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.None,
      },
    },
  ).outputText;
  return vm.runInNewContext(`${code}\n${name}`, {
    React,
    localize: t,
    useAppLocale: useLocale,
    useAppTranslation: useTranslation,
    LocalizedMessage,
    ...bindings,
  });
}

const wrapper = ({ children }) =>
  React.createElement(React.Fragment, null, children);
const element =
  (tag) =>
  ({ children }) =>
    React.createElement(tag, null, children);
const InlineEmoji = productionFunction(
  "shared/ui/markdown/InlineEmojiPopover.tsx",
  "InlineEmojiPopover",
  {
    Popover: wrapper,
    PopoverTrigger: wrapper,
    PopoverContent: wrapper,
    DEFAULT_POPOVER_HOVER_OPEN_DELAY_MS: 100,
  },
);
const ToolImage = productionFunction(
  "features/agents/ui/AgentSessionToolItem/ViewImageToolPreview.tsx",
  "ViewImageToolPreview",
  {
    resolveToolImageSrc,
    SimpleImageLightbox: ({ alt }) =>
      React.createElement("div", { "data-lightbox-alt": alt }),
  },
);
const ArchiveDialog = productionFunction(
  "features/profile/ui/ArchiveConfirmDialog.tsx",
  "ArchiveConfirmDialog",
  {
    AlertDialog: wrapper,
    AlertDialogContent: wrapper,
    AlertDialogHeader: wrapper,
    AlertDialogTitle: element("h2"),
    AlertDialogDescription: element("p"),
    AlertDialogFooter: wrapper,
    AlertDialogCancel: wrapper,
    AlertDialogAction: element("button"),
    Button: element("button"),
    buttonVariants: () => "",
  },
);

function render(Component, props) {
  return new JSDOM(renderToStaticMarkup(React.createElement(Component, props)))
    .window.document;
}

function overlayLabel(alt) {
  const source = fs.readFileSync(
    new URL("../ui/markdown.tsx", import.meta.url),
    "utf8",
  );
  const tree = ts.createSourceFile(
    "markdown.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const component = tree.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === "ImageZoomOverlay",
  );
  assert.ok(component);
  let initializer;
  let actualAriaSink = false;
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(tree) === "label")
      initializer = n.initializer;
    if (
      ts.isJsxAttribute(n) &&
      n.name.getText(tree) === "aria-label" &&
      n.initializer?.getText(tree) === "{label}"
    )
      actualAriaSink = true;
    ts.forEachChild(n, visit);
  }
  visit(component);
  assert.ok(initializer);
  assert.equal(
    actualAriaSink,
    true,
    "The actual overlay still renders this label as its accessible name",
  );
  const label = vm.runInNewContext(initializer.getText(tree), {
    currentItem: { alt },
    localize: t,
  });
  return renderToStaticMarkup(
    React.createElement("div", { role: "dialog", "aria-label": label }),
  );
}

test.afterEach(() => setLocale("en"));

test("inline emoji fallback is localized while display trimming and raw supplied names remain unchanged", () => {
  for (const [locale, expected] of [
    ["en", "Custom emoji"],
    ["ko", "사용자 지정 이모지"],
  ]) {
    setLocale(locale);
    const document = render(InlineEmoji, { resolvedSrc: "USER_SRC" });
    assert.equal(
      document.querySelector("button").getAttribute("aria-label"),
      expected,
    );
    assert.equal(document.querySelector("img").getAttribute("title"), expected);
    for (const alt of ["Custom emoji", "  USER 이름  "]) {
      const supplied = render(InlineEmoji, { alt, resolvedSrc: "USER_SRC" });
      assert.equal(
        supplied.querySelector("button").getAttribute("aria-label"),
        alt.trim(),
      );
      assert.equal(supplied.querySelector("img").getAttribute("alt"), alt);
      assert.equal(
        supplied.querySelector("img").getAttribute("title"),
        alt.trim(),
      );
    }
  }
});

test("image overlay fallback is localized without translating supplied image names or changing display trimming", () => {
  for (const [locale, expected] of [
    ["en", "Image preview"],
    ["ko", "이미지 미리보기"],
  ]) {
    setLocale(locale);
    const document = new JSDOM(overlayLabel(undefined)).window.document;
    assert.equal(
      document.querySelector('[role="dialog"]').getAttribute("aria-label"),
      expected,
    );
    for (const alt of ["Image preview", "  USER 이름  "]) {
      const supplied = new JSDOM(overlayLabel(alt)).window.document;
      assert.equal(
        supplied.querySelector('[role="dialog"]').getAttribute("aria-label"),
        alt.trim(),
      );
    }
  }
});

test("view-image fallback reaches the real image and lightbox while provided tool titles remain data", () => {
  for (const [locale, expected] of [
    ["en", "Viewed image"],
    ["ko", "열람한 이미지"],
  ]) {
    setLocale(locale);
    const document = render(ToolImage, {
      src: "https://example.com/USER_SRC",
      title: null,
    });
    assert.equal(document.querySelector("img").getAttribute("alt"), expected);
    assert.equal(
      document
        .querySelector("[data-lightbox-alt]")
        .getAttribute("data-lightbox-alt"),
      expected,
    );
    for (const title of ["Viewed image", "  USER 이름  ", ""]) {
      const supplied = render(ToolImage, {
        src: "https://example.com/USER_SRC",
        title,
      });
      assert.equal(supplied.querySelector("img").getAttribute("alt"), title);
      assert.equal(supplied.querySelector("img").getAttribute("title"), title);
      assert.equal(
        supplied
          .querySelector("[data-lightbox-alt]")
          .getAttribute("data-lightbox-alt"),
        title,
      );
    }
  }
});

test("archive agent and person branches render complete localized titles and descriptions", () => {
  const expected = {
    en: [
      ["Archive this agent?", "Archiving hides this agent from the space."],
      ["Archive this identity?", "Archiving hides this person from the space."],
    ],
    ko: [
      [
        "이 에이전트를 보관할까요?",
        "이 에이전트를 보관하면 이 공간에서 숨겨집니다.",
      ],
      ["이 신원을 보관할까요?", "이 사용자를 보관하면 이 공간에서 숨겨집니다."],
    ],
  };
  for (const locale of ["en", "ko"]) {
    setLocale(locale);
    for (const [index, isBot] of [true, false].entries()) {
      const document = render(ArchiveDialog, {
        open: true,
        isBot,
        isPending: false,
        onConfirm() {},
        onOpenChange() {},
      });
      assert.equal(
        document.querySelector("h2").textContent,
        expected[locale][index][0],
      );
      assert.equal(
        document.querySelector("p").textContent,
        expected[locale][index][1],
      );
    }
  }
});
