# Computed label A/B 수정 독립 검토

2026-11-09에 `/root/link_review`가 작성자 freeze 후 batch A 17개, batch B 19개 production 파일의 실제 working-tree diff, 두 새 회귀 테스트, root-owned `manual.json`과 key 요청을 검토했습니다. 최초 inventory 37+14, 총 51개 그룹과 별도 수동 추적한 Archive·MessageComposer 경로는 모두 **fixed**입니다. 현재 scoped blocker는 없습니다. 최소성·구조·정확성은 각각 9/10입니다.

전체 발견 목록과 각 행의 최종 상태는 `computed-label-review.md`에 있습니다. 기존 clear 17개와 추가 clear 6개는 번역 완료·보존 데이터·false positive로 분류한 항목이며 새 수정 대상으로 바꾸지 않았습니다.

## 검토 범위

A는 다음 파일입니다. 아래 모든 경로의 root는 `app/desktop/src/`입니다.

- agents UI의 `AgentConfigPanel.tsx`, `AgentRuntimeAvatarControl.tsx`, `agentConfigControls.tsx`, `buzzAgentModelTuningFields.tsx`
- channels UI의 `AgentSessionThreadPanel.tsx`, `BotActivityBar.tsx`, `ChannelBrowserDialog.tsx`, `ChannelPermissionsSettings.tsx`, `ChannelManagementSheetRows.tsx`
- projects UI의 `CreateProjectFormSettings.tsx`, `ProjectChannelHome.tsx`, `ProjectDetailFeedPanels.tsx`, `ProjectHomeContextPanel.tsx`, `ProjectRepositoryPanel.tsx`, `PullRequestReviewersRow.tsx`, `RepositoryCards.tsx`, `ProjectsWorkItemsLoadNotice.tsx`

B는 다음 파일입니다.

- communities UI의 `AddCommunityDialog.tsx`
- home UI의 `InboxDetailPane.tsx`, `InboxFilterMenu.tsx`, `InboxListPane.tsx`, `ProjectInboxDetailPane.tsx`
- huddle components의 `MicControls.tsx`, `ParticipantList.tsx`
- messages UI의 `ComposerAttachments.tsx`, `MessageComposer.tsx`, `MessageThreadSummaryRow.tsx`, `NewMessageScreen.tsx`
- onboarding UI의 `AvatarStep.tsx`, `BackupStep.tsx`
- profile UI의 `NostrBindConsentDialog.tsx`
- settings UI의 `ProfileSettingsCard.tsx`
- sidebar UI의 `ChannelSectionDialogs.tsx`, `CommunityRail.tsx`, `SidebarRelayConnectionCard.tsx`
- shared UI의 `VideoPlayer.tsx`

별도 첫 fallback batch 네 파일, 두 regex 복원과 preview alt는 앞선 독립 검토에서 닫았습니다. B에 함께 승인된 `tests/e2e/voice-note.spec.ts`의 asset URL 수정도 이 검토에 포함했습니다. 이 검토자는 review 문서 외의 source·catalog·Git·remote를 수정하지 않았고 키를 읽지 않았습니다. Git 읽기 전에는 새 관리 저장소의 Hermit을 활성화했습니다.

## 기능 보존 판단

변경은 app-owned 표시문을 locale translator로 보내며 조건·control value·callback 인자를 그대로 유지합니다. 사용자 이름, 채널 이름과 description, persona·team·template 이름, repository·branch·host·hash, provider model label, 전달된 placeholder와 server diagnostic을 번역하지 않는 분기를 확인했습니다. 원문이 우연히 `None`, `Agent`, `Select` 같은 catalog key와 같더라도 데이터 분기를 보존하는 회귀가 있습니다.

- A의 channel/forum empty-state·검색·정렬 문장은 영어 plural fragment를 붙이는 대신 완전한 각 문장으로 번역합니다. createKind와 visibility의 canonical enum, query·sort 값은 그대로입니다. 기존 sort metadata getter는 locale을 읽으므로 module load 때 언어가 고정되지 않습니다.
- Numeric tuning의 map은 raw source를 보존하고 render 경계에서 번역합니다. built-in effort label만 알려진 값별로 번역하며 unknown provider 값의 원래 humanize 동작은 유지합니다. option.value, env key, min, current selection과 onChange 값은 바꾸지 않았습니다.
- Aggregate failure notice는 app-owned subject·section label·fallback 문장만 번역합니다. `Error.message`, retry 동작, isRetrying과 failure 조건은 보존합니다. 확인한 README·preview regex도 이미 공식 source와 같습니다.
- B는 thread reply·reminder·draft·mention·section deletion의 0/1/여러 개 분기를 완전한 문장으로 표시합니다. count와 timestamp, channel 이름, authored media label과 filename은 interpolation 데이터로 남습니다.
- Nostr bind는 canonical `copyButtonLabel`의 `Continue`·`Signing…` 비교를 유지하고 별도 `copyButtonDisplayLabel`만 번역합니다. signing·verification·response 데이터와 callback은 변경하지 않습니다.
- Memoized component와 derived participant identity도 기존 locale subscription·useLocaleMemo를 사용합니다. `useLocaleCallback`의 translator는 호출 시점의 현재 locale을 읽으므로 VideoPlayer에서 안정된 translator를 불필요한 dependency에서 제거한 변경도 stale language closure를 만들지 않습니다.
- Backup storage 문구만 번역하며 identityStorage 값이나 실제 keyring·파일·credential 처리를 바꾸지 않습니다. 새로운 API·protocol·저장 schema 변경은 없습니다.

