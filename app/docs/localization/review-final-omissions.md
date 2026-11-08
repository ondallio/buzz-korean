# Final omissions and vendor integration review

Read-only independent review of the final omission changes by catalog_01 and the coordinator's preserved-copy integration. This review excludes my own locale runtime and workflow implementation. I read AGENTS.md, VISION.md, VISION_AGENT.md and the applicable TESTING.md guidance. No application source files were edited.

## Blocking findings

### B1. Credential display labels and the card annotation still render English

`desktop/src/features/agents/ui/agentConfigOptions.tsx:473` returns the raw `apiKeyLabel` from the credential registry. All four registry labels are English, including "Anthropic API Key" and "OpenAI-compatible Runtime API Key". The callers render them directly in `AgentConfigFields.tsx:893`, `EditAgentProviderModelFields.tsx:133` and `AgentDefinitionDialog.tsx:836`. The registry also exposes the raw annotation "Used for minting agent trading cards" at `agentConfigOptions.tsx:487`, which `EnvVarsEditor.tsx:471` and `:688` render directly.

Reproduction: select Korean, open agent defaults or an agent/persona editor and choose Anthropic, OpenAI, OpenAI-compatible or OpenRouter. The credential field still has an English label. An Advanced environment row for `OPENAI_API_KEY` retains the English card annotation. Calling `setLocale("ko"); getProviderApiKeyLabel("anthropic")` currently returns "Anthropic API Key". The annotation also remains English.

These are app-owned display phrases. The preserved brand and API-field exemptions cover "Anthropic", "OpenAI" and the actual environment key names, but do not cover the surrounding human-facing label or explanation.

Fix: translate the full registry display label in `getProviderApiKeyLabel` and give the annotation a lazy translated getter or translate it at its rendering boundary. Add Korean catalog messages. Preserve every provider ID, `secretEnvVar`, required credential key and secret value. Add production-bound English/Korean label tests and a mounted field or environment-row switch test.

### B2. Inherited credential placeholders remain English, and their memo would freeze a direct translation fix

`desktop/src/features/agents/ui/providerApiKeyFieldState.ts:81` builds four English `inheritedLabel` values. `useProviderApiKeyFieldState` memoizes that result without locale at `:121`. `PersonaProviderApiKeyField.tsx:104` renders `inheritedLabel` directly as the input placeholder. Agent defaults separately supplies the raw strings "Set in runtime config" and "Provided by this build" in `AgentConfigFields.tsx:887`.

Reproduction: select Korean and edit an agent whose Anthropic credential is satisfied by global configuration. The field shows "Inherited from global config". Equivalent profile, build and runtime-file inheritance paths also show English. I reproduced the global branch through the production `getProviderApiKeyFieldState` function with a dummy credential; only the resulting label and boolean were printed.

Fix: keep the source classification structural and translate its display label lazily, or make the production memo subscribe to locale when translating during derivation. Localize both direct defaults labels. Verify every inheritance branch in English and Korean, including a mounted locale switch with the same input node and unchanged credential/readiness values. Translating inside the current memo without invalidating it does not fix live language changes.

## Verified behavior

- Memory tooltip constants stay as source messages until render. Every tooltip consumer reviewed subscribes to locale. The mounted production subcomponent tests preserve user slugs and change both explanatory messages live.
- Model discovery classifies the original backend error before constructing a lazy display-message getter. Retained statuses change language without a second request. Provider IDs, agent names and warning/muted decisions remain unchanged.
- `getErrorMessage` returns actual Error messages, Tauri strings and message objects unchanged. Its fixed mention/send fallbacks translate at call sites. The complete send-error wrapper preserves arbitrary server data.
- Team import notices cover all singular/plural combinations with full sentence templates. Team names, member/error counts and notice/error decisions remain unchanged.
- Runtime dropdown decorations translate at construction while runtime IDs and arbitrary harness labels remain unchanged. The credential-display omissions above are separate from these passing paths.
- Calendar uses the app locale by default and preserves caller locale, label and formatter overrides. Selected dates and timezone behavior are unaffected by the language selection.
- The installed real emoji-mart React wrapper updated the same custom-element instance from English to Korean and back. Its search placeholder changed from "Search" to "검색" and back, and the custom category remained present. This independent probe bypassed the repository's emoji-mart test stubs. It used jsdom with observer/media-query shims, so it does not establish native layout or IME behavior.
- A separate evaluation of the current prewarm module confirmed that the idle callback reads the latest locale and does not call init once existing emoji-mart Data is present. The existing custom category stayed intact. Bundled dictionaries avoid a language-dependent fetch.

## Verification evidence

Current review runs passed 53 unit tests across finalOmissions, personaModelDiscoveryStatus, agentConfigOptions and emojiMartPrewarm, and 5 mounted tests across finalOmissions and vendorControls. Logs are `/private/tmp/final-omissions-review-unit.log` and `/private/tmp/final-omissions-review-dom.log`. The actual emoji-mart probe emitted English/Korean/English placeholders, retained its custom category and reported the same element identity after both switches. The first probe needed a corrected test media-query shim; that was a jsdom setup issue, not an application failure.

Optional: retain regression coverage for the prewarm existing-Data branch and a real emoji-mart update. The current prewarm test stub exports no Data, and the current vendor adapter test inspects dictionaries while the picker itself is stubbed, so those tests do not detect removal of the existing-Data guard or an installed-library update regression.

Minimalism 9/10. Elegance 9/10. Correctness 8/10 until B1 and B2 are fixed. No further material blocker was found in this assigned review. Browser/native checks and user confirmation remain separate evidence.
