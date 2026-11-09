# Computed label 표시 경로 독립 검토

2026-11-09에 `/root/link_review`가 현재 `app/desktop/src/`의 production TS/TSX 1,761개 파일을 읽었습니다. 구현·catalog·테스트는 수정하지 않았고 이 보고서만 작성했습니다. 원본 앱, remote, 개인 키는 접근하지 않았습니다.

최종 frozen A/B 검토에서 최초 51개 그룹과 별도 수동 추적 두 그룹이 모두 fixed로 확인됐습니다. 남은 scoped blocker는 없습니다. 아래 목록은 발견 당시의 문자열과 근거이며 최종 증거는 `computed-batches-review.md`에 있습니다.

실제 TypeScript AST에서 변수 initializer 안의 영어 literal/template과 JSX `alt`, `title`, `aria-label`, `placeholder` 참조를 연결했습니다. 77개 sink 참조가 54개 initializer 그룹으로 묶였습니다. 동일 파일의 이름 연결은 lexical scope를 완전히 판정하지 않으므로 실제 caller·callee와 DOM 전달을 읽어 false positive를 분리했습니다. import한 함수 내부나 임의의 런타임 값을 전부 추적하는 감사는 하지 않았습니다. 아래 표는 이 54개 그룹을 모두 분류하며 별도 요청받은 Archive와 확인 중 발견한 composer 전달 경로도 기록합니다.

`useAppLocale()`는 locale 변경 시 다시 렌더링하게 하지만 문자열을 번역하지 않습니다. `localize("…{value1}…", {value1: rawEnglish})`도 값 자체를 다시 번역하지 않습니다. 기본 Button·Input·AlertDialogTitle·PanelSectionGroup·ProjectPanelState와 확인한 custom callee는 받은 문자열을 그대로 DOM에 전달합니다. 이 점 때문에 literal JSX 검사 0건이 전체 번역 완료를 뜻하지 않습니다.

## 확인한 미번역 경로

아래 경로 앞에는 모두 `/Users/stan/orca/buzz-korean/app/desktop/src/`가 붙습니다. 행 번호는 검토 당시 working tree입니다. catalog의 '없음'은 해당 원문·template의 정확한 key가 발견 당시 JSON catalog에 없었다는 뜻입니다. 제목·날짜·이름·domain·filename·hash·provider 진단·option value는 원래 값을 보존하고 app이 만든 표시 문구만 번역해야 합니다.

