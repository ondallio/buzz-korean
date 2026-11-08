# 데스크톱 한글화 최종 범위 감사

기준 시각: 2026-11-08 14:33:55 UTC checker 생성본과 이후 Invite 회귀검사. 이 문서는 범위와 남은 검증을 설명하는 기록입니다. 전체 한글화 완료나 사용자 확인 완료를 선언하지 않습니다. 감사 도중에도 총괄 에이전트의 마지막 수정과 검사가 진행 중입니다.

## 숫자의 의미

`coverage-current.json`의 2026-11-08 14:33:55 UTC 생성본은 생산 코드 모듈 1,752개, 카탈로그 키 4,903개, 정적 번역 호출 지점 5,930개, 동적 메시지 지점 76개를 보고했습니다. 카탈로그 변수 오류, 정적 키 누락, raw JSX는 각각 0개였고 미처리 속성도 0개였습니다. 이 수치는 인식된 문법에 대한 검사 결과이며 화면 방문 수나 번역 완료율이 아닙니다. 파일은 총괄 에이전트가 다시 생성할 수 있으므로 최신 결과와 생성 시각을 함께 확인해야 합니다.

최초 `inventory.json`, 템플릿·rich·배치 목록, fragment 기록과 현재 검사 숫자를 합산하지 않습니다. 동일한 문구가 여러 단계에서 다시 기록되었고, 후속 수동 수정으로 원래 위치와 표현이 바뀌었습니다. 카탈로그에 영어 대체 표시가 있다는 이유로 한국어 완료로 세지 않습니다. 브랜드·명령·코드·사용자 데이터의 명시적 보존도 번역 완료와 구분합니다.

현재 checker의 정적 키·변수 검사에 더해 다음을 확인했습니다.

- `DISPLAY_ATTRIBUTES` 밖의 사용자 표시 custom prop과 실제 소비 컴포넌트.
- 직접 문자열 외에 템플릿으로 만든 접근성 이름, 상태 setter의 고정 안내, 객체형 표시 문구와 helper 반환값.
- `dynamicSites`의 상수 사전, 상태·동작 분류, 날짜·숫자·알림 포맷터, 워크플로 전체 문장 생성기.
- 이미 생성된 화면·편집기 노드·보관된 상태에 언어 변경이 반영되는지에 대한 해당 회귀테스트와 소스 구조.

전체 영문 문자열을 기계적으로 번역하지 않았습니다. 소스에 존재하지만 화면에 보이지 않는 파서 입력, 규약 값, 모델 지시문과 코드 예제는 별도 분류가 필요합니다.

## 화면군별 상태

아래의 '구현·감사'는 해당 화면군에 번역 호출이 있고 소스 목록과 표시 경계를 점검했다는 뜻입니다. 모든 분기를 실제 앱에서 실행했다는 뜻은 아닙니다. 이 기록 작성자는 공통 런타임, 워크플로 및 일부 후속 수정의 구현자이기도 하므로, 그 영역의 독립 코드 리뷰는 다른 담당자의 리뷰 기록으로 판단해야 합니다.

