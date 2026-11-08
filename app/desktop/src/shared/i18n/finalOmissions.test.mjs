import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { t } from "./index.ts";
import { setLocale } from "./index.ts";
import { formatModelDiscoveryErrorStatus } from "@/features/agents/ui/personaModelDiscoveryStatus";
import { synthesizeEmptyDiscoveryStatus } from "@/features/agents/ui/usePersonaModelDiscovery";
import { deriveImportToast } from "@/features/agents/ui/teamSnapshotImport.lib";
import {
  buildPersonaRuntimeDropdownOptions,
  formatRuntimeOptionLabel,
} from "@/features/agents/ui/agentConfigOptions";
import { deriveServingIndicator } from "@/features/mesh-compute/servingUsage";
import {
  formatMessageSendError,
  getErrorMessage,
} from "@/features/messages/ui/useMentionSendFlow.helpers";

test.afterEach(() => setLocale("en"));

test("model error classification stays identical while stored display objects change language", () => {
  const cases = [
    [
      "waiting for the current member roster",
      "relay-mesh",
      "멤버 목록",
      "warning",
    ],
    [
      "no Buzz shared compute serving members",
      "relay-mesh",
      "공유하는 멤버",
      "warning",
    ],
    [
      "shared compute is not available in this build",
      "relay-mesh",
      "업데이트",
      "warning",
    ],
    ["shared compute status is malformed", "relay-mesh", "잘못된", "warning"],
    ["relay offline", "relay-mesh", "릴레이 연결", "warning"],
    ["Authentication required", "", "로그인", "warning"],
    ["ANTHROPIC_API_KEY required", "anthropic", "Anthropic API 키", "warning"],
    [
      "OPENAI_COMPAT_API_KEY required",
      "openai-compat",
      "OPENAI_COMPAT_API_KEY",
      "warning",
    ],
    ["DATABRICKS_HOST required", "databricks_v2", "DATABRICKS_HOST", "warning"],
    [
      "DATABRICKS_MODEL required",
      "databricks_v2",
      "DATABRICKS_HOST",
      "warning",
    ],
    ["BUZZ_AGENT_PROVIDER is required", "", "제공업체", "muted"],
    ["Databricks sign-in is required", "databricks_v2", "로그인해야", "muted"],
    ["Databricks sign-in failed", "databricks_v2", "완료하지 못", "warning"],
    ["Databricks sign-in timed out", "databricks_v2", "완료하지 못", "warning"],
    ["fetch timed out (code -32000)", "anthropic", "기본 모델", "warning"],
  ];
  for (const [error, provider, expectedKorean, tone] of cases) {
    setLocale("en");
    const status = formatModelDiscoveryErrorStatus(
      new Error(error),
      provider,
      "User Model 7",
    );
    const english = status.message;
    assert.equal(status.tone, tone);
    assert.match(english, /[a-z]/i);
    setLocale("ko");
    assert.match(status.message, /[가-힣]/);
    assert.ok(status.message.includes(expectedKorean), status.message);
    const koreanStatus = formatModelDiscoveryErrorStatus(
      new Error(error),
      provider,
      "User Model 7",
    );
    assert.equal(koreanStatus.message, status.message);
    assert.equal(koreanStatus.tone, tone);
    if (error === "Authentication required")
      assert.match(status.message, /User Model 7/);
    setLocale("en");
    assert.equal(status.message, english);
  }
});

test("empty discovery status stays live without modifying agent names or response values", () => {
  const response = {
    agentName: "User Agent / 한국어",
    models: [],
    supportsModelSwitching: false,
  };
  setLocale("en");
  const status = synthesizeEmptyDiscoveryStatus(response, "anthropic");
  assert.match(status.message, /reported no models/);
  setLocale("ko");
  assert.match(status.message, /User Agent \/ 한국어에서 모델을 찾지 못/);
  assert.deepEqual(response.models, []);
});

function member(memoryErrors = [], profileSyncError = null) {
  return { memoryErrors, profileSyncError };
}
test("team import notices translate every singular/plural combination as complete sentences", () => {
  for (let memories = 0; memories <= 2; memories++)
    for (let profiles = 0; profiles <= 2; profiles++) {
      const result = {
        team: { name: "User Team / 한국어" },
        members: [
          member(
            Array(memories).fill("raw error"),
            profiles > 0 ? "raw profile error" : null,
          ),
          member([], profiles > 1 ? "raw profile error" : null),
        ],
      };
      setLocale("en");
      const english = deriveImportToast(result);
      assert.equal(english.type, memories || profiles ? "error" : "notice");
      assert.match(english.message, /User Team \/ 한국어/);
      if (memories)
        assert.match(
          english.message,
          new RegExp(
            `${memories} memory entr${memories === 1 ? "y" : "ies"} failed`,
          ),
        );
      if (profiles)
        assert.match(
          english.message,
          new RegExp(`${profiles} member${profiles === 1 ? "" : "s"} failed`),
        );
      setLocale("ko");
      const korean = deriveImportToast(result);
      assert.equal(korean.type, english.type);
      assert.match(korean.message, /User Team \/ 한국어/);
      assert.match(korean.message, /가져/);
      assert.doesNotMatch(korean.message, /imported|failed|members| and /);
      if (memories) assert.ok(korean.message.includes(`메모리 ${memories}개`));
      if (profiles) assert.ok(korean.message.includes(`멤버 ${profiles}명`));
    }
});