| 경로와 initializer | 실제 sink와 남는 영어 | 발견 당시 재사용 가능한 key  상태 |
| --- | --- | ---  --- |
| `features/agents/ui/AgentConfigPanel.tsx:345` `flatStateTitle` | 360·378의 ProfileConfigSection을 거쳐 h2에 `Model settings`, `MCP servers`, `Advanced`. loading/error의 flat 분기에서 표시됩니다. | 세 원문 모두 있음  fixed |
| `features/agents/ui/AgentRuntimeAvatarControl.tsx:167` `availabilityLabel` | 201 aria-label·208 title의 번역된 외피 안에 fallback `Availability unknown`이 그대로 삽입됩니다. | 정확한 fallback 없음  fixed |
| 같은 파일 158 `actionLabel` | 218 aria-label·237 title·242 Spinner label에 `Restarting Agent`, `Starting Agent`, `Restart Agent`, `Start Agent`. | `Restart Agent`, `Start Agent` 있음. 진행형 두 개 없음  fixed |
| `features/agents/ui/AgentSessionToolItem/ViewImageToolPreview.tsx:16` `alt` | 26 img alt·36 lightbox alt의 fallback `Viewed image`. 전달된 title은 사용자/도구 내용이므로 보존해야 합니다. | `Viewed image` 있음  fixed |
| `features/agents/ui/agentConfigControls.tsx:539` `restingPlaceholder` | 561 AgentDropdownSelect의 span까지 `Loading models...`가 그대로 전달됩니다. | `Loading models...` 있음  fixed |
| `features/channels/ui/AgentSessionThreadPanel.tsx:147` `lastUpdatedTitle` | 513 span title에 `Last updated <date>`. | `Last updated {value1}` 있음  fixed |
| `features/channels/ui/BotActivityBar.tsx:154` `triggerLabel` | 171 button aria-label의 외피만 번역되고 `<name> is working`, `<count> agents working`이 영어로 남습니다. | 정확한 두 template 없음. 사용자 agent name은 보존  fixed |
| `features/channels/ui/ChannelBrowserDialog.tsx:235` `searchPlaceholder` | 546 Input placeholder의 `Search or create a forum/channel`, `Search forums/channels by name or description`. | 네 정확한 문장 없음  fixed |
| 같은 파일 266 `selectedSortLabel` | 556 aria-label에 option label, fallback `Alphabetical`이 영어로 삽입됩니다. entityLabel의 `forum/channel`도 외피의 값으로 남습니다. | `Alphabetical` 있음. sort value와 entity kind는 변경하면 안 됨  fixed |
| 같은 파일 416 `emptyTitle` | 661 BrowseState의 p에 `No … match your search`, `No archived/joined …`, `No … to browse`. BrowseState는 title을 번역하지 않습니다. | 정확한 template 없음  fixed |
| `features/channels/ui/ChannelPermissionsSettings.tsx:52` `visibilityLabel` | 84 aria-label 외피의 값으로 `Private`, `Public`이 남습니다. | 두 key 있음. visibility enum은 보존  fixed |
| `features/home/ui/InboxDetailPane.tsx:532` `openContextLabel` | 594 title·663 aria-label의 `Open full thread`, `Open conversation`, `Open in channel`. | 정확한 세 key 없음  fixed |
| `features/home/ui/InboxFilterMenu.tsx:95` `statusLabel` | 106 aria-label 안의 `<n> due reminder(s)`, `<n> active draft(s)`. filter option label도 외피 값으로 전달됩니다. | 정확한 count template 없음  fixed |
| `features/home/ui/ProjectInboxDetailPane.tsx:52` `inboxTitle` | 120 title과 h2의 번역된 문장에 `a review` 또는 `a task`가 원문 그대로 삽입됩니다. | 외피 `{value1} sent you {value2}` 있음. 두 고정 대상 구절 없음  fixed |
| 같은 파일 58 `openLabel` | 126 aria-label·130 title·wide button text의 `Open review`, `Open task`. | 두 key 있음  fixed |
| `features/huddle/components/MicControls.tsx:128` `micButtonLabel` | 162 Button aria-label에 `Microphone unavailable`, `Unmute microphone`, `Mute microphone`. Button은 번역하지 않습니다. | unavailable 있음. mute/unmute 정확한 key 없음  fixed |
| `features/huddle/components/ParticipantList.tsx:129` `displayName` | 299·362·403 aria-label 외피 안에 이름 없는 참가자의 `Agent <key>` 또는 `Participant <key>`. | `Agent` 있음. `Participant` 없음. authoredName과 key는 보존  fixed |
| `features/messages/ui/ComposerAttachments.tsx:286` `mediaLabel` | 370 Dialog trigger aria-label·437 image editor alt·561 remove aria-label 값의 fallback `Video attachment <hash>`, `Attachment <hash>`. | 정확한 두 template 없음. 공급자 displayLabel·filename·hash는 보존  fixed |
| `features/messages/ui/MessageThreadSummaryRow.tsx:131` `summaryAriaLabel` | 245 button aria-label의 `View thread with … reply/replies, last reply …`. | 정확한 template 없음. count와 날짜 원값은 보존  fixed |
| `features/messages/ui/NewMessageScreen.tsx:306` `composerPlaceholder` | 628 MessageComposer에서 useRichTextEditor를 거쳐 `Choose a recipient to start a message`, `Message <name>`, `Message <count> people`. 제공된 placeholder는 번역되지 않습니다. | `Message {value1}` 있음. 나머지 정확한 key 없음  fixed |
| `features/onboarding/ui/AvatarStep.tsx:305` `previewName` | 386·427 AvatarPreview prop을 거쳐 95 emoji-avatar aria-label의 값에 fallback `Your avatar`가 남습니다. | 정확한 fallback 없음. 입력한 이름은 보존  fixed |
| `features/profile/ui/NostrBindConsentDialog.tsx:260` `copyButtonLabel` | 907 Button aria-label과 920 sr-only에 `Signing…`, `Continue`. 화면용 두 span은 따로 번역됐지만 이 경로는 아닙니다. | 두 key 있음. 아래 상태 비교에 쓰는 원문 값을 변경하기보다 표시용 변수를 분리해야 함  fixed |
| `features/projects/ui/CreateProjectFormSettings.tsx:56` `listingLabel` | 190 aria-label의 값에 `Unlisted`, `Listed`. | 두 key 있음. 저장 visibility는 보존  fixed |
| 같은 파일 57 `agentLabel` | 242 aria-label 값의 fallback `None`. | `None` 있음. 선택한 persona displayName은 보존  fixed |
| `features/projects/ui/ProjectChannelHome.tsx:239` `expandLabel` | 359 aria-label·364 title의 `Open … in repository`와 `Open in repository`. | 정확한 두 key 없음. workspace tab 식별자는 보존  fixed |
| `features/projects/ui/ProjectDetailFeedPanels.tsx:355` `authorLabel` | 421 title의 값에 fallback `Unknown author`. 실제 authorName/email은 사용자 git 데이터입니다. | 정확한 fallback 없음  fixed |
| `features/projects/ui/ProjectHomeContextPanel.tsx:221` `addRepositoryTitle` | 286·297·308·319·333 ContextNavButton을 거쳐 Button title에 `Add a repository to this project`. | 정확한 key 없음  fixed |
| `features/projects/ui/ProjectRepositoryPanel.tsx:757` `stateMessage` | 774 ProjectPanelState의 p에 `Could not load the repository file tree.`, `No files have been pushed yet.` | 첫 문장 없음. 둘째는 마침표 없는 key만 있음. 외부 unavailableMessage는 보존  fixed |
| `features/projects/ui/PullRequestReviewersRow.tsx:321` `decisionLabel` | 348 title과 sr-only에 `Approved by …`, `Changes requested by …`, `Re-review needed from …`, `Awaiting review from …`. | 정확한 네 template 없음. reviewer label은 보존  fixed |
| `features/projects/ui/RepositoryCards.tsx:75` `label` | 96 span aria-label과 tooltip의 `Buzz-hosted repository`, `Git data hosted on …`, `Repository host`. | 정확한 세 key 없음. host는 보존  fixed |
| `features/settings/ui/ProfileSettingsCard.tsx:122` `accessibleLabel` | 126 aria-label·136 title의 `Done editing …`, `Edit …`. label이 이미 한국어여도 영어 동사가 남습니다. | `Edit {value1}` 있음. done template 없음  fixed |
| 같은 파일 313 `resolvedName` | 629 aria-label 값의 fallback `Your profile`. | `Your profile` 있음. 실제 displayName은 보존  fixed |
| `features/sidebar/ui/CommunityRail.tsx:118` `tooltipLabel` | 131 button aria-label과 tooltip의 `<community> — <count> mention(s)`, `<community> — unread`. | 정확한 전체 template 없음. `unread` key 있음. community.name은 보존  fixed |
| `features/sidebar/ui/SidebarRelayConnectionCard.tsx:72` `reconnectTitle` | 115 SidebarCompactActionCard의 motion.span까지 `Waiting to reconnect`, `Connecting`. | `Connecting` 있음. waiting 문장 없음  fixed |
| `shared/ui/VideoPlayer.tsx:1301` `postDisabledReason` | 1907·1926 button title의 `Wait for the video message to finish sending.`, `Posting...`. `Commenting is unavailable…` 분기는 해당 tray 자체가 onSendComment 조건으로 숨겨지므로 이 두 sink에서는 단독 실패로 세지 않습니다. | 정확한 두 key 없음  fixed |
| `shared/ui/markdown/InlineEmojiPopover.tsx:20` `label` | 59 button aria-label·67 img title와 popover text의 fallback `Custom emoji`. | `Custom emoji` 있음. 원래 alt/shortcode는 보존  fixed |
| `shared/ui/markdown.tsx:691` `label` | 736 실제 portal dialog div의 aria-label에 fallback `Image preview`. | 정확한 fallback 없음. currentItem.alt는 보존  fixed |