| 화면군과 경로 | 번역 구현·소스 감사 | 실행 증거의 범위 | 남은 실행 검증 |
| --- | --- | --- | --- |
| 시작·연결·온보딩·키·커뮤니티. `app`, `onboarding`, `communities` | OS 기본 언어, 선택 언어, 연결·권한·키 안내와 접근성 이름을 점검했습니다. 복구 페어링은 총괄의 수정 경로입니다. | locale store·언어 설정·페어링 생명주기 회귀테스트. 이전 mock Playwright 기록은 참고 자료입니다. | 실제 새 설치·재실행·가입·키 가져오기·복구 흐름의 최신 앱 검증. 정책 오류의 실제 상태 전환 회귀검사는 아래 수정 확인 기록에 있습니다. |
| 사이드바·홈·피드·알림함. `sidebar`, `home`, `pulse` | 탐색, 빈 화면, 초대·연결·업데이트 카드와 custom aria prop을 점검했습니다. | 실제 sidebar 카드 소비 컴포넌트의 양언어 속성 회귀테스트. 과거 mock 탐색 기록. | 최신 앱에서 전체 탐색, 새 알림, 업데이트 상태, 좁은 폭·확대 확인. |
| 채널·포럼·구성원. `channels`, `forum`, `community-members`, `channel-templates` | 생성·탐색·관리·멤버·캔버스·권한 안내, 구성원 수와 액션 이름을 점검했습니다. API 역할·채널 ID는 보존합니다. | 채널 관리 행의 기존 테스트, source-bound 수·도움말 검사, 이전 mock 채널 메뉴 기록. | 실제 채널 생성·가입·캔버스·멤버 작업·포럼 분기. 뒤로가기 이름의 마지막 누락은 수정되었으며 실제 화면 실행은 별도입니다. |
| 메시지·스레드·DM·초안·리마인더. `messages`, `reminders` | 전송·오류·편집·업로드·미리보기·멘션·수신자·메뉴·링크 접근성을 점검했습니다. | 실제 업로드 pill, 수신자 행, Tiptap 링크 노드의 양언어 회귀테스트. 기존 composer/paste 테스트. 이전 mock 전송 기록. | 현재 앱의 실제 전송·검색 결과 이동·첨부·스레드·DM·초안 복구. 네이티브 한글 IME는 미검증입니다. |
| 검색. `search` | 검색 입력, 결과, 빈 화면과 순환 placeholder의 원본 ID·번역 표시 분리를 점검했습니다. | 실제 SearchPromptPlaceholder의 한국어 표시와 측정용 문자열 테스트. | 최신 앱에서 검색 실행, 결과 이동, 필터·키보드 탐색. |
| 설정·프로필·상태·아바타·이모지·GIF. `settings`, `profile`, `user-status`, `custom-emoji`, `gifs` | 언어 선택, 저장 오류, 프로필 필드 ID, 상태 duration 값, 달력 caller override, picker 사전을 점검했습니다. | 실제 언어 설정·프로필 분류·달력·상태·자격증명 필드·effort select 회귀테스트. 설치된 실제 emoji-mart의 동일 인스턴스 언어 전환 probe. | 모든 설정 저장·재실행, 실제 아바타 편집기·커뮤니티 사용자 지정 이모지, 접근성 읽기와 확대 화면. 별도 직접 Picker는 총괄의 후속 수정·검증 대상입니다. |
| 에이전트·카탈로그·팀·모델·메모리. `agents`, `agent-memory` | 라이브러리 객체 문구, 생성·가져오기 결과, 런타임·제공업체·자격증명·상속·effort 안내, 메모리 tooltip의 lazy 번역을 점검했습니다. | 실제 TeamDialog, 가져오기 결과, 모델 필드, 환경 변수 행과 retained status 테스트. 원본 이름·ID·키 값 보존 검사. | 실제 생성·실행·중지·공유·팀 가져오기와 실패 복구. 이미 저장된 안내 문자열의 live 전환은 별도 확인이 필요합니다. |
| 에이전트 활동·도구·프롬프트. `agents`의 transcript/presentation, `channels` 활동 패널 | canonical 파서·분류·캐시와 표시 문자열을 분리하는 R1~R3 수정이 별도 담당자의 구현·리뷰 대상입니다. | 프로덕션 parser/observer cache 및 실제 활동 renderer 회귀테스트 파일이 있습니다. | 해당 담당자의 최신 독립 재리뷰와 실제 에이전트 세션. 이 감사는 그 수정의 최종 통과 판정을 대신하지 않습니다. |
| 프로젝트·저장소·작업·리뷰·터미널. `projects`, `terminal` | 프로젝트 설명, 엔터티 링크, 기여 통계, 작업·리뷰·파일·터미널 접근성 표시 경계를 점검했습니다. 이름·hash·URL·명령은 보존합니다. | 실제 엔터티 칩·기여자 패널·Tiptap 편집기 테스트와 source-bound 터미널 이름 검사. | 실제 프로젝트 생성·저장소·커밋·작업·리뷰·터미널 상호작용. 동적 metadata·원격 실패 분기. |
| 워크플로. `workflows` | 현재 생산 파일 49개를 정적 점검했습니다. DSL/영문 canonical 문법과 전체 번역 문장, 상태 배지, UTC 일정, 오류·날짜를 구분했습니다. | 워크플로 전체 unit 126개 및 mounted 5개 실행 기록. 실제 cron 입력의 노드·포커스·선택·값과 잘못된 붙여넣기 오류 전환 검사. | relay에 저장·실행하는 실제 워크플로, 승인·실행 이력·메시지 선택, 좁은 화면. 독립 재리뷰의 최신 상태. |
| 허들·음성 모델. `huddle` | 컨트롤·참여자·설정·모델 상태·앱 소유 실패 안내를 점검했습니다. 총괄이 마지막 헤더·경고를 수정했습니다. | 정적 source/카탈로그와 개별 helper 검사 범위. | 실제 음성 허들·다운로드·에이전트 참가·오류·네이티브 장치 분기. |
| 공유 컴퓨트. `mesh-compute` | 제공업체 ID·모델 데이터와 제공 상태·사용량 표시를 구분했습니다. | servingUsage와 모델 발견 오류의 생산 helper 테스트. | 실제 공유 장치·모델·원격 연결·실패 복구. |
| 관리·중재·호스팅. `admin-console`, `moderation`, hosted community 설정 | 관리 역할·상태·확인·삭제·차단·timeout 표시를 점검했습니다. action ID, tenant, 대상 ID, 사유는 데이터입니다. | 양언어 실제 admin 컴포넌트 작업 테스트와 기존 read-model/권한 테스트. | 실제 운영자 환경의 모든 분기와 relay 응답, 권한 변화·첨부·호스팅 작업. |
| 보관·접근 가능한 실험 기능. `local-archive`, `identity-archive`, `protectedFeatures/bestie` | 추출된 앱 소유 문구와 보호 기능 로딩·실험 화면을 범위에 포함했습니다. 제품명·보관 데이터는 보존합니다. | 주로 정적 추출·카탈로그 검사와 기존 기능 테스트 범위입니다. | 실제 게이트가 열린 빌드·계정에서 접근하는 화면과 import/export 실행. |
| 네이티브 메뉴·트레이·허들 창·알림. `src-tauri`, notification 포맷터 | Rust locale projection과 앱 소유 알림 문구 구현을 점검했습니다. | Rust 단위 테스트·컴파일과 IPC retry 단위 테스트는 실제 OS 메뉴·알림 전달의 증거가 아닙니다. | 실제 네이티브 메뉴·트레이·별도 창의 언어 변경, 시스템 알림 전달·접근성, OS별 동작. |
| 공통 UI·미디어·Markdown. `shared/ui`, `shared/layout` | 접근성 이름, 날짜·수·달력·carousel·링크·확인 UI를 포함했습니다. | 실제 Calendar·carousel·링크·formatter 회귀테스트. | 전체 화면에서의 실제 popup/tooltip/reader, 미디어·좁은 화면·확대와 clip. |

