# Independent review of root localization integration

Review time: 2026-11-08. This is the first complete findings pass. No production files were edited. The sole repository artifact written by this review is this file.

The review excludes my 49 fragment-repair production files, date/number/notification formatters and their migrations, my six earlier rich-message repairs, and catalogs I authored, including batches 02 and 05, rich-2, dates, repairs and fragments. Workflow code was not authored by this reviewer and received a separate independent pass below. No nested agents were started, following the coordinator's explicit instruction.

I read the repository contributor rules, product vision and relevant activity, agent, project and moderation vision guidance, testing requirements, localization plan and glossary. I compared relevant original source using `/private/tmp/buzz-korean-backup-20261108/baseline.tar.gz`. That archive is a recovery baseline, not a verified upstream commit.

## Recommended blockers

### R1. P1. Korean prompt titles break extraction of the original message and identity

`desktop/src/features/agents/ui/agentSessionTranscriptHelpers.ts`, `parsePromptText`, finds the event section using `section.title.toLowerCase().startsWith("buzz event")`. `semanticTurnTitle` now translates that same title first. A normal semantic `<buzz-event>` section therefore fails this lookup in Korean.

A direct call to the production function with one `<buzz-event type="@mention">` section containing a valid event ID, author pubkey and `Content: USER ORIGINAL MESSAGE` produced:

- English: `userText: "USER ORIGINAL MESSAGE"`, the original author pubkey and event ID, `userTitle: "@Mention"`.
- Korean: `userText: ""`, `userPubkey: null`, `userEventId: null`, `userTitle: "Buzz event"`.

This is more than missing translation. `agentSessionTranscript.ts`, the `session/prompt` branch around line 845, only calls `upsertMessage` when `parsedPrompt.userText` exists. Selecting Korean removes the corresponding user-message row and its message/profile navigation from the agent transcript.

Fix the discriminator using canonical section kind/attributes or the original parser structure. Keep translated titles at the display boundary. Do not compare translated titles to English. Add a production parser and transcript regression in both languages that retains identical user content, author and event ID. Preserve the existing English semantic assertions.

### R2. P2. Cached observer tool descriptors retain the language from ingestion

`observerRelayStore.ts`, `appendAgentEvents` around lines 310-316, stores a transcript created by `processTranscriptEvent` or `buildTranscriptState`. Its tool items contain already translated `descriptor.label` values. `getAgentTranscript` returns those same cached items. `agentSessionToolSummary.ts`, `buildCompactToolSummary`, prefers `item.descriptor` over classification, so recomputing a React memo does not repair the cached label.

Production reproduction:

1. Build one completed `read_file` tool event in English.
2. Change the production locale to Korean.
3. Call `buildCompactToolSummary` and `getActivityHeadline` on the same item.

The cached item returned `Read file` and `Read file · /tmp/USER_FILE.ts`. Rebuilding from the identical event after switching returned `파일 읽기`.

This is a live user path through `useAgentTranscript` and `channels/ui/BotActivityBar.tsx`, which reads the observer cache. The profile activity scope also reads `getAgentTranscript`. The managed session panel's separate locale-aware rebuild does not update this store.

Keep canonical descriptor identity/source messages in cached state and render translated labels for the current locale, or introduce a bounded locale-aware projection over the retained source events. Preserve observer ingestion, ordering, reaction/permission relationships and user/tool content. A regression must switch the locale with the same cached observer items, without injecting a new event or rebuilding the fixture manually.

### R3. P2. Fixed activity titles and action verbs still bypass translation

Separate from the stale-cache defect, several current render paths display canonical app-owned English directly:

- `agentSessionTranscript.ts` creates `Thinking`, `Turn error`, `Agent error (crash)`, `Permission requested`, `Prompt context` and `System prompt` titles as plain strings.
- `activityRenderClasses/ThoughtActivity.tsx:23` passes `props.item.title` directly to `ActivityRowLabel`.
- `activityRenderClasses/LifecycleActivity.tsx:67,113,126` displays the title directly. `ActivityRowLabel` renders `verb` directly around line 136.
- `AgentSessionToolItem/CompactToolSummaryRow.tsx`, `CompactFileEditSummaryView`, supplies `verb="Edited"` directly.

A production Korean `buildTranscript` call for `agent_thought_chunk` returned `title: "Thinking"`; a `turn_error` call returned `title: "Turn error"`. Their renderer paths do not translate them.

Translate known internal titles/verbs at a presentation boundary while retaining their canonical values for noise suppression and error classification. Do not apply `t()` indiscriminately to arbitrary provider-authored titles, reasoning text or tool output. Add mounted Korean cases for a thought, an app-generated error, a permission row and a compact file edit.

### R4. P2. Complete outer templates still interpolate untranslated app prose

The following live branches keep app-owned English in template slots. A catalog-key check can pass while the displayed result remains mixed Korean and English. These need complete sentence variants, translated semantic labels, or separate complete translated sentences. User values and machine identifiers must stay in their own slots.

