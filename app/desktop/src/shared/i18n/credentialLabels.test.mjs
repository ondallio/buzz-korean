import assert from "node:assert/strict";
import test from "node:test";
import { setLocale } from "./index.ts";
import {
  getProviderApiKeyEnvVar,
  getProviderApiKeyLabel,
  CARD_MINT_KEY_ANNOTATIONS,
} from "@/features/agents/ui/agentConfigOptions";
import { getProviderApiKeyFieldState } from "@/features/agents/ui/providerApiKeyFieldState";
test.afterEach(() => setLocale("en"));
test("credential labels translate full phrases while provider selection and environment keys remain stable", () => {
  for (const [provider, key, en, ko] of [
    ["anthropic", "ANTHROPIC_API_KEY", "Anthropic API Key", "Anthropic API 키"],
    [
      "openai",
      "OPENAI_COMPAT_API_KEY",
      "OpenAI Runtime API Key",
      "OpenAI 런타임 API 키",
    ],
    [
      "openai-compat",
      "OPENAI_COMPAT_API_KEY",
      "OpenAI-compatible Runtime API Key",
      "OpenAI 호환 런타임 API 키",
    ],
    [
      "openrouter",
      "OPENROUTER_API_KEY",
      "OpenRouter API Key",
      "OpenRouter API 키",
    ],
  ]) {
    setLocale("en");
    assert.equal(getProviderApiKeyLabel(provider), en);
    assert.equal(getProviderApiKeyEnvVar(provider), key);
    setLocale("ko");
    assert.equal(getProviderApiKeyLabel(provider), ko);
    assert.equal(getProviderApiKeyEnvVar(provider), key);
  }
  assert.equal(getProviderApiKeyLabel("unknown-provider-id"), null);
  assert.equal(getProviderApiKeyLabel("databricks_v2"), null);
  setLocale("en");
  assert.equal(
    CARD_MINT_KEY_ANNOTATIONS.OPENAI_API_KEY,
    "Used for minting agent trading cards",
  );
  setLocale("ko");
  assert.equal(
    CARD_MINT_KEY_ANNOTATIONS.OPENAI_API_KEY,
    "에이전트 트레이딩 카드 생성에 사용됩니다",
  );
  assert.deepEqual(Object.keys(CARD_MINT_KEY_ANNOTATIONS), ["OPENAI_API_KEY"]);
});
test("all credential inheritance branches translate only their display projection", () => {
  const base = {
    bakedEnvKeys: [],
    effectiveEnvVars: {},
    envVars: {},
    globalEnvVars: {},
    provider: "anthropic",
    requiredEnvKeys: ["ANTHROPIC_API_KEY"],
  };
  for (const [patch, en, ko] of [
    [
      {
        personaSatisfied: true,
        effectiveEnvVars: { ANTHROPIC_API_KEY: "test-profile-credential" },
      },
      "Inherited from agent profile",
      "에이전트 프로필에서 상속됨",
    ],
    [
      { globalEnvVars: { ANTHROPIC_API_KEY: "test-global-credential" } },
      "Inherited from global config",
      "전역 설정에서 상속됨",
    ],
    [
      { bakedEnvKeys: ["ANTHROPIC_API_KEY"] },
      "Inherited from build",
      "빌드 설정에서 상속됨",
    ],
    [
      { fileSatisfiedEnvKeys: ["ANTHROPIC_API_KEY"] },
      "Set in runtime config",
      "런타임 설정에 지정됨",
    ],
  ]) {
    const input = { ...base, ...patch };
    const original = structuredClone(input);
    setLocale("en");
    const english = getProviderApiKeyFieldState(input);
    assert.equal(english.inheritedLabel, en);
    setLocale("ko");
    const korean = getProviderApiKeyFieldState(input);
    assert.equal(korean.inheritedLabel, ko);
    const { inheritedLabel: unusedEnglish, ...englishFacts } = english;
    const { inheritedLabel: unusedKorean, ...koreanFacts } = korean;
    assert.deepEqual(koreanFacts, englishFacts);
    assert.equal(korean.value, "");
    assert.equal(korean.secretEnvVar, "ANTHROPIC_API_KEY");
    assert.equal(korean.isInherited, true);
    assert.equal(korean.isRequired, false);
    assert.deepEqual(input, original);
  }
});
