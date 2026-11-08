import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PreviewBody, ResultBody } from "./AgentSnapshotImportDialog.tsx";

function renderBody(component, props) {
  return JSDOM.fragment(renderToStaticMarkup(createElement(component, props)));
}

function makeResult(overrides = {}) {
  return {
    displayName: "TestBot",
    newPubkey: "abc123",
    personaId: "persona-1",
    memoryWritten: 0,
    memoryTotal: 2,
    memoryErrors: [],
    profileSyncError: null,
    ...overrides,
  };
}

function makePreview(overrides = {}) {
  return {
    displayName: "TestBot",
    systemPrompt: "Inspect every boundary before changing code.",
    avatarUrl: null,
    memoryLevel: "none",
    memoryEntryCount: 0,
    hasSourceAllowlist: true,
    sourceAllowlistCount: 2,
    sourceAllowlist: ["a".repeat(64), "b".repeat(64)],
    manifestJson: '{\n  "format": "buzz-agent-snapshot"\n}',
    locked: false,
    ...overrides,
  };
}

test("preview_body_discloses_prompt_allowlist_and_full_manifest", () => {
  const preview = makePreview();
  const view = renderBody(PreviewBody, {
    preview,
    hasMemory: false,
    memoryLevelLabel: "none",
    keepAllowlist: false,
    onKeepAllowlistChange: () => {},
  });
  const allText = view.textContent;

  assert.ok(allText.includes(preview.systemPrompt));
  for (const pubkey of preview.sourceAllowlist) {
    assert.ok(allText.includes(pubkey), `missing allowlist pubkey ${pubkey}`);
  }
  assert.ok(allText.includes(preview.manifestJson));
  assert.equal(
    view.querySelectorAll('[data-testid="agent-snapshot-import-manifest"]')
      .length,
    1,
  );
});

test("preview_body_shows_locked_notice_only_for_locked_cards", () => {
  const lockedNotice = (locked) =>
    renderBody(PreviewBody, {
      preview: makePreview({ locked }),
      hasMemory: false,
      memoryLevelLabel: "none",
      keepAllowlist: false,
      onKeepAllowlistChange: () => {},
    }).querySelectorAll('[data-testid="agent-snapshot-import-locked-notice"]');

  assert.equal(lockedNotice(true).length, 1);
  assert.equal(lockedNotice(false).length, 0);
});

test("result_body_renders_memory_errors_list_with_test_id", () => {
  const errors = [
    'slug "mem/notes": relay timeout',
    'slug "core": build failed: key mismatch',
  ];
  const result = makeResult({
    memoryWritten: 0,
    memoryTotal: 2,
    memoryErrors: errors,
  });
  const view = renderBody(ResultBody, { result, confirmError: null });
  const errLists = view.querySelectorAll(
    '[data-testid="agent-snapshot-import-memory-errors"]',
  );
  assert.equal(
    errLists.length,
    1,
    "exactly one memory-errors list must be rendered",
  );

  const className = errLists[0].className;
  assert.ok(
    /max-h-/.test(className),
    `memory-errors list must have a max-height class (got: "${className}")`,
  );
  assert.ok(
    /overflow-y-auto/.test(className),
    `memory-errors list must have overflow-y-auto (got: "${className}")`,
  );

  const items = errLists[0].querySelectorAll("li");
  assert.equal(
    items.length,
    errors.length,
    "every memory error must have a list item",
  );
  for (const item of items) {
    assert.ok(
      /break-all/.test(item.className),
      `list item must use break-all for full error visibility (got: "${item.className}")`,
    );
    assert.ok(
      !/truncate/.test(item.className),
      `list item must not use truncate (got: "${item.className}")`,
    );
  }
});

test("result_body_surfaces_both_error_strings_in_tree", () => {
  const errors = [
    'slug "mem/notes": relay timeout',
    'slug "core": build failed: key mismatch',
  ];
  const result = makeResult({
    memoryWritten: 0,
    memoryTotal: 2,
    memoryErrors: errors,
  });
  const view = renderBody(ResultBody, { result, confirmError: null });
  for (const error of errors) {
    assert.ok(
      view.textContent.includes(error),
      `full error must appear in rendered output: ${error}`,
    );
  }
});

test("result_body_full_success_omits_memory_errors_list", () => {
  const result = makeResult({
    memoryWritten: 2,
    memoryTotal: 2,
    memoryErrors: [],
  });
  const view = renderBody(ResultBody, { result, confirmError: null });
  assert.equal(
    view.querySelectorAll('[data-testid="agent-snapshot-import-memory-errors"]')
      .length,
    0,
    "full-success result must not render the memory-errors list",
  );
});