각 행은 실제 값이 해당 DOM 또는 확인한 callee에 그대로 도달하는 소스 경로입니다. 모두를 브라우저로 실행했다는 뜻은 아닙니다. 위 목록의 app-owned 영어는 한국어 완료 계약의 구체적 누락이며, 사용자 내용 자체를 번역하는 방식으로 고치면 안 됩니다.

## 요청된 추가 경로와 인접 callee 확인

- `features/profile/ui/ArchiveConfirmDialog.tsx:38`의 `Archive this agent?`, `Archive this identity?`는 46 AlertDialogTitle을 거쳐 제목으로 그대로 표시됩니다. AlertDialogTitle은 전달받은 children을 번역하지 않습니다. 39행 `this agent`와 `this person`도 LocalizedMessage의 `part1` 값으로 보존되므로 한국어 외피 안에 영어가 남습니다. catalog에는 `Archive {part1}?`와 `this agent`가 있으나 `this person`과 정확한 두 질문은 없습니다. 이 고정 대상 문구만 번역하고 isBot·onConfirm·archive 동작은 바꾸면 안 됩니다.
- `features/messages/ui/MessageComposer.tsx:280`의 `computedPlaceholder`는 `Edit your message`, `Reply to <author> in #<channel>`, `Message #<channel>`을 만듭니다. `features/messages/lib/useRichTextEditor.ts:340`은 제공된 placeholder를 그대로 사용하고, 아예 없을 때만 `Write a message…`를 번역합니다. catalog에는 `Message #{value1}`가 있습니다. edit·reply 정확한 key는 없습니다. 새 메시지 화면의 caller 이외에도 기본 composer 표시 경로 자체를 수정해야 합니다. author와 channelName은 보존 대상입니다.

