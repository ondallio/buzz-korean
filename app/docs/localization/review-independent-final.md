# Independent re-review of the final localization repairs

Reviewer: `catalog_01`. Existing blockers R1–R5 and W1–W2 were reviewed after both implementation owners released their sources. I also reviewed the coordinator's stable invocation-time translator change and the subsequent 111-site presentation-sink migration. My own admin/credential repairs (B1/B2) are excluded. No production source files were edited by this review. Unrelated areas were not reopened.

Review completed at 2026-11-08T14:37:03.805299+00:00. The prior findings are [review-root-integration.md](review-root-integration.md) and [review-final-omissions.md](review-final-omissions.md). The frozen activity manifest is [activity-repair-progress.json](activity-repair-progress.json). The later sink snapshot is [final-root-sinks.json](final-root-sinks.json) with [final-sinks-application.json](final-sinks-application.json).

## Scoped verdict

R1–R5 and W1–W2 are fixed at the reviewed production seams. The coordinator's translator/callback lifecycle fix also passes independent current checks. No material regression was found in those repairs. The separate final 111-site migration findings below have been corrected and rechecked. The additional structured-feedback migration has also been independently checked after its final frozen signal. No outstanding material blocker was found in these assigned repairs. This is a scoped review, not an attestation of overall app/native/CI completion.

## Rechecked prior blockers

| Finding | Current source and evidence | Status |
| --- | --- | --- |
| R1: translated titles break prompt extraction | `agents/ui/agentSessionTranscriptHelpers.ts:80` discriminates canonical section kind; semantic sections retain decoded attributes. `agentSessionTranscript.ts` and helpers build canonical English copy independently of UI locale. Production parser/transcript tests retain the same user text, full author pubkey, event ID and channel in both languages, and legacy bracket parsing remains supported. Existing exact body/title assertions remain. | Fixed; no blocker |
| R2: cached observer tool label freezes | `agentSessionToolSummary.ts:66` projects the existing item through classification at invocation. Grouping retains canonical keys while `sameKindLabel` reclassifies its display label. The real observer-store test switches the same cached object without a new event and asserts unchanged JSON; I additionally checked Korean ingestion followed by English projection with the same object. Observer ingestion/history/order code was not changed. | Fixed; no blocker |
| R3: app activity titles/verbs remain English | `agentSessionPresentation.ts` translates known titles only with matching provenance and exact canonical title. Thought/lifecycle/permission/compact-edit renderers use that presentation layer, and known action verbs are localized separately from tool objects. Actual mounted cases update in place and preserve provider reasoning, raw diagnostics, permission option names/IDs, canonical denied outcome and its destructive tone, filename and diff counts. Expanded prompt accordion keeps the same open button/state/body after switching. | Fixed; no blocker |
| R4: untranslated prose inside slots | Reviewed `AgentDefaultsEditor`, `EffortPickerField`, `TeamSnapshotImportDialog`, `AgentCardViewerDialog`, `AddChannelBotReuseGuard`, `InboxDetailPane`, `MobilePairingCard`, `ChannelDeepLink`, `TerminalSubstrate`, `UserProfilePrimaryActions` and the named agent/profile/project fallbacks. They now choose complete message variants or explicit display labels. Runtime status, memory level, effort IDs, pairing digits, tab titles and arbitrary actual errors remain data. Canonical transcript context/count envelopes are localized at presentation by the activity repair. | Fixed; no blocker |
| R5: object copy/link accessibility/local statistics | `personaLibraryCopy.ts:98` is a live getter; entity-link producers translate app-owned aria/footer text while preserving repository names/hashes/IDs. Composer node-view locale subscription updates only aria/title and unsubscribes on destroy. Actual Tiptap test retains chip node, draft JSON and selection; real team/contributor/entity consumers change language without losing user values. `ProjectDetailFeedPanels` uses the shared localized statistic helper instead of its local English pluralizer. | Fixed; no blocker |
| W1: translated cron keys/IDs replace inputs | `CronExpressionInput.tsx:75,104` uses canonical `definition.id`; labels remain translated. Actual mounted test keeps the first input node, focus, selection range, value and ID while its accessible name changes. All five definitions use fixed IDs. | Fixed; no blocker |
| W2: stored cron paste error freezes | `CronExpressionInput.tsx:29–35` stores raw failed paste and derives the validation error during render. The mounted test dispatches a real invalid paste before switching, then verifies Korean error text, same input/value and no emitted cron update. The current form remains recoverable. | Fixed; no blocker |

