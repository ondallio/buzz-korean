import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setLocale, validateCatalog } from "@/shared/i18n";
import {
  getWorkflowCardLabel,
  getWorkflowTriggerCardMessage,
} from "./workflowDefinition.ts";
import {
  compactWorkflowTriggerMessage,
  renderWorkflowTriggerMessage,
  workflowTriggerAuthorSegments,
  workflowTriggerDescription,
  workflowTriggerMessage,
} from "./workflowTriggerDescription.ts";
import { workflowStepDescription } from "./workflowStepDescription.ts";
import { yamlToFormState } from "./workflowFormTypes.ts";

test("Korean workflow cards preserve DSL values and resolved user labels", () => {
  const definition = {
    trigger: {
      on: "message_posted",
      filter: `str_contains(trigger_text, "deploy") && trigger_author == "${"a".repeat(64)}"`,
    },
    steps: [
      {
        action: "send_message",
        text: "{{trigger.text}}",
        channel: "unchanged",
      },
    ],
  };
  const before = JSON.stringify(definition);
  try {
    setLocale("ko");
    assert.equal(
      getWorkflowCardLabel(definition, {
        triggerOptions: { authorLabel: "Carl" },
        actionChannelLabel: "releases",
      }),
      "Carl 사용자가 “deploy” 내용을 포함한 메시지를 게시하면, #releases에 “{{trigger.text}}” 전송",
    );
    assert.equal(
      workflowTriggerDescription(definition.trigger, { authorLabel: "Carl" }),
      "Carl 사용자의 메시지에 “deploy” 포함",
    );
    assert.equal(JSON.stringify(definition), before);
  } finally {
    setLocale("en");
  }
});

test("structured author and compact reaction slots survive locale changes and quoted names", () => {
  const trigger = {
    on: "reaction_added",
    filter: `trigger_emoji == "🔥" && trigger_author == "${"a".repeat(64)}" && trigger_message_id == "${"b".repeat(64)}"`,
  };
  const message = workflowTriggerMessage(trigger, {
    authorLabel: "Carl",
    messageLabel: "thanks Carl",
  });
  const compact = compactWorkflowTriggerMessage(message, "🔥");
  try {
    setLocale("en");
    assert.equal(
      renderWorkflowTriggerMessage(compact),
      "Reaction added by Carl to “thanks Carl”",
    );
    assert.deepEqual(workflowTriggerAuthorSegments(compact, "Carl"), {
      prefix: "Reaction added by",
      suffix: "to “thanks Carl”",
    });
    setLocale("ko");
    assert.equal(
      renderWorkflowTriggerMessage(compact),
      "“thanks Carl”에 Carl 사용자가 반응을 추가함",
    );
    assert.deepEqual(workflowTriggerAuthorSegments(compact, "Carl"), {
      prefix: "“thanks Carl”에",
      suffix: "사용자가 반응을 추가함",
    });
    assert.equal(
      message.template,
      "{emoji} reaction added by {author} to {message}",
    );
    assert.equal(message.values.author, "Carl");
    assert.equal(message.values.message, "“thanks Carl”");
  } finally {
    setLocale("en");
  }
});

test("Korean reaction, duration and schedule summaries use whole messages", () => {
  try {
    setLocale("ko");
    assert.equal(
      getWorkflowCardLabel({
        trigger: { on: "reaction_added", filter: 'trigger_emoji == "🔥"' },
        steps: [{ action: "delay", duration: "5m" }],
      }),
      "🔥 반응이 추가되면, 5분 대기",
    );
    assert.equal(
      getWorkflowCardLabel({
        trigger: { on: "schedule", cron: "30 9 * * *" },
        steps: [{ action: "call_webhook" }],
      }),
      "매일 UTC 09:30에, 웹훅 호출",
    );
    assert.equal(
      workflowStepDescription(
        {
          id: "message",
          action: "send_message",
          text: "hello",
          channel: "preserved",
        },
        { channelLabel: "general" },
      ),
      "#general에 “hello”",
    );
  } finally {
    setLocale("en");
  }
});

test("every supported condition combination has a complete validated Korean template", () => {
  const catalog = JSON.parse(
    readFileSync(
      new URL("../../../shared/i18n/catalogs/workflows.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(validateCatalog(catalog), []);
  const textConditions = [
    undefined,
    'str_contains(trigger_text, "deploy")',
    '!str_contains(trigger_text, "deploy")',
    'str_starts_with(trigger_text, "deploy")',
    'str_ends_with(trigger_text, "deploy")',
    'trigger_text == "deploy"',
    'trigger_text != "deploy"',
    "str_len(trigger_text) > 0",
    "str_len(trigger_text) == 0",
  ];
  const authors = [
    undefined,
    `trigger_author == "${"a".repeat(64)}"`,
    `trigger_author != "${"a".repeat(64)}"`,
  ];
  const triggers = [];
  for (const on of ["message_posted", "diff_posted"]) {
    for (const text of textConditions)
      for (const author of authors) {
        triggers.push({
          on,
          filter: [text, author].filter(Boolean).join(" && "),
        });
      }
  }
  for (const emoji of [
    undefined,
    'trigger_emoji == "🔥"',
    'trigger_emoji != "🔥"',
  ]) {
    for (const author of authors)
      for (const message of [
        undefined,
        `trigger_message_id == "${"b".repeat(64)}"`,
        `trigger_message_id != "${"b".repeat(64)}"`,
      ]) {
        triggers.push({
          on: "reaction_added",
          filter: [emoji, author, message].filter(Boolean).join(" && "),
        });
      }
  }
  const options = { authorLabel: "Carl", messageLabel: "unchanged user text" };
  for (const trigger of triggers) {
    for (const message of [
      workflowTriggerMessage(trigger, options),
      getWorkflowTriggerCardMessage({ trigger }, options),
    ]) {
      assert.ok(Object.hasOwn(catalog, message.template), message.template);
    }
  }
  assert.equal(triggers.length, 81);
});

test("schedule validation advice is structural and remains a single localized sentence", () => {
  try {
    setLocale("ko");
    const empty = yamlToFormState(
      'name: demo\ntrigger:\n  on: schedule\n  interval: ""\nsteps: []',
    );
    assert.equal(empty.ok, false);
    assert.equal(
      empty.error,
      "trigger.interval 값은 양식 모드에서 비워 둘 수 없습니다. YAML 편집기를 사용하세요.",
    );
    const wrongType = yamlToFormState(
      "name: demo\ntrigger:\n  on: schedule\n  interval: 3\nsteps: []",
    );
    assert.equal(wrongType.ok, false);
    assert.equal(
      wrongType.error,
      "trigger.interval 값은 문자열이어야 합니다. YAML 편집기를 사용하세요.",
    );
  } finally {
    setLocale("en");
  }
});