## 나머지 17개 flagged initializer의 분류

| 경로·initializer | 판단 |
| --- | --- |
| `features/agents/ui/AgentConfigFields.tsx:623` `compactProviderZeroLabel`, placeholder 718 | fallback은 이미 `translateInterfaceText("Select a provider")`. provider option label/id는 외부 데이터로 보존합니다. |
| `features/agents/ui/AgentDescriptionField.tsx:44` `placeholder`, 113 | initializer가 이미 translator 호출입니다. |
| `features/agents/ui/AgentRuntimeAvatarControl.tsx:179` `errorActionLabel`, 218·237 | initializer가 이미 translator 호출입니다. 실제 runtime errorLabel은 외부 diagnostic으로 보존합니다. |
| `features/agents/ui/AgentSessionToolItem/TodoToolSummary.tsx:41` `actionLabel`, title 51 | sink는 object 부분입니다. 사용자 fallbackPreview 또는 이미 번역된 `todos`입니다. `Updated`는 별도 formatActivityVerb 처리입니다. |
| `features/agents/ui/OtherSetupAgentMarker.tsx:11` `OTHER_SETUP_LABEL`, 24·28 | 실제 attribute에서 `localizeConstant`로 번역합니다. |
| `features/agents/ui/activityRenderClasses/UserMessageBubble.tsx:51` `authorLabel`, 107 | scanner가 잡은 `User` fallback은 authorPubkey가 없는 분기인데 실제 profile button은 authorPubkey가 있을 때만 나옵니다. 그 fallback의 이 sink 도달은 불가능합니다. 실제 이름·key는 보존합니다. |
| `features/messages/ui/FormattingToolbar.tsx:268` `label`, 399 | false positive입니다. `window.prompt` 결과의 지역 label과 `item.label`은 다른 값입니다. 이 항목만으로 toolbar label 미번역을 판정하지 않습니다. prompt 문구 자체는 이번 computed-attribute 연결 범위 밖입니다. |
| `features/projects/ui/ProjectCards.tsx:274` `status`, title 661 | false positive입니다. 다른 scope의 status 변수와 JSX StatusPill의 status property 이름을 연결했습니다. 274의 label/description은 이미 번역됩니다. |
| `features/projects/ui/ProjectDetailFeedPanels.tsx:84` `label`, title 196 | contributor 이름·email·profile label을 보존하고 fallback `Unknown contributor`는 이미 번역합니다. |
| `features/projects/ui/ProjectsActivityFeed.tsx:380` `actorLabel`, 432 | 사용자 actorName·profile label을 보존하고 fallback `Someone`은 이미 번역합니다. |
| `features/projects/ui/ProjectsChannelsList.tsx:101` `name`, title 240 | 동일 이름에 따른 중복 연결입니다. 확인한 이름 경로는 channel.name을 보존하고 unavailable fallback은 번역합니다. |
| 같은 파일 184 `name`, title 240 | 실제 해당 scope도 위와 같습니다. |
| `features/projects/ui/ProjectsOverviewChatToggle.tsx:21` `label`, 27·33 | initializer가 이미 translator 호출입니다. sectionTitle 값은 별도 전달합니다. |
| `features/settings/ui/SignOutSection.tsx:33` `SIGNOUT_CONFIRM_PHRASE`, placeholder 248 | 의도적으로 보존할 확인 입력 데이터 `wipe all my data`입니다. placeholder만 번역하면 검증 문자열과 달라집니다. 이번 표시문 누락으로 세지 않습니다. |
| `features/workflows/ui/ChannelCombobox.tsx:193` `selectedLabel`, 205 | channel label/name은 사용자 데이터, unavailable 분기는 이미 번역된 값입니다. 외부 emptyLabel prop의 원문을 추측하여 미번역으로 세지 않았습니다. |
| `shared/layout/AuxiliaryPanelHeader.tsx:64` `AUXILIARY_PANEL_CLOSE_LABEL`, 354 | 실제 attribute에서 `localizeConstant`를 호출합니다. |
| `shared/ui/rich-link-preview-attachment.tsx:78` `alt`, 122·131 | 이번 수정에서 이미 `localize("Preview from {value1}")`로 고쳤습니다. domain은 String 값으로 보존합니다. 아래 production 회귀도 통과했습니다. |