## Coordinator runtime/lifecycle correction

`shared/i18n/react.ts:11` still subscribes the component but returns the stable invocation-time translator. `useLocaleCallback` retains callback identity unless the caller's captured dependencies change. `useLocaleMemo` still invalidates on locale. A fresh AST scan found no ordinary `useMemo`/`React.useMemo` callbacks directly invoking the three translator aliases; the coordinator's memo inventory was reviewed together with the remaining profile memo/callback source. The explicit locale-driven emoji dictionary memo remains intentional.

Current independent checks passed the hook/effect lifecycle regression and the actual `IdentityRecoveryPairing` component regression at the Tauri IPC mock seam. The real component kept its QR DOM node and listener IDs, started once, did not cancel on language switch, delivered the later callback in Korean, and cancelled once on unmount. `useNestNotifications`, huddle `AddAgentDialog` and recovery effects now depend on the stable translator. There is no demonstrated locale-only connection restart after the fix.

The README now correctly documents invocation-time translation and `useLocaleMemo`; the earlier optional documentation observation is resolved. These checks do not prove the native pairing protocol or an actual remote device exchange.

## Final 111-site migration: findings corrected and rechecked

The approved snapshot contains 111 sites in 46 files. I reviewed all source records and all 61 newly added catalog messages, inspected the changed production contexts, and checked actual imported-alias calls. No missing interpolation-value key or protocol/storage/action-ID translation was found. The four new `useFinalLocale` calls are in valid hook/component owners. Canonical raw backend errors still pass through existing fallback branches unchanged.

### S1. Fixed after review: re-translating an already late-translated onboarding error freezes Korean on an English switch

`features/onboarding/ui/OnboardingFlow.tsx:278` now stores `translateFinalText("Server error — try again")`. Its existing render at approximately line 545 still calls `localize(membershipError.message)`. That state field was deliberately a canonical source string so the rendering seam could apply the current locale.

I evaluated the exact current production setter call and rendering expression: create the error in Korean, switch to English, then render. Both the stored and rendered text were `서버 오류가 발생했습니다. 다시 시도해 주세요.`; the expected English was `Server error — try again`. This is a regression introduced by this migration at an existing late-translation seam.

Fix: exclude that source field from the setter migration, retain its raw English source, and let the existing render translate it. Do not reverse-translate or globally translate arbitrary error strings. The coordinator restored the raw source. I reran the exact current production setter/render expressions: Korean display followed by English display now passes with the canonical stored source unchanged. No source edit was made by the reviewer.

### S2. Fixed after review: transcription-toggle failure is translated as creation failure

`features/huddle/components/HuddleBar.tsx`, `handleToggleTranscript`, invokes `set_huddle_transcription_enabled` with `enabled: !transcriptionEnabled`. The new `final-sinks.json` translation for `Transcript failed: {value1}` says `음성 기록을 만들지 못했습니다: {value1}`.

This handler also runs when disabling transcription fails. The translation specifically claims a failure to create a transcript, instead of explaining failure to change its enabled setting. Use a neutral setting-change failure sentence, such as `음성 기록 설정을 변경하지 못했습니다: {value1}`, retaining the actual diagnostic slot. The coordinator made that neutral translation change, and I confirmed the current catalog plus the enable/disable toggle callsite.

### Snapshot boundaries

At the first sink hash check, `useManagedAgentActions.ts` differed because the coordinator was performing its explicitly excluded manual helper repair. `CommunitySwitcher.tsx` differed because locale_design subsequently released its separate final-props change. These differences are accounted for rather than treated as unreviewed accidental overwrites. The source was subsequently formatted and released by the coordinator; current formatted source and both fixes were rechecked. The old application hashes are a pre-format application snapshot and should not be confused with the latest file hashes.


## Additional final presentation changes

The requested 14-file final-props repair was independently reviewed at its changed presentation seams: project subtitle, upload overlay/pill, updater card, channel member count and canvas guidance, model/effort inherited labels, mention/recipient accessibility, onboarding/harness installation labels, community connection labels, user-status fallback and carousel role descriptions. Full phrases translate while model/effort values, harness labels, selected user names, recipient callbacks and control IDs stay canonical. No new material defect was found. My earlier admin/credential edits in a shared file were excluded; only the subsequent custom-prop changes were reviewed.