| Production location | Trigger and untranslated app copy |
| --- | --- |
| `agents/ui/AgentDefaultsEditor.tsx:327` | Some agents restart and some fail. `value3` contains `couldn't restart ... check the Agents page.` |
| `agents/ui/EffortPickerField.tsx:73` | Unknown/unlisted model effort. `part1` contains `Support for … isn't known yet.` or `This model may not support …` |
| `agents/ui/TeamSnapshotImportDialog.tsx:239` | Both success and profile-sync failure suffixes are raw generated English sentences. |
| `agents/ui/AgentCardViewerDialog.tsx:169` | An unlocked card with memory inserts raw `core memory` or `memories` into the disclosure. |
| `channels/ui/AddChannelBotReuseGuard.tsx:19,37` | Existing agent description inserts raw `running` or `stopped`. Canonical agent status must remain unchanged. |
| `home/ui/InboxDetailPane.tsx:849` | Reply accessibility name inserts `#… thread` or `channel thread`. |
| `settings/ui/MobilePairingCard.tsx:443` | The polite verification-code announcement inserts one of two full English instruction sentences. |
| `shared/ui/markdown/ChannelDeepLink.tsx:195,242` | Accessible link names insert raw `Open message` or `Open channel`. |
| `terminal/TerminalSubstrate.tsx:622` | A closing tab's accessible name inserts raw `, closing`. |
| `agents/ui/agentSessionTranscriptHelpers.ts:476,734` | Context titles insert `Thread Context`, `Conversation Context`, `, truncated`; turn text inserts `1 event` or `N events`. |
| `profile/ui/UserProfilePrimaryActions.tsx:76` | Follow/unfollow failure inserts raw `Unfollow` or `Follow`. |

Additional reachable fallback slots retain `this agent` in `AddAgentToChannelDialog.tsx:125` and `EditRespondToDialog.tsx:68`, `Your profile` in `CommunityOnboardingFlow.tsx:662`, and `this project` in `ProjectChannelRequestDialog.tsx:78`.

Production helper evidence includes `parsePromptText` returning `Thread Context (메시지 4개 중 2개, truncated)` and `describeTurnStarted({triggeringEventIds:["a","b"]})` returning `트리거: 2 events.` in Korean. Fix R1's parser separation before translating more parser-owned labels.

`ProjectIssueCommentTimeline` was also flagged by the syntactic sweep, but the current shared `pluralize` and new catalog aliases now produce `이전 댓글 2개`; that site is not an outstanding finding.

### R5. P2. Object-valued display copy and local statistics escape the migration

These current app-owned display fields are outside the direct-literal translation-call denominator:

- `agents/ui/TeamDialog.tsx:238` renders `personaCatalogCopy.teamEmptyState` directly. `personaLibraryCopy.ts` retains this property as the English `No agents in My Agents yet. Create one or choose one from Agent Catalog first.` Only other properties were converted to getters.
- `shared/ui/markdown/entityLinks.tsx`, `entityLinkPresentation` around lines 123-154, returns raw English `ariaLabel` templates and `Repository`, `Pull request · …`, `Issue · …`, `Project` tooltip footers. Consumers use those values directly. Repository names, hashes and IDs must remain data.
- `messages/lib/composerMessageLinkNode.ts`, `resolveComposerMessageLinkPresentation`, returns raw `Open channel …` and `Buzz link`; lines 499/506 write the result into the actual DOM accessibility name/title.
- `projects/ui/ProjectDetailFeedPanels.tsx:36` has its own English-only `pluralize`, independent of the repaired shared helper. Contributor count titles and commit-author tooltips still call it around lines 196-220 and 393. `CompactFileEditSummaryView`'s raw `Edited` is covered by R3.

Fix the actual display producers and callers, including dynamic object properties and local statistic helpers. Do not merely add unused catalog entries. Add mounted assertions for the team empty state and link accessibility names, plus production helper/render tests for contributor counts.

### R6. P2. A translated color label is still used as a control discriminator

`messages/ui/ComposerImageEditor.tsx` changed `PEN_COLORS[*].label` to locale-sensitive getters, but line 409 still applies the black swatch's contrast ring using `color.label === "Black"`.

Evaluating the actual production palette with the production translator gave `true` for the black swatch in English and `false` in Korean, where its label is `검정`. The black-on-dark swatch loses its explicit white contrast outline after switching language.

Compare the canonical color value or a stable color ID, not the translated label. Test the same black value in both languages and keep the localized accessible name.

## Independent workflow review

The structured workflow trigger change is directionally correct. `WorkflowTriggerMessage` retains the canonical English template and named values. Card grammar receives that canonical template through `getWorkflowTriggerCardMessage`, rather than localized display text. Author segmentation uses a marker slot after translation, so it does not locate a user-authored author name by incidental text matching. Known run states are translated at display time. Raw definition keys, trigger/action kinds, expressions, template variable paths and unknown external diagnostics remain separate from display labels.

Schedule production code still produces the same cron strings, compact duration values and explicit UTC schedule semantics. Locale selection does not change those wire values or select a timezone. `WorkflowDialog` now retains `editorParseFailureYaml` and recomputes the parser error, which avoids freezing that error string.