## 직접 실행한 확인과 기존 regex 종료

실제 component와 locale runtime을 불러 `setLocale("ko")` 후 React SSR을 실행했습니다. InlineEmojiPopover는 `aria-label="Custom emoji"`, `title="Custom emoji"`를, ViewImageToolPreview는 `alt="Viewed image"`를 그대로 출력했습니다. 테스트용 복제 helper를 실행하지 않았습니다. 프로세스 종료 전 locale은 영어로 복원했습니다.

앞선 regex 수정 freeze도 독립 확인했습니다. 두 production 파일의 모든 regex literal multiset이 공식 `397f187`과 정확히 같습니다. 실제 README normalizer·rich preview·localized image/lightbox label을 검사하는 새 테스트 두 파일은 직접 실행에서 **4/4 통과**했습니다. 기존 regex 차단 두 건과 preview domain alt는 해결됐습니다. 해당 최종 결과는 `regex-compatibility-review.md`에도 기록했습니다.

이 보고서는 computed label 누락의 inventory입니다. 이 문단까지는 최초 inventory 근거입니다. 현재 수정 완료 여부는 아래 최종 상태와 별도 batch review에 기록했습니다. 전체 broad smoke를 중복 실행하거나 사용자 데이터를 변경하지 않았습니다.

## 추가 요청된 computed visible title·description

총괄의 추가 요청에 따라 같은 production 파일 집합에서 title·description·heading·caption 변수의 JSX children과 label/description prop도 확인했습니다. 아래는 추가로 걸린 20개 initializer 그룹의 전체 분류입니다. 같은 시간에 구현 작업자가 앞선 항목을 수정하고 있으므로, 앞선 표의 key 가용성과 코드 문구는 발견 당시 상태입니다.

### 추가로 확인한 누락