test("runtime option labels translate decorations while preserving ids and harness names", () => {
  for (const availability of [
    "adapter_missing",
    "adapter_outdated",
    "cli_missing",
    "not_installed",
    "available",
  ]) {
    const runtime = {
      id: "api-runtime-id",
      label: "User Harness / 한국어",
      availability,
    };
    setLocale("en");
    const english = formatRuntimeOptionLabel(runtime);
    setLocale("ko");
    const korean = formatRuntimeOptionLabel(runtime);
    assert.ok(korean.startsWith(runtime.label));
    if (availability === "available") assert.equal(korean, english);
    else assert.notEqual(korean, english);
    const options = buildPersonaRuntimeDropdownOptions({
      defaultRuntimeId: runtime.id,
      isCreateMode: true,
      runtime: runtime.id,
      runtimes: [runtime],
      runtimesLoading: false,
    });
    assert.equal(options.runtimeDropdownOptions[0].value, runtime.id);
    assert.match(options.runtimeDropdownOptions[0].label, /기본값/);
    assert.equal(options.blankRuntimeOptionLabel, "하네스 선택");
  }
});

test("serving presentation keeps state and numeric usage while translating complete labels", () => {
  const base = {
    inflight: 0,
    requestsServed: 0,
    remoteAttempts: 0,
    endpointAttempts: 0,
    localAttempts: 0,
    peers: 0,
    tokensPerSecond: 31,
  };
  for (const patch of [
    { remoteAttempts: 1, inflight: 1, peers: 1 },
    { remoteAttempts: 2, peers: 2 },
    { localAttempts: 1, inflight: 1 },
    { requestsServed: 1 },
    { requestsServed: 2 },
  ]) {
    setLocale("en");
    const english = deriveServingIndicator({ ...base, ...patch }, true);
    setLocale("ko");
    const korean = deriveServingIndicator({ ...base, ...patch }, true);
    for (const key of ["show", "active", "hasRemoteConsumers"])
      assert.equal(korean[key], english[key]);
    assert.match(korean.label, /[가-힣]/);
    assert.match(korean.detail, /[가-힣]/);
    assert.doesNotMatch(korean.detail, /requests|peers|tok\/s/);
  }
});

test("send error fallback translates fixed copy and preserves arbitrary server errors verbatim", () => {
  setLocale("en");
  assert.equal(
    formatMessageSendError(null),
    "Message failed to send: Unknown error",
  );
  setLocale("ko");
  assert.doesNotMatch(formatMessageSendError(null), /Unknown error/);
  const raw = "RAW backend / User Name / 에러";
  assert.equal(getErrorMessage(new Error(raw), "fallback"), raw);
  assert.ok(formatMessageSendError(new Error(raw)).includes(raw));
});

test("fixed mention/send fallback callsites localize without rewriting actual server messages", () => {
  const paths = [
    "useMentionSendFlow.helpers.ts",
    "useMentionSendFlow.ts",
    "useEnsureAgentMentionsReady.ts",
    "useDetachedAgentStart.ts",
  ];
  let checked = 0;
  for (const path of paths) {
    const file = ts.createSourceFile(
      path,
      fs.readFileSync(
        new URL(`../../features/messages/ui/${path}`, import.meta.url),
        "utf8",
      ),
      99,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(file) === "getErrorMessage"
      ) {
        const fallback = node.arguments[1];
        assert.ok(fallback, `fallback exists ${path}`);
        const expression = node.getText(file);
        setLocale("en");
        const english = vm.runInNewContext(expression, {
          getErrorMessage,
          error: null,
          translateInterfaceText: t,
          localize: t,
        });
        setLocale("ko");
        const korean = vm.runInNewContext(expression, {
          getErrorMessage,
          error: null,
          translateInterfaceText: t,
          localize: t,
        });
        assert.notEqual(korean, english, `${path}: ${expression}`);
        assert.match(korean, /[가-힣]/);
        assert.equal(
          vm.runInNewContext(expression, {
            getErrorMessage,
            error: "RAW custom server error",
            translateInterfaceText: t,
            localize: t,
          }),
          "RAW custom server error",
        );
        checked++;
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  assert.equal(checked, 8);
});