Independent runs passed **13/13 unit/SSR tests** (7 final-props/aria cases plus 6 existing MoreUnreadButton model cases) and **5/5 mounted tests**. The real effort select retains focus/node/API value, the upload button remains the same usable cancel control, the recipient row retains its option node and user callback data. Overlay/updater tests compile the actual production functions into their real display consumers; network/provider interactions are outside that proof.

The coordinator's MoreUnreadButton change preserves canonical top/bottom direction and target selection, translates complete accessibility variants and uses actual React SSR construction in the existing test. I also directly checked Korean above/below variants with matched and unmatched DM targets; user names stay verbatim. The two direct avatar Pickers receive the same bundled locale/i18n adapter without a locale key or remount. Supplied labels and emoji identities remain data. The two new loading-toast titles and channel-management back-button label change presentation only. I found no material protocol/semantic mistake in these requested small changes. Actual direct-Picker ShadowRoot UI/layout was not independently exercised in this pass.

## Structured feedback migration: passed current scoped re-review

The coordinator then introduced `shared/i18n/feedback.ts` with explicit app-message descriptors, and migrated 59 states / 148 assignments in 49 files according to the final `feedback-state-migration.json`. Four project feedback producers were subsequently included; their string-display migration preserves API data, and the existing structured CreateProjectWorkItemDialog union was kept intact. `feedbackMessage` retains source plus a copied scalar-value record. `useLocalizedFeedback` exposes rendered strings, keeps a stable setter and subscribes to locale; untagged server/user strings remain verbatim. The migration replaces only direct app-translation expressions in eligible string/null feedback setters, preserving callback-updater and raw error branches.

I independently mounted the current hook and checked tagged English→Korean→English display, copied values despite caller mutation, stable setter identity, raw server string `Cancel` remaining untranslated despite matching a catalog key, and null clearing. These checks pass. The migrated functional-updater census has one current caller, in `useManagedAgentActions`; it ignores previous text and returns explicit descriptors, with its stop action/target/count semantics unchanged.

An optional API observation was reported to the coordinator: a `set(previous => previous)` no-op should retain the stored descriptor rather than turning it into a rendered string. The coordinator implemented that preservation, and its real-hook regression now tests it. No current migrated updater uses previous text. A fresh read-only AST check found all 59 initial states empty/null, zero direct re-translation of displayed feedback state, and zero missing named values in literal descriptor calls. The SetStatusDialog outer translator was removed so externally supplied strings are not translated by catalog coincidence.

I independently reran **10/10 mounted tests** across the feedback hook, actual editor, actual identity-recovery component, locale runtime and two real InviteRedeemForm cases. Both age and terms errors are created through the production form-submit guard before switching. Their Korean feedback persists after the policy debounce; the same input and checkbox remain, user invite/consent are unchanged, no extra policy fetch occurs and no redemption fires. Full desktop TypeScript check passed after the final feedback freeze. No material regression was found in the hook contract or this migration.

The default editor placeholder reads the current app language without reconstructing the Tiptap editor; the empty decoration transaction preserves the document and selection in the actual production-hook test. This is web editor evidence, not native IME proof.

## Fresh verification

All counts below are from this review's current executions, not copied from earlier pass records.

- Activity parser/transcript/tool-summary/grouping/presentation and real observer retention: **218/218 unit tests passed**; activity production renderers: **5/5 mounted tests passed**.
- Slot fixes, existing composer-link behavior and cron parser: **64/64 unit tests passed**; actual team/entity/contributor/effort/reuse/import/composer and workflow consumers: **11/11 mounted tests passed**.
- Locale runtime: **5/5 unit tests passed**; runtime/live-formatter behavior: **7/7 mounted tests passed**; actual identity recovery component: **1/1 mounted test passed**.
- Full desktop TypeScript check (`node node_modules/typescript/bin/tsc --noEmit`) passed after both implementation-owner frozen signals.
- Direct reverse-direction observer-cache check passed: Korean-ingested item projected in English without replacing or mutating the item.

The runtime and Tiptap checks are jsdom/IPC seams. I did not exercise every repaired screen through the app or reproduce every backend failure remotely. Static source-bound expressions for some slot branches provide translation/control-flow evidence, not a claim of a completed native user journey.