| 경로·initializer | 실제 표시와 정확한 문구 | 발견 당시 catalog  상태 |
| --- | --- | ---  --- |
| `features/agents/ui/buzzAgentModelTuningFields.tsx:245` `NUMERIC_KIND_DESCRIPTIONS` | 300에서 선택해 326 p에 그대로 표시합니다. `Maximum tokens the LLM may generate per response. Leave blank to inherit.`, `Maximum context window tokens tracked before a handoff. Leave blank to inherit.`, `Maximum LLM + tool-call rounds per turn. 0 = unlimited. Leave blank to inherit.`. 같은 display 경로의 239 `NUMERIC_KIND_LABELS`도 `Max output tokens`, `Context limit`, `Max rounds`를 label에 그대로 표시합니다. | 세 description 정확한 key 없음. enum·env key·숫자 제약은 보존하고 표시 label/description만 번역  fixed |
| `features/channels/ui/ChannelBrowserDialog.tsx:234` `browseTitle` | DialogTitle의 `Add a forum`, `Browse channels`. | `Browse channels` 있음. forum key 없음  fixed |
| 같은 파일 424 `emptyDescription` | BrowseState의 p에 `No <entity> by that name yet — create it to get started.`, `Try a different name or keyword.`, `Archived <entity>s you have joined will appear here.`, `<Entity>s you join will appear here.`, `All open <entity>s are available in the sidebar. Create a new <entity> to get started.` | 정확한 문장·template 없음. 한국어에 영어 plural suffix를 연결하면 안 됨  fixed |
| `features/channels/ui/ChannelManagementSheetRows.tsx:34` `description` | channelDescription이 없고 onEdit가 있으면 실제 hero button의 paragraph에 `Add a description`. | 정확한 key 없음. 기존 channel.description은 사용자 내용으로 보존  fixed |
| `features/communities/ui/AddCommunityDialog.tsx:91` `title` | 133 DialogTitle에 `Create a new community`, `Join an existing community`, `Add community`. | 세 key 모두 있음  fixed |
| 같은 파일 98 `description` | 138 DialogDescription에 `Opens Builderlab in your browser.`, `Use the community URL or invite link you received.`, `Create a new community or join one you already have.` | 정확한 세 문장 없음. Builderlab 이름과 연결 URL은 보존  fixed |
| `features/home/ui/InboxListPane.tsx:62` `INBOX_EMPTY_STATE_TITLES` | 779 이후 실제 empty-state p에 `No activity yet`, `No project work found`, `No mentions found`, `No threads found`, `Nothing needs action`, `No agent updates found`, `No reminders`, `No drafts`. | `No activity yet`, `No reminders`, `No drafts` 있음. 나머지 정확한 key 없음  fixed |
| 같은 파일 73 `INBOX_UNREAD_EMPTY_STATE_TITLES` | 같은 p에 `No unread activity`, `No unread project work`, `No unread mentions`, `No unread threads`, `No unread items needing action`, `No unread agent updates`, `No unread reminders`, `No unread drafts`. | 여덟 정확한 key 없음. filter enum과 unread 상태는 보존  fixed |
| `features/onboarding/ui/BackupStep.tsx:173` `storageTitle` | 233 span에 `Protected by your system keychain`, `Stored in private device storage`, `Protected in private device storage`. | 정확한 세 key 없음. identityStorage enum을 번역하면 안 됨  fixed |
| 같은 파일 167 `storageDescription` | 235 span에 `Buzz keeps your identity key in your system keychain. Your computer may ask for your password when Buzz needs to read the key.`, `Your system keychain wasn’t available, so Buzz keeps your identity key in a private file on this device.`, `Buzz keeps your identity key protected on this device. Make a separate backup in case you lose access.` | 정확한 세 key 없음. 보관 방식과 backup 의미를 그대로 유지해야 함  fixed |
| `features/projects/ui/ProjectsWorkItemsLoadNotice.tsx:46` `title` | 64 p에 `Could not load <displaySubject>.`, `Some <detailSubject> details could not be loaded.`. 대상은 reviews/tasks/project activity입니다. | 정확한 두 template 없음  fixed |
| 같은 파일 49 `description` | 65 p에 app fallback `The relay request failed.` 또는 `Missing <section labels>. The available results are shown below.`. section labels는 assignments/comments/review updates/statuses입니다. | fallback key 있음. partial-error template 없음. Error 객체의 message는 외부 diagnostic이므로 그대로 보존  fixed |
| `features/sidebar/ui/ChannelSectionDialogs.tsx:264` `description` | 실제 DeleteSection AlertDialogDescription에 `Delete section "<name>"? It has no channels.` 또는 `Delete section "<name>"? Its <count> channel(s) will move back to the default Channels group.`. scanner가 다른 scope의 109도 잡았지만 실제 이 description은 아래 delete dialog에 전달됩니다. | 정확한 template 없음. sectionName·channelCount·삭제 동작을 보존하고 표시만 번역  fixed |
| `features/sidebar/ui/SidebarRelayConnectionCard.tsx:75` `reconnectDescription` | 88 description prop을 거쳐 SidebarCompactActionCard의 실제 span에 `Complete any prompts opened by the reconnect helper to continue.` 또는 `Reconnecting`. | 정확한 두 key 없음. reconnect helper 실행 정책은 변경하면 안 됨  fixed |

### 추가 flag 중 이미 처리됐거나 보존할 값