## 동적 메시지의 분류

현재 목록 76개를 하나의 완료 숫자로 바꾸지 않습니다. 다음 그룹으로 표시 원천과 보존 대상을 구분했습니다.

| 원천 | 실제 경로의 예 | 판단·남은 확인 |
| --- | --- | --- |
| 유한한 앱 소유 상수·사전 | 메모리 tooltip, unavailable key/unknown channel, 다른 장치 설정 marker, 패널 닫기, admin action/role, community connection labels | 원본 상수는 유지하고 표시 시 번역합니다. 각 상수의 카탈로그·소비 지점을 확인하며, 새로운 상수가 추가되면 다시 점검해야 합니다. |
| canonical 분류에서 선택되는 표시 | managed agent pair action/availability, agentSessionPresentation, 프로젝트 상태 | 분류·액션 ID를 번역하지 않습니다. 알려진 표시 문구만 번역하며 provider/user 데이터는 유지합니다. 프로덕션 분류·캐시 테스트와 별도 독립 리뷰가 필요합니다. |
| 날짜·수·알림 포맷터 | `datetime`, message dateFormatters, projectsViewHelpers, notificationFormat | 언어는 선택값, 시간대는 기존 사용자 환경을 유지합니다. AM/PM 보정은 실제 영문 dayPeriod일 때만 적용합니다. 실제 알림 전달은 아직 별도입니다. |
| 편집기·폼의 유한 vocabulary | 워크플로 title/action/weekday/전체 문장, 검색 순환 단어, 상태 preset/duration | wire 값·cron·DSL·애니메이션 ID·만료 시각과 표시를 구분합니다. 같은 입력 노드와 값의 유지 회귀테스트가 있습니다. |
| 서버·라이브러리·숫자 데이터가 섞이는 경계 | membershipError.message, saveError, 허들 모델 상태의 숫자 `%`, 외부 diagnostic | 알 수 없는 원문은 한국어 완료로 계산하지 않습니다. 알려진 앱 소유 메시지와 임의의 서버 문구·사용자 데이터는 각각 분류해야 합니다. `%` 같은 원시 수치 자체는 번역 누락이 아닙니다. |