## Unverified and intentionally excluded

Native app/IME composition, operating-system notification/menu operation, native narrow/zoomed layout, a real pairing exchange, repository-wide `just ci`, and human self-testing remain separate coordinator/user evidence. My own admin/credential changes were not reviewed here. No PR readiness or overall localization-completion attestation is issued by this document.

## Review scores and handoff

Minimalism 9/10, elegance 9/10, correctness 9/10 for the reviewed repair scope. The previously reported concrete blockers in this scope are resolved. The coordinator must still combine this with the separate review of my admin/credential implementation and current full app/native/CI evidence; this document does not substitute for those checks or human confirmation.

## Subsequent pure-data memo lifecycle repairs: independent re-review

The coordinator requested one final narrow review of three defects found during the broader memo/effect audit. I reviewed only those fixes, their actual caller paths and regressions they could introduce. I did not independently repeat the full 437-memo / 83-effect-chain census. No application source was edited by this reviewer.

| Repair | Current production boundary and independent evidence | Status |
| --- | --- | --- |
| Repository form draft reset | `features/projects/ui/AddProjectRepositoryDialog.tsx` keeps pure project-option computation in `React.useMemo` and initializes the form from canonical ordered project IDs, initial project ID, explicit choice mode, open state and access-channel ID. Recreated arrays or translated labels no longer own the draft. Real name/clone URL/channel/error and submit payload survive the switch in both single-project and category-create caller tests. Current project records remain available to render/submit. | Fixed; no blocker |
| Mention-send ownership/pending loss | `features/messages/ui/useMentionSendFlow.ts:89` uses ordinary `React.useMemo` for the source-owner object, keyed only by channel, draft key and revision accessor. The real composer revision accessor in `useDraftPersistSnapshot.ts` is already an ordinary stable callback. Locale changes do not replace the ownership fence, while true navigation/replacement/cancellation still invalidates stale work. Exact draft text, recipient keys, one-send behavior, pending state and cleanup are checked during delayed add and publish. | Fixed; no blocker |
| Model keyboard-highlight reset | `features/agents/ui/PersonaModelCombobox.tsx` retains normal option filtering and gates highlight reset by query plus ordered canonical `[value, disabled]` identity and first-enabled index. Display-label/array recreation alone no longer resets keyboard intent. Both stable options and the actual fresh dropdown producer retain the searched second model through language change and Enter. Query and disabled-catalog changes still reset to an enabled matching model. | Fixed; no blocker |

Two additional realistic caller failures were found in the first repair versions and returned to the implementation owner before this passing verdict:

1. **Model caller:** restoring plain `useMemo` alone passed the stable-prop test but failed the actual `AgentDefinitionDialog.tsx:602–617` option producer. I mounted the real combobox with the exact source-extracted initializer and actual `modelDropdownOptions` builder. `model` query → ArrowDown → Korean → Enter selected `model-first`, rather than `model-second`, because the caller rebuilt its array. The final canonical reset signature fixes that case; a real-producer regression now covers it.
2. **Project category caller:** restoring the local project memo alone passed the single-project case but failed `ProjectsView.tsx:257` → `ProjectsCategoryCreateDialogs.tsx:118` → dialog. I bound the actual `editableProjects` source factory and mounted the real dialog. Name `USER DRAFT` and clone URL `https://git.example/USER.git` became empty after switching. The final receiver dependency signature fixes the category route as well. The added test binds the actual upstream factory, real category component and real dialog, with external query/mutation/navigation dependencies mocked.

After the implementation owner's final frozen signal, I independently reran **51/51 mention-send unit/hook-fixture tests** (the 3 new locale cases plus existing cancellation/authority coverage) and **6/6 mounted tests** (both repository callers and four model selection/reset cases). The full desktop TypeScript check passed again. Existing draft-generation, recipient, payload and true-context reset logic is preserved; no further material defect was found in these three repairs.

These are React/DOM and production-hook-fixture checks. They do not establish native IME composition, a real relay publish, native keyboard dispatch, screenshots or human testing. The earlier native/CI/user-confirmation limits remain unchanged.

Latest narrow re-review completed at 2026-11-08T14:48:16.825681+00:00. No outstanding blocker remains in the three memo repairs reviewed above.

