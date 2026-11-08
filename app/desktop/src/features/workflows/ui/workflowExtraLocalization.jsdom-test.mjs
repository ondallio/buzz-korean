import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { setLocale } from "@/shared/i18n";
import { WorkflowRunTrace } from "./WorkflowRunTrace.tsx";
import { WorkflowScheduleFields } from "./WorkflowScheduleFields.tsx";
import { WorkflowMessageTextCondition } from "./WorkflowMessageTextConditionEditor.tsx";

const mounted = [];
test.afterEach(async () => {
  for (const { root, element } of mounted.splice(0)) {
    await act(async () => root.unmount());
    element.remove();
  }
  setLocale("en");
});
async function mount(component, props) {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  mounted.push({ element, root });
  await act(async () => root.render(React.createElement(component, props)));
  return element;
}

test("mounted run trace updates badge and elapsed time while preserving step and output data", async () => {
  setLocale("en");
  const element = await mount(WorkflowRunTrace, {
    run: {
      executionTrace: [
        {
          stepId: "raw_step_id",
          status: "completed",
          startedAt: 1,
          completedAt: 1.125,
          output: { event_id: "do_not_translate" },
        },
      ],
    },
  });
  assert.match(element.textContent, /completed/);
  assert.match(element.textContent, /125ms/);
  await act(async () => setLocale("ko"));
  assert.match(element.textContent, /완료/);
  assert.match(element.textContent, /125밀리초/);
  assert.match(element.textContent, /raw_step_id/);
  assert.match(element.textContent, /event_id/);
  assert.match(element.textContent, /do_not_translate/);
  assert.doesNotMatch(element.textContent, /completed|125ms/);
});

test("mounted weekly schedule translates weekday accessible names and retains checked wire values", async () => {
  setLocale("en");
  const updates = [];
  const element = await mount(WorkflowScheduleFields, {
    trigger: { on: "schedule", cron: "0 9 * * 1" },
    onUpdate: (trigger) => updates.push(trigger),
  });
  const monday = element.querySelector("#wf-trigger-weekday-1");
  assert.equal(monday.getAttribute("aria-label"), "Monday");
  assert.equal(monday.checked, true);
  await act(async () => setLocale("ko"));
  assert.equal(element.querySelector("#wf-trigger-weekday-1"), monday);
  assert.equal(monday.getAttribute("aria-label"), "월요일");
  assert.equal(monday.checked, true);
  assert.equal(monday.value, "1");
  assert.equal(
    element.querySelector('label[for="wf-trigger-weekday-1"]').textContent,
    "월",
  );
  assert.deepEqual(updates, []);
});

test("mounted text condition reorders the complete Korean summary and preserves the input expression", async () => {
  setLocale("en");
  const updates = [];
  const element = await mount(WorkflowMessageTextCondition, {
    value: 'str_contains(trigger_text, "배포")',
    allowAdvanced: false,
    onChange: (value) => updates.push(value),
  });
  assert.match(element.textContent, /contains “배포”/);
  const input = element.querySelector("#wf-trigger-filter-trigger-text-value");
  assert.equal(input.value, "배포");
  await act(async () => setLocale("ko"));
  assert.match(element.textContent, /“배포” 포함/);
  assert.equal(
    element.querySelector("#wf-trigger-filter-trigger-text-value"),
    input,
  );
  assert.equal(input.value, "배포");
  assert.deepEqual(updates, []);
});

test("cron inputs retain node focus selection and values across a live language switch", async () => {
  const { CronExpressionInput } = await import("./CronExpressionInput.tsx");
  setLocale("en");
  const updates = [];
  const element = await mount(CronExpressionInput, {
    value: "*/15 9 * * 1",
    onChange: (value) => updates.push(value),
  });
  const first = element.querySelector("input");
  first.focus();
  first.setSelectionRange(1, 3);
  assert.equal(first.id, "wf-trigger-cron-minute");
  await act(async () => setLocale("ko"));
  assert.ok(element.querySelector("input") === first, "same cron input node");
  assert.ok(document.activeElement === first, "same focused input");
  assert.equal(first.selectionStart, 1);
  assert.equal(first.selectionEnd, 3);
  assert.equal(first.value, "*/15");
  assert.equal(first.id, "wf-trigger-cron-minute");
  assert.equal(first.getAttribute("aria-label"), "분");
  assert.deepEqual(updates, []);
});

test("an actual invalid cron paste error changes language while preserving the valid expression", async () => {
  const { CronExpressionInput } = await import("./CronExpressionInput.tsx");
  setLocale("en");
  const updates = [];
  const element = await mount(CronExpressionInput, {
    value: "0 9 * * 1",
    onChange: (value) => updates.push(value),
  });
  const first = element.querySelector("input");
  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", {
    value: { getData: () => "1 2" },
  });
  await act(async () => first.dispatchEvent(paste));
  assert.match(
    element.querySelector('[role="alert"]').textContent,
    /Found 2 fields/,
  );
  await act(async () => setLocale("ko"));
  assert.equal(
    element.querySelector('[role="alert"]').textContent,
    "5개 필드로 된 Cron 표현식을 붙여넣으세요. 현재 필드는 2개입니다.",
  );
  assert.ok(element.querySelector("input") === first, "same cron input node");
  assert.equal(first.value, "0");
  assert.deepEqual(updates, []);
});