브랜드, 저장소·채널·파일·사람 이름, 메시지 본문, API 키 이름, event kind, enum/wire 값, URL, shell 명령, cron/DSL, JSON 예제, 외부 진단의 원문은 의도적으로 유지합니다. 이것은 영어 fallback에 대한 일괄 면제가 아닙니다. 주변 앱 소유 설명과 버튼·접근성 동사는 한국어 대상입니다.

## 수정 확인과 남은 검증

1. 보관된 오류를 현재 언어로 다시 표시하도록 총괄이 `feedbackMessage`와 `useLocalizedFeedback`를 구현했습니다. 실제 초대 폼에서는 별도의 reset 회귀도 발견했습니다. 번역과 무관한 `parseInviteInput` 결과가 locale-aware memo에서 재생성되어 policy discovery를 다시 실행하고 250ms 뒤 오류와 동의를 지웠습니다. 해당 두 memo를 일반 React.useMemo로 복원한 뒤 `InviteRedeemForm.localization.jsdom-test.mjs`의 연령/약관 2개 사례가 통과합니다. 실제 폼 submit으로 만든 오류가 한국어 전환 직후와 300ms 뒤 모두 유지되고, 동일 입력·값·동의 checkbox 상태·요청 수와 redeem 미실행을 확인합니다. 로더에서 해당 memo 두 개만 이전 locale-aware 동작으로 되돌린 이전 동작 대조 실행은 2개 모두 실패했습니다. 생산 파일은 대조 실행에서 수정하지 않았습니다. 증거는 `/private/tmp/invite-feedback-live.log`와 `/private/tmp/invite-feedback-mutation-red.log`입니다.
2. 실제 초대 폼에서 남아 있던 Next/Accept and join/Join community/Accept and redeem invite/Redeem invite 표시도 번역했습니다. 마지막 `ChannelManagementSheet` 뒤로가기 이름은 현재 localize 호출이며 최신 checker의 미처리 속성 목록은 비어 있습니다. 이 두 항목은 미해결 목록에서 제외합니다.
3. 다른 순수 데이터 memo가 locale 때문에 effect를 재시작하는지에 대한 전체 AST 감사는 별도 담당자가 진행 중입니다. 초대 폼의 통과를 모든 폼·페어링·네트워크 생명주기의 증거로 확대하지 않습니다. 다른 retained feedback 변경의 독립 리뷰와 생산 상태 경로 검사도 총괄이 통합해야 합니다.
4. custom prop와 setter sweep의 후속 변경은 앞선 통과 기록으로 대신 검증하지 않습니다. 정적 키 0개 결과만으로 모든 helper·callback 출력이 한국어라고 단정하지 않습니다. 알려지지 않은 서버 오류와 외부 진단은 원문 데이터로 보존하며 한국어 번역 완료에 포함하지 않습니다.
5. 일반 EmojiPicker와 별도로 직접 `@emoji-mart/react`를 쓰던 `AgentCreationPreview`와 `ProfileAvatarEditor` 경로를 발견해 전달했습니다. 현재 소스에는 공통 language props가 추가되어 있습니다. 실제 아바타 편집기의 검색·카테고리·선택·locale 전환은 현재 앱 실행 증거가 필요합니다.
6. 최신 독립 재리뷰, 현재 변경 전체의 빌드·필수 검사·`just ci`, 최신 mock/relay/browser 여정은 총괄이 확정해야 합니다. 네이티브 IME, 화면 잘림, 실제 OS 메뉴·알림 및 사용자 직접 확인은 여전히 아래 미검증 목록에 남습니다.

## 이 감사 중 완료한 수정의 증거

후속 할당으로 custom prop·접근성 누락 14개 생산 파일을 수정한 뒤 소유권을 반환했습니다. 새 `final-props.json`은 전체 문장과 semantic label 42개를 포함합니다. 모델·effort 값, 사용자 caption, 이름·status text, 채널 ID와 canvas preview는 보존합니다.

