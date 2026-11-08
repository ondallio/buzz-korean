import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { EditorContent } from "@tiptap/react";
import { useRichTextEditor } from "@/features/messages/lib/useRichTextEditor";
import { setLocale } from "./index.ts";
test("real editor default placeholder changes language without replacing the editor or draft", async () => {
  setLocale("en");
  let current;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Composer() {
    current = useRichTextEditor({ onUpdate() {} });
    return React.createElement(EditorContent, { editor: current.editor });
  }
  try {
    await act(async () => root.render(React.createElement(Composer)));
    const editor = current.editor;
    assert.ok(editor);
    assert.equal(
      host.querySelector("[data-placeholder]").getAttribute("data-placeholder"),
      "Write a message…",
    );
    await act(async () => setLocale("ko"));
    assert.equal(current.editor, editor);
    assert.equal(
      host.querySelector("[data-placeholder]").getAttribute("data-placeholder"),
      "메시지를 입력하세요…",
    );
    await act(async () =>
      editor.commands.setContent("<p>사용자 DRAFT / raw</p>"),
    );
    const document = editor.getJSON();
    const selection = editor.state.selection.toJSON();
    await act(async () => setLocale("en"));
    assert.equal(current.editor, editor);
    assert.deepEqual(editor.getJSON(), document);
    assert.deepEqual(editor.state.selection.toJSON(), selection);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    setLocale("en");
  }
});
