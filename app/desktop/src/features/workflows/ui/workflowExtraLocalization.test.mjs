import assert from "node:assert/strict";
import test from "node:test";
import { setLocale } from "@/shared/i18n";
import { yamlToFormState, formStateToYaml } from "./workflowFormTypes.ts";
import {
  cronFieldsFromPaste,
  validateCronField,
  CRON_FIELD_DEFINITIONS,
} from "./cronExpression.ts";
import {
  conditionValueError,
  buildConditionExpression,
} from "./workflowConditionExpression.ts";
import { getWorkflowActivationWarning } from "./workflowActivationWarning.ts";

test("Korean parser errors translate explanation while preserving field identifiers", () => {
  try {
    setLocale("ko");
    assert.deepEqual(yamlToFormState("name: 42"), {
      ok: false,
      error: "name 값은 문자열이어야 합니다.",
    });
    assert.equal(
      yamlToFormState("name: demo\ntrigger:\n  on: future_trigger\nsteps: []")
        .error,
      '지원하지 않는 트리거 유형 "future_trigger"입니다. YAML 편집기를 사용하세요.',
    );
    const source =
      'name: demo\ntrigger:\n  on: message_posted\nsteps:\n  - id: publish\n    action: send_message\n    text: "{{trigger.text}}"';
    const result = yamlToFormState(source);
    assert.equal(result.ok, true);
    assert.ok(formStateToYaml(result.state).includes("{{trigger.text}}"));
    assert.equal(result.state.trigger.on, "message_posted");
  } finally {
    setLocale("en");
  }
});

test("Korean cron and identity validators preserve accepted DSL", () => {
  try {
    setLocale("ko");
    assert.equal(
      cronFieldsFromPaste("* *").error,
      "5개 필드로 된 Cron 표현식을 붙여넣으세요. 현재 필드는 2개입니다.",
    );
    assert.equal(
      validateCronField("70", CRON_FIELD_DEFINITIONS[0]),
      "분 값은 0~59 사이여야 합니다.",
    );
    assert.equal(
      conditionValueError("trigger_author", "not-a-key"),
      "64자리 16진수 공개 키를 입력하세요.",
    );
    assert.equal(
      buildConditionExpression({
        field: "trigger_text",
        operator: "contains",
        value: "배포",
      }),
      'str_contains(trigger_text, "배포")',
    );
  } finally {
    setLocale("en");
  }
});

test("activation warning uses localized duration and complete explanatory sentences", () => {
  try {
    setLocale("ko");
    assert.equal(
      getWorkflowActivationWarning(
        "name: demo\ntrigger:\n  on: schedule\n  interval: 5m",
      ).description,
      "5분마다 실행하도록 예약되어 있습니다. 켜기 전에 일정을 확인하세요.",
    );
    assert.equal(
      getWorkflowActivationWarning(
        'name: demo\ntrigger:\n  on: schedule\n  cron: "*/2 * * * *"',
      ).description,
      "2분마다 실행하도록 예약되어 있습니다. 켜기 전에 일정을 확인하세요.",
    );
  } finally {
    setLocale("en");
  }
});

test("run presentation preserves English behavior and translates known failures without touching diagnostics", async () => {
  const {
    workflowStatusLabel,
    formatWorkflowRunDuration,
    workflowRunFailureReason,
  } = await import("./workflowRunPresentation.ts");
  const { workflowTemplateVariables } = await import(
    "./workflowTemplateVariables.ts"
  );
  try {
    setLocale("en");
    assert.equal(workflowStatusLabel("waiting_approval"), "waiting approval");
    assert.equal(formatWorkflowRunDuration(1, 2.25), "1.3s");
    assert.equal(
      workflowRunFailureReason("approval_denied", null),
      "Approval was denied.",
    );
    setLocale("ko");
    assert.equal(workflowStatusLabel("waiting_approval"), "승인 대기 중");
    assert.equal(formatWorkflowRunDuration(1, 2.25), "1.3초");
    assert.equal(
      workflowRunFailureReason("approval_denied", null),
      "승인이 거부되었습니다.",
    );
    assert.equal(
      workflowRunFailureReason("approval_denied", "raw external error"),
      "raw external error",
    );
    assert.equal(workflowStatusLabel("future_state"), "future state");
    assert.equal(workflowStatusLabel("constructor"), "constructor");
    const variables = workflowTemplateVariables("message_posted", [
      { id: "notify", action: "send_message" },
    ]);
    assert.equal(
      variables.find(
        (variable) => variable.value === "steps.notify.output.event_id",
      ).description,
      "전송한 메시지 ID",
    );
    assert.ok(variables.some((variable) => variable.value === "trigger.text"));
  } finally {
    setLocale("en");
  }
});

test("additional workflow catalog preserves every named parameter", async () => {
  const fs = await import("node:fs");
  const { validateCatalog } = await import("@/shared/i18n");
  const catalog = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../shared/i18n/catalogs/workflows-extra.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(validateCatalog(catalog), []);
});
