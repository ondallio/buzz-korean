import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import { setLocale } from "../i18n/index.ts";
import { RichLinkPreviewAttachment } from "./rich-link-preview-attachment.tsx";

const preview = {
  kind: "link",
  href: "https://example.com/USER_PATH",
  provider: "Example",
  typeLabel: "page",
  title: "USER_TITLE",
  description:
    "First paragraph line one.\nFirst paragraph line two.\n\n\nSecond paragraph.",
  imageDomain: "USER_DOMAIN.example",
  imageState: "none",
};

function ImageLightbox({ alt, children, src }) {
  return React.createElement(
    "figure",
    { "aria-label": alt, "data-src": src },
    children,
  );
}

function renderPreview(changes = {}) {
  return new JSDOM(
    renderToStaticMarkup(
      React.createElement(RichLinkPreviewAttachment, {
        ImageLightbox,
        preview: { ...preview, ...changes },
      }),
    ),
  ).window.document;
}

test.afterEach(() => setLocale("en"));

test("rich previews split blank-line paragraphs while retaining single line breaks", () => {
  const document = renderPreview();
  const paragraphs = [
    ...document.querySelectorAll('[data-slot="attachment-description"] p'),
  ];
  assert.equal(paragraphs.length, 2);
  assert.deepEqual(
    paragraphs.map((p) => p.textContent),
    [
      "First paragraph line one.\nFirst paragraph line two.",
      "Second paragraph.",
    ],
  );
  assert.ok(
    paragraphs.every((p) => p.classList.contains("whitespace-pre-line")),
  );
});

test("preview image and lightbox names use the selected language and retain the image domain", () => {
  const imageDataUrl = "data:image/png;base64,USER_IMAGE";
  for (const [locale, expected] of [
    ["en", "Preview from USER_DOMAIN.example"],
    ["ko", "USER_DOMAIN.example의 미리보기"],
  ]) {
    setLocale(locale);
    const document = renderPreview({ imageState: "image", imageDataUrl });
    assert.equal(document.querySelector("img").getAttribute("alt"), expected);
    assert.equal(
      document.querySelector("figure").getAttribute("aria-label"),
      expected,
    );
    assert.equal(
      document.querySelector("img").getAttribute("src"),
      imageDataUrl,
    );
    assert.equal(
      document.querySelector("figure").getAttribute("data-src"),
      imageDataUrl,
    );
    assert.equal(
      document.querySelector("a").getAttribute("href"),
      preview.href,
    );
  }
});