I reran 43 relevant parser/description/schedule/form/localization unit cases and all 3 existing mounted workflow localization cases. They passed. This does not cover the two concrete failures below.

### W1. P2. Localized cron field labels change React keys and input IDs

`workflows/ui/CronExpressionInput.tsx:67,68,96,97` constructs `htmlFor`, input `id` and React `key` from `definition.label`. That label is now translated by a getter in `cronExpression.ts`.

A mounted production component test selected the first input, focused it, then changed the production locale from English to Korean. It changed from `wf-trigger-cron-minute` to `wf-trigger-cron-분`. The first input was a different DOM node and no longer focused. This contradicts the no-remount/stable-identifier contract and affects a user editing this form when another window changes the device language.

Give cron field definitions a canonical stable ID, or use their fixed positional identity. Localize only labels and accessible names. Verify the same input node, focus, selection and raw cron value survive a language change.

### W2. P2. An existing cron paste error does not change language

`CronExpressionInput.tsx:27` stores `pasteError` as a translated string. The paste handler around line 140 assigns `result.error`, and the render chooses that stored string before freshly computed validation errors.

A mounted production test pasted `1 2` into a cron field in English, then switched to Korean without editing. The alert stayed `Paste a 5-field cron expression. Found 2 fields.` in both languages.

Store the failed pasted source or a structured error descriptor and derive its localized message on render, as `WorkflowDialog` now does for YAML parse errors. Preserve the invalid paste recovery path and current form value. Add a mounted switch regression that first creates the actual paste error.

## Passing checks and catalog quality

I independently reran the current locale runtime/native-sync unit tests, 8/8, and mounted runtime/live-formatter tests, 6/6. These prove preference failure handling, storage-event synchronization, React memo updates without losing mounted state, language-picker persistence behavior and serialized native projection retry/stale-success handling at their tested seams. The direct production parser/cache/palette and mounted cron reproductions above were additional checks, not modifications of those tests.

The current merged catalog contained 4,568 keys at the scan. Every named placeholder occurrence matched between source and translation, including multiplicity. A scan of direct static translation calls in the non-authored review scope found only product names, identifiers, example values and code as missing keys, such as `OpenAI`, `Git Bash`, `nsec1...`, `~/Development`, `NIP-05` and a webhook-header/code example. Those are exclusions, not completed Korean prose. This scan does not include all unwrapped object values, dynamically supplied clauses or properties, as demonstrated by R3-R5.

I sampled destructive, access, secrecy and irreversible-action translations in batches 01/03/04/06, rich-1/rich-3, manual, residual and workflow catalogs. I found no concrete reversal of permission, secrecy or deletion meaning in that sample. I did not independently review my own catalog partitions.

The two module-initialized memory tooltip translations seen at the start of the review were corrected by the coordinator during this pass. The current constants are source strings and the render calls translate them. They are not an outstanding blocker in this report.

## Verification and bookkeeping limits

The current plan correctly leaves its overall completion phases unchecked. The original inventories, `missing-current.json` and batch fragment-unresolved records predate subsequent manual repairs. They cannot be summed as the current completion denominator. The final checker needs current source/import aliases, dynamic producers and explicit identifier/code exclusions, with translated/excluded/unresolved records reconciled to live sites. A calls-only zero-missing result would miss R3-R5.

Fresh browser evidence exists under `desktop/test-results/verify-desktop/ko-round-1` and `ko-round-1-fixed-test`. The fixed-test record shows reload persistence, a Korean channel menu and an 800px settings capture at 2026-11-08 12:29 UTC. These records predate the latest broad source repairs and therefore cannot validate those latest changes. I did not rerun app/browser journeys during this read-only review.

`/private/tmp/buzz-ko-native-tests.log` proves two Rust locale-label/locale-parser tests, not operation of a native app. The native app log includes an initial render reveal timeout and later model downloads. Neither proves Korean IME composition, native Enter/Shift+Enter behavior, current native menu switching, actual notification delivery or clipping under narrow/zoomed layouts. Those user-critical flows must be exercised freshly or remain explicitly unverified. Human self-testing is also still outstanding and must not be marked done by an agent.

No new `just ci` result was produced by this read-only review. Repository-wide integration results belong to the coordinator's final gate.

## Verdict

Recommend blocking completion on R1-R6 and W1-W2. R1 is a demonstrated functional regression; the other findings are demonstrated language-switch, accessibility, visual or agreed full-localization contract defects. The passing tests do not exercise these failure scenarios.

Minimalism 9/10. Elegance 8/10 because localized display strings still cross canonical parser/cache boundaries; R1/R2 give the specific repair. Correctness 6/10 until the demonstrated loss of prompt-message identity and remaining live display/switch defects are fixed.

Optional follow-up: normalize the glossary for `private key`, which currently appears as both `개인 키` and `비공개 키` across otherwise accurate translations. This terminology choice is not a correctness blocker. Existing dead exported copy helpers are not blockers merely because they still contain English.
