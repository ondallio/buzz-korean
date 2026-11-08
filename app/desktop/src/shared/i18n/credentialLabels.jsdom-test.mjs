import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { setLocale } from "./index.ts";
import { useProviderApiKeyFieldState } from "@/features/agents/ui/providerApiKeyFieldState";
import {
  getProviderApiKeyLabel,
  CARD_MINT_KEY_ANNOTATIONS,
} from "@/features/agents/ui/agentConfigOptions";
import { PersonaProviderApiKeyField } from "@/features/agents/ui/PersonaProviderApiKeyField";
import { EnvVarsEditor } from "@/features/agents/ui/EnvVarsEditor";
for (const [kind, patch, en, ko] of [
  [
    "profile",
    {
      personaSatisfied: true,
      effectiveEnvVars: { ANTHROPIC_API_KEY: "test-profile-credential" },
    },
    "Inherited from agent profile",
    "에이전트 프로필에서 상속됨",
  ],
  [
    "global",
    { globalEnvVars: { ANTHROPIC_API_KEY: "test-global-credential" } },
    "Inherited from global config",
    "전역 설정에서 상속됨",
  ],
  [
    "build",
    { bakedEnvKeys: ["ANTHROPIC_API_KEY"] },
    "Inherited from build",
    "빌드 설정에서 상속됨",
  ],
  [
    "file",
    { fileSatisfiedEnvKeys: ["ANTHROPIC_API_KEY"] },
    "Set in runtime config",
    "런타임 설정에 지정됨",
  ],
  [
    "local",
    {
      envVars: { ANTHROPIC_API_KEY: "test-local-credential" },
      effectiveEnvVars: { ANTHROPIC_API_KEY: "test-local-credential" },
    },
    "Paste API key…",
    "API 키 붙여넣기…",
  ],
])
  test(`same mounted credential field changes ${kind} label without changing input or saved values`, async () => {
    setLocale("en");
    const props = {
      bakedEnvKeys: [],
      effectiveEnvVars: {},
      envVars: {},
      globalEnvVars: {},
      provider: "anthropic",
      requiredEnvKeys: ["ANTHROPIC_API_KEY"],
      ...patch,
    };
    const snapshot = structuredClone(props);
    let edits = 0;
    function Field() {
      const state = useProviderApiKeyFieldState(props);
      return React.createElement(PersonaProviderApiKeyField, {
        ...state,
        disabled: false,
        label: getProviderApiKeyLabel(props.provider),
        envVarName: state.secretEnvVar,
        onValueChange: () => edits++,
      });
    }
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(React.createElement(Field)));
      const input = host.querySelector("input");
      assert.equal(input.placeholder, en);
      const value = input.value;
      await act(async () => setLocale("ko"));
      assert.equal(host.querySelector("input"), input);
      assert.equal(input.placeholder, ko);
      assert.equal(input.value, value);
      assert.match(host.querySelector("label").textContent, /Anthropic API 키/);
      assert.match(host.textContent, /ANTHROPIC_API_KEY/);
      assert.equal(edits, 0);
      assert.deepEqual(props, snapshot);
      if (kind === "local") assert.equal(input.value, "test-local-credential");
      else assert.equal(input.value, "");
      await act(async () => setLocale("en"));
      assert.equal(input.placeholder, en);
      assert.equal(input.value, value);
    } finally {
      await act(async () => root.unmount());
      host.remove();
      setLocale("en");
    }
  });
test("real environment editor updates lazy card annotation while preserving required credential input", async () => {
  setLocale("en");
  const props = {
    value: { OPENAI_API_KEY: "test-card-credential" },
    requiredKeys: ["OPENAI_API_KEY"],
    onChange: () => {
      throw new Error("language switch must not write secrets");
    },
    keyAnnotations: CARD_MINT_KEY_ANNOTATIONS,
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(React.createElement(EnvVarsEditor, props)),
    );
    assert.match(host.textContent, /Used for minting agent trading cards/);
    const input = [...host.querySelectorAll("input")].find(
      (input) => input.value === "test-card-credential",
    );
    assert.ok(input);
    await act(async () => setLocale("ko"));
    assert.match(host.textContent, /에이전트 트레이딩 카드 생성에 사용됩니다/);
    assert.ok([...host.querySelectorAll("input")].includes(input));
    assert.equal(input.value, "test-card-credential");
    assert.equal(props.value.OPENAI_API_KEY, "test-card-credential");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    setLocale("en");
  }
});