이 범위에 현실적인 correctness·security·합의된 기능 보존 결함은 발견하지 못했습니다.

## 독립 실행 증거

다음 두 테스트 파일을 작성자 freeze 뒤 별도로 직접 실행했습니다.

```sh
node --import ./test-loader.mjs --experimental-strip-types --test \
  src/shared/i18n/computedBatchA.test.mjs
node --import ./test-loader.mjs --experimental-strip-types --test \
  src/shared/i18n/computedBatchB.test.mjs
```

A는 **15/15**, B는 **20/20** 통과했습니다. regression은 실제 production initializer·component·JSX consumption을 AST로 읽어 실행합니다. test-only 복제 문구 helper를 검사하지 않습니다. 추가로 다음 실제 모듈을 import하고 DOM에 mount하는 검사가 있습니다.

- A는 실제 EffortSelectField, NumericTuningFields, AgentConfigSurfaceRows, ChannelHero, ProjectsWorkItemsLoadNotice를 사용합니다. 같은 memoized parent render와 같은 props에서 EN→KO→EN으로 전환해 label 갱신, 기존 select node·선택값 `high`·numeric 값 `0` 유지와 추가 onChange write 부재를 확인합니다. 사용자 runtime/config/channel 값과 provider diagnostic도 유지됩니다.
- B는 실제 InboxFilterMenu와 SidebarRelayConnectionCard를 같은 frozen props로 mount합니다. EN→KO→EN에서 같은 button node와 focus, raw `mention` filter를 유지하고 onFilterChange·reconnect가 호출되지 않음을 확인합니다.

첫 fallback batch **4/4**, README·rich preview **4/4**도 이 검토자가 직접 실행해 통과했습니다. 따라서 직접 실행한 새 scoped regression 총계는 **43/43**입니다. 작성자가 보고한 확대 96개·TypeScript·Biome·size 검사와 구분한 수치입니다. root의 새 전체 CI 실행은 별도 결과가 필요합니다.

## Shared catalog

현재 실제 locale runtime으로 A key 요청 v3의 **92개**, B v4의 **91개**를 모두 확인했습니다. 각 key의 영어와 한국어 결과가 다르고, 모든 placeholder에 넣은 `USER_<name>` sentinel이 한국어 결과에 정확히 남습니다. 전체 manual catalog는 validateCatalog의 nonempty·placeholder set 검사도 통과했습니다.

Root의 computed key 150개와 앞선 fallback 5개는 app-owned source 문장을 대상으로 합니다. 기존 canonical participant 세 template은 재사용합니다. `Raw ACP activity`의 `ACP 활동 원본`, availability·reviewer 문장의 한국어 의미와 새 count 문장도 확인했습니다. catalog가 원문 user value나 account data를 덮는 연결은 없습니다.

## Voice-note test harness

원래 voice-note 파일과 현재 전체 TypeScript AST를 비교했습니다. 이전 AUDIO_URL 정의와 새 helper 정의를 제외하고, 정확히 여섯 URL 참조를 같은 symbol로 정규화하면 node kind·identifier·모든 text literal이 같습니다. payload·playback gate·shortcut·assertion을 제거하거나 완화하지 않았습니다.

새 helper는 test/beforeEach가 실행될 때 project baseURL에서 같은 `/sounds/ping.mp3`를 구합니다. 기본 4173에서 이전 URL과 같고 private 4381에서도 실제 test server의 같은 asset을 사용합니다. 앱 audio source를 바꾸는 수정이 아닙니다.

작성자의 receipt도 읽었습니다. `.local/voice-note-report.json`은 13 passed, skipped 0, unexpected 0, flaky 0입니다. `.local/computed-batch-b-report.json`은 새 private 4386 build의 focused UI 7 passed, skipped 0, unexpected 0, flaky 0입니다. 이 검토자는 활성 broad smoke와 중복 실행하지 않았으며 이 E2E receipt를 직접 재실행 결과로 표현하지 않습니다.

## 남은 배포 증거

이 inventory에서 pending은 0입니다. 전체 full smoke·새 combined CI·실제 release bundle·OS 권한·native 업데이트와 사용자 직접 확인은 총괄의 별도 검증입니다. 위 Node·DOM 검사는 해당 native·release 동작을 대신하지 않습니다. 이 검토를 전체 앱의 모든 미래 문자열에 대한 번역 보증이나 배포 완료로 확대하지 않습니다.