현재 실행한 `finalProps.test.mjs`와 `finalAria.test.mjs`는 합계 7/7, `finalProps.jsdom-test.mjs`는 5/5 통과했습니다. 실제 effort select의 노드·포커스·API value·사용자 caption, upload cancel 버튼, 수신자 행의 동일 노드와 원본 사용자 객체 전달을 확인했습니다. overlay/updater의 완전한 프로덕션 함수는 실제 pill/sidebar 소비 컴포넌트에 연결하여 검사했습니다. 별도의 네트워크·업데이트 설치는 실행하지 않았습니다. 변경 소스·테스트 17개 Biome 검사와 전체 desktop 타입 검사는 통과했습니다.

로그: `/private/tmp/final-props-unit.log`, `/private/tmp/final-props-dom.log`, `/private/tmp/final-props-tsc.log`. 앞선 워크플로·slot 수정 증거는 `/private/tmp/workflows-all-tests.log`, `/private/tmp/slot-review-final-dom.log`와 관련 테스트 파일에 있습니다. 추가 Invite 생산 파일·회귀테스트 2개는 별도 scoped Biome 검사를 통과했습니다. 최신 Invite 타입 검사 로그는 `/private/tmp/invite-feedback-tsc.log`입니다. 이후 다시 바뀐 코드에는 새로운 검증이 필요합니다.

## 앱 실행과 사용자 확인

`ko-round-1`과 `ko-round-1-fixed-test`의 Playwright 기록은 mock bridge에서 언어 전환·저장·한국어 메시지·메뉴 등을 실행한 과거 증거입니다. 이후 수정된 현재 앱 전체의 최종 검증으로 사용하지 않습니다.

네이티브 한글 IME 조합 중 Enter 비전송, 조합 완료 후 Enter 전송, Shift+Enter 줄바꿈은 아직 실제 네이티브 앱에서 최종 확인되지 않았습니다. mock 키 이벤트와 jsdom은 네이티브 IME의 대체 증거가 아닙니다. 현재 좁은 화면·확대에서의 문구 잘림, 실제 네이티브 메뉴·트레이·알림, 모든 서버 의존·관리·실험 화면도 실행한 범위를 넘어 완료 처리하지 않습니다.

사용자의 직접 테스트는 대기 상태입니다. 에이전트의 소스 수정·검사·리뷰 결과와 사용자 확인을 구분합니다. PR을 만들더라도 사용자 확인과 별도 지시 없이 준비 완료·병합·배포로 바꾸지 않습니다.

## 총괄 최종 검증 반영

최종 소스 검사는1756개 생산 모듈,4930개 카탈로그 키,5938개 정적 지점,82개 동적 지점으로 재생성되었습니다. catalog/missing/value/rawJSX/unwrapped attributes/unwrapped feedback 검출 오류는0입니다. 숫자는 인식한 문법의 결과이며 전체 화면 완료율이 아닙니다. 공개 빌드와 내부 빌드 사전을 분리했고 양쪽 실제 production matrix가 기존 보호 검사를 통과했습니다.

이후 current ko-final 빌드의 doctor를 통과한 뒤 한국어7/영어4개 브라우저 테스트가 통과했습니다. 실제 검색/DM문맥,설정15개섹션,언어전환·저장·재실행,한국어 메시지,채널메뉴,에이전트 폼과 실제이모지ShadowRoot,프로젝트활동과상태,워크플로제목·원본채널명을 확인했습니다. runtime missing getter가 제공된5개문맥과28개캡처의 관측 누락은0입니다. root도 최종 설정·프로젝트·워크플로·이모지PNG를 직접 확인했습니다.800px 좁은 화면과150% CSS배율에서 확정 가로 잘림을 찾지 못했으며 네이티브 확대 증거는 아닙니다. 과거 dry/ko-round-1 결과를 최종 증거로 대체하지 않았습니다.

메모/효과 확대 감사와 실제 상위 caller 회귀로 저장소추가·작업/리뷰저장소선택·모델키보드선택·전송owner의 언어변경 초기화를 수정했습니다. 누락 단축키 그룹 제목과 실제화면의검색문맥·프로젝트활동동사·상태·워크플로 제목도 보완했습니다. 최신 자동검사 결과와 남은 CI/Git·네이티브/IME·인간 확인은 [검사 영수증](verification/results.json) 및 [전달 안내](README.md)를 기준으로 보세요. 앞부분의 당시 snapshot·작업중 상태는 시간순 감사 기록입니다.