## Final producer, protected-catalog and work-item repairs

This additional review covers only the coordinator's final assigned changes. Production source remained read-only for this reviewer. No material blocker remains in this scope.

`features/projects/ui/ProjectsActivityFeed.tsx` retains canonical action identifiers, statuses, event data and English agent-context text. A finite action registry supplies complete translated sentences at render time. Actor and project slots retain their original links, callbacks and user data. Korean search can match the rendered action or status while the existing raw fields remain searchable. Known status presentation does not replace stored status values. `features/search/ui/TopbarSearch.tsx` keeps search-result context as canonical kind plus channel label, then renders complete message/thread phrases with the same channel chip. DM/thread detection, hit data and navigation retain their original identifiers. The workflow title additions in `final-props.json` fill the existing display registry without changing workflow types or stored values.

I independently reran **2/2 producer unit tests and 2/2 mounted tests**. The mounted tests exercise the actual activity feed and the production search helper and context renderer. They check Korean activity filtering, preserved agent-context data and the same channel chip through a language switch. No new protocol or sentence-meaning defect was found.

The protected-feature fix separates 17 existing messages into `catalogs/protected.json`. The pure `protectedFeatures/publicMessages.ts` exports an empty dictionary and no protected product names. `protectedFeatures/internalMessages.ts` exports those translations and preserves the product name `Bestie`. Vite selects `@protected-localization` using the same existing feature flag as protected metadata and components. TypeScript defaults to the public module, and the test loader follows the existing variant flag. Neither pure message module imports feature metadata, so this change avoids the metadata/translation import cycle. The static catalog checker reads both dictionaries for coverage; that checker does not join the public runtime import graph.

Independent separate-process checks confirmed that the public catalog contains none of the 17 protected source keys, while the internal catalog contains all 17, validates their parameters and preserves the product name. No consumer of those moved messages was found outside `protectedFeatures`. The existing protected-variant and artifact-selection tests passed **3/3**. Together with the producer tests above, this execution passed **5/5 unit tests**.

The actual artifact assertion was not weakened. `scripts/build-protected-feature-artifacts.mjs` is byte-identical to the recovery baseline snapshot, with 4,270 bytes and SHA-256 `f2d5acf4216962aa7905e6fc66904bb738b57e92b1ba995d22588983f8586967`. That snapshot establishes the previous local file, not upstream provenance. The script still builds both variants, rejects protected strings in OSS emitted artifacts and requires the internal artifact marker. I inspected the coordinator's current real-build log at `/private/tmp/buzz-ko-production-final-current.log`, which ends with `Protected feature artifact matrix passed; dist contains the OSS variant.` This is the coordinator's real build execution, not an independently rerun build. The log retains chunk-size and ineffective-dynamic-import warnings. They do not invalidate the artifact-contract result.

`features/settings/ui/KeyboardShortcutsCard.tsx` translates category titles at display while retaining category keys, shortcut IDs and platform key chords. A direct check of the real shortcut helpers confirmed identical keys, IDs and chords in English and Korean, with translated category titles.

The two additional work-item repairs in `features/projects/ui/CreateProjectIssueDialog.tsx` and `CreatePullRequestDialog.tsx` initialize repository selection from canonical ordered project/repository IDs, the default repository ID and open state. Recreated objects or translated names no longer reset the selected repository. Pull-request branch initialization now depends on repository ID and default-branch value. Current records still supply labels, validation and the original API payload. Canonical status comparisons and selection-error values remain raw; localization occurs at display. Actual repository removal and default-branch changes still trigger the required resets.

After the implementation owner's final frozen signal, I independently ran **4/4 mounted work-item tests**. They bind the actual `ProjectsView` project factory, actual outer dialogs and actual inner work-item dialog, with external query/mutation dependencies mocked. They cover repository and branch selection, user drafts, same-ID fresh metadata, raw submit payloads, real repository removal, default-branch changes and both locale-dependent validation messages. Full desktop TypeScript checking passed on the frozen source. No material regression was found.

This additional scope has minimalism 9/10, elegance 9/10 and correctness 9/10. Remaining native IME, real relay operation, full repository gate and human-confirmation evidence belongs to the coordinator's final report. The coordinator has supplied separate current app, native and repository-check results; this reviewer did not rerun those checks or substitute them for human testing. No PR readiness attestation is made here.