| 경로·initializer | 분류 |
| --- | --- |
| `features/messages/ui/MessageThreadPanelSkeleton.tsx:47` `title` | JSX 전체를 저장한 변수입니다. button aria/title의 app-owned prefix는 이미 localize하고 실제 headerTitle은 caller 값으로 보존합니다. 새 미번역으로 세지 않습니다. |
| `features/profile/ui/ArchiveConfirmDialog.tsx:37` `title` | 추가 pass 시점에는 worker가 두 분기를 localize하도록 이미 수정했습니다. 최초 미번역 발견과 구분합니다. |
| 같은 파일 40 `description` | worker가 두 완전한 문장 분기를 localize하도록 이미 수정했습니다. 이번 보고서가 수정 후 DOM 회귀까지 인증하는 것은 아닙니다. |
| `features/projects/ui/CreatePullRequestDialog.tsx:155` `description` | app-owned 안내와 commit 포함 template은 localize돼 있습니다. raw 분기는 `<repository>: <source branch> → <target branch>`만으로 이루어진 사용자/code 식별 데이터입니다. 번역 대상으로 세지 않습니다. |
| `features/search/ui/TopbarSearch.tsx:60` `SEARCH_SECTION_TITLE_CLASS` | CSS class 문자열의 이름에 TITLE이 있어 잡힌 false positive입니다. 사용자 문구가 아닙니다. |
| `features/workflows/ui/WorkflowDialog.tsx:95` `TITLES` | 591의 실제 JSX sink에서 `localize(TITLES[mode])`를 호출합니다. 원래 workflow mode 값은 보존합니다. |

이 추가 pass는 14개 미번역 initializer와 6개 처리 완료·보존·false-positive 그룹으로 분류했습니다. 첫 표의 54개와 별도 집계입니다. 숫자 tuning의 인접 label 3개는 같은 실제 렌더 경로를 확인하다 함께 찾은 app-owned 문구입니다. 추가 구현도 각 소유자의 freeze 후 독립 검증했으며 최종 상태는 위 표의 fixed와 같습니다.

## 첫 fallback 구현 batch 수정 후 독립 확인

작성자의 별도 freeze 후 InlineEmojiPopover, markdown ImageZoomOverlay, ViewImageToolPreview, ArchiveConfirmDialog 네 파일을 다시 읽었습니다. fallback만 locale translator를 호출하며 다음 원래 데이터 처리를 보존합니다.

- Inline emoji와 overlay의 표시 label은 기존과 같은 `alt?.trim()`을 사용합니다. 실제 img alt에는 supplied alt 원문이 남습니다. 원문이 우연히 `Custom emoji` 또는 `Image preview`여도 사용자 내용으로 취급합니다.
- ViewImageToolPreview는 `title ?? localize("Viewed image")`이므로 supplied title과 빈 문자열을 바꾸거나 trim하지 않습니다.
- Archive는 app-owned 네 완전한 질문·설명만 번역합니다. identity 조건과 확인 동작은 그대로이며 남은 rich message 내용도 보존합니다.

이 검토자가 직접 실행한 `src/shared/i18n/computedLabels.test.mjs`는 **4/4 통과**했습니다. 실제 production component 함수를 AST로 읽어 React SSR로 실행하고, overlay는 실제 initializer와 aria-label 연결을 읽어 검사합니다. 영어·한국어, 제공된 영어와 한국어 제목, 양쪽 공백, ViewImage의 빈 문자열 보존을 확인합니다. 네 파일의 초기 발견은 이 첫 batch에서 해결됐습니다. 나머지 inventory의 수정·검증까지 완료했다는 뜻은 아닙니다.


## 상태 추적

위 첫 미번역 표 37개와 추가 visible title·description 표 14개, 총 51개 그룹은 frozen A/B 독립 검토 후 **fixed 51, pending 0**입니다. 표에 최종 상태를 붙였습니다. 별도로 수동 추적한 ArchiveConfirmDialog와 MessageComposer의 기본 placeholder 경로도 모두 **fixed**입니다. 이미 번역됨·보존 데이터·false positive로 분류한 원래 17개와 추가 6개는 **clear**이며 새 수정 대상이 아닙니다.

첫 fallback batch의 root-owned `manual.json` 다섯 key도 읽어 확인했습니다. `Image preview`, Archive의 두 질문과 두 설명이 실제 호출과 정확히 일치하고 한국어 의미를 보존합니다. 사용자 데이터나 제어 값의 key를 추가하지 않습니다. batch A 17개·B 19개 production 파일과 테스트가 freeze된 뒤 실제 diff와 production seam을 독립 검토했습니다. A 15/15·B 20/20 통과를 직접 확인했으며 이 inventory의 scoped 수정은 완료됐습니다. 전체 release와 사용자 직접 확인을 완료했다는 뜻은 아닙니다.
