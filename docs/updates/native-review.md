# 한국어판 네이티브 분리 독립 검토

> 이 보고서는 당시 소스의 기록입니다. 단일 URL scheme과 clipboard 변환에 관한 판단은 [공유 링크 호환성 독립 검토](link-compatibility-review.md)로 정정합니다. 현재 clipboard는 canonical `buzz://`를 유지하고 Korean 앱은 두 scheme를 받습니다. macOS 권한 리소스 추가와 최신 검사 결과는 STATUS.md에서 별도로 확인합니다.

검토일은 2026-11-09입니다. `/root/catalog_01`이 소스 읽기와 실제 검사를 수행했습니다. 프로덕션 소스는 수정하지 않았습니다. `app/AGENTS.md`, `VISION.md`, `VISION_SOVEREIGN.md`, 관련 `VISION_REMOTE_AGENTS.md`와 `TESTING.md`, 이번 배포 설계·계획을 기준으로 검토했습니다.

현재 검토 범위에 남은 차단 결함은 없습니다. 최초 검토에서 확인한 CLI 테스트 기대값 누락과 두 복사 경로 누락은 총괄이 수정했고, 수정 후 검사를 확인했습니다. 관리 저장소의 workflow·빌드·서명 구현은 이 검토에서 제외합니다.

## 최초 발견과 수정 확인

| 발견 | 실제 실패와 수정 | 현재 판단 |
| --- | --- | --- |
| 한국어 CLI 이름 테스트 누락 | `managed_agents/nest/tests.rs`의 production/dev 테스트는 demo 또는 `buzz`/`buzz-dev`만 기대했습니다. Korean compile에서는 실제 값 `buzz-korean`과 달라 2개가 실패했습니다. 알려진 누락을 독립 Cargo 실행으로 재현했습니다. 총괄은 Korean 기대값을 추가했고, 수정 후 전체 Korean lib 검사에 두 테스트가 포함되어 통과했습니다. | 해결 |
| 프로젝트 복사 경로 분리 누락 | `ProjectsSelectionCountMenu.tsx`의 일괄 복사는 `links.join("\n")`, `SidebarProjectsSection.tsx`는 `projectShareLink(project)`를 그대로 복사했습니다. 단일 공유 버튼은 `buzz-korean://`인데 이 두 경로는 `buzz://`라 외부에서 공식 앱을 열거나 한국어판만 설치한 경우 실패할 수 있었습니다. 실제 bulk `handleAction`과 원래 helper를 실행해 canonical URL 복사를 재현했습니다. 총괄은 두 clipboard 호출부에서만 `toDistributionLink`를 적용했습니다. | 해결 |

수정 후 추가된 호출부 회귀 4개를 포함한 `appLinkTransport.test.mjs` 7개가 독립 실행에서 통과했습니다. 실제 소스의 clipboard 인자 표현식과 실제 transport 함수를 실행하며, Korean·official 양쪽을 검사합니다. 기존 원본 share helper, 저장된 링크와 사용자 데이터는 바꾸지 않았습니다. 이 4개는 production 표현식 검사이며 두 전체 메뉴를 DOM에 마운트한 증거는 아닙니다.

## 현재 구현 검토

- `build_channel.rs`는 채널 값이 없거나 정확히 `korean`인 경우만 허용하고, Korean과 disposable demo marker의 동시 사용을 거부합니다. `build.rs`가 검증한 marker를 native compile에 전달합니다.
- `build_identity.rs`는 Korean의 고정 keyring, nest, CLI, URL scheme, agent config/OAuth root를 사용합니다. 공식·dev·demo 기본 동작은 각 기존 분기에 남습니다. Korean config root를 구할 수 없으면 자격 증명 작업과 child launch는 실패합니다. ambient/user env가 해당 root를 덮지 않도록 runtime과 models subprocess에서 마지막에 적용합니다.
- `app_state_keyring.rs`는 Korean을 독립 keyring 분기로 보내고 그 service에 맞는 migration marker를 사용합니다. `SecretStore`의 기존 읽기·legacy cleanup도 전달받은 service에 한정됨을 확인했습니다. 실제 macOS 키체인 접근을 시험한 것은 아닙니다.
- `migration.rs`와 boot setup은 독립 빌드의 공식/legacy/shared 데이터 가져오기를 건너뜁니다. dev nest 가져오기는 실제 `.buzz-dev` 선택에 한정되고 Korean nest는 이 조건에 들어가지 않습니다. repository 경로 fallback도 독립 빌드에서 공식 `~/.buzz/REPOS`를 탐색하지 않습니다.
- `reset.rs`는 Korean의 own app data·nest·CLI·agent config를 정리하고 공식/legacy agent root를 삭제하지 않습니다. config 삭제 실패나 root 미확정은 sentinel을 유지하여 재시도할 수 있습니다. 실제 reset helper의 컴파일된 distribution 테스트가 반대쪽 앱·nest·CLI·credentials 보존을 확인합니다. 테스트는 임시 파일과 fake keychain을 사용합니다.
- native deep-link 수신은 선택한 scheme만 받아 canonical payload를 기존 frontend navigation으로 전달합니다. 새 golden 검사는 Korean 및 demo transport를 같은 canonical entity로 해석하고 다른 scheme를 거부합니다. frontend helper는 앱 생성 share link의 OS clipboard 전달부에서만 scheme를 바꿉니다. relay 이벤트·내부 route·원본 link helper는 유지됩니다.
- `use-updater.ts`의 수동 설치 URL은 compile channel에 따라 한국어판 또는 공식판 저장소를 선택합니다. 실제 hook을 마운트한 두 variant 검사에서 올바른 `manual-required` URL을 확인했습니다. 자동 updater endpoint와 공개키를 검증하는 release config는 총괄의 별도 통합 범위입니다.

## 직접 실행한 검사

모든 Git 검사와 아래 명령에 Hermit을 활성화했습니다. 기존 다른 폴더의 과거 테스트를 이번 통과 증거로 사용하지 않았습니다. 기존 Cargo target 경로는 빌드 캐시만 재사용했고 현재 새 저장소 소스를 다시 컴파일했습니다.

### Korean native 전체 lib

`app/`에서 실행했습니다.

```sh
. ./bin/activate-hermit
BUZZ_BUILD_CHANNEL=korean \
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' \
CARGO_TARGET_DIR=/Users/stan/orca/buzz-main-kor/desktop/src-tauri/target \
cargo test --manifest-path desktop/src-tauri/Cargo.toml --lib
```

결과는 **3,440 passed, 0 failed, 19 ignored**이며 테스트 실행 시간은 36.67초입니다. 직접 실행 로그는 `/private/tmp/buzz-korean-independent-native-lib.log`입니다. CLI 기대값 수정 후의 전체 lib를 검사했습니다. 이후 변경은 frontend의 두 copy 호출부와 해당 테스트입니다.

`TAURI_CONFIG`의 빈 `externalBin`은 이 unit-test 실행에만 사용했습니다. sidecar가 포함된 배포 앱이나 정상 패키징을 검증했다는 뜻이 아닙니다. `--lib` 이외의 앱 bundle 빌드는 이 명령에서 하지 않았습니다.

### Official native 비교

같은 app cwd·manifest·target·test config에서 `env -u BUZZ_BUILD_CHANNEL -u BUZZ_BUILD_DEMO_SLUG`를 사용하여 다음 module을 독립 실행했습니다.

```text
build_identity::tests
app_state::keyring_config::tests
project_repo_paths::tests
reset::tests
deep_link::tests
managed_agents::nest::tests
```

결과는 **106 passed, 0 failed, 1 ignored**입니다. Korean 최초 동일 확대 범위에서는 **104 passed, 2 failed, 1 ignored**를 확인한 뒤 그 두 실패를 총괄에게 전달했습니다. 수정 후 위의 Korean 전체 lib 결과로 다시 검증했습니다.

### Frontend와 compile identity

현재 수정된 소스로 다음 5개 파일을 함께 실행하여 **41/41** 통과했습니다.

```sh
node --import ./test-loader.mjs --experimental-strip-types --test \
  scripts/korean-build-identity.test.mjs \
  src/shared/lib/appLinkTransport.test.mjs \
  src/features/projects/lib/projectShareLinks.test.mjs \
  src/features/messages/lib/messageLink.test.mjs \
  src/shared/deep-link.test.mjs
```

이 중 Rust driver는 실제 `build_identity.rs`와 `app_state_keyring.rs`를 debug/release로 컴파일하고 Korean 상수·OAuth root·root 없음 오류를 확인합니다. 임의로 재작성한 identity helper를 검사하지 않습니다. 원래 message/project helpers와 navigation queue 회귀도 포함됩니다.

`test-jsdom-setup.mjs`와 `test-loader.mjs`로 실제 `useUpdater`를 마운트한 `updateChannel.jsdom-test.mjs`는 **2/2** 통과했습니다. Tauri check와 지원 플랫폼 판정은 외부 의존으로 대체한 hook 검사입니다. 실제 네트워크나 native installer를 실행하지 않습니다.

전체 desktop TypeScript 검사 `node node_modules/typescript/bin/tsc --noEmit`도 통과했습니다. 최종 copy 호출부 수정 후 한 번 더 실행하여 결과를 확인했습니다.

## 변경 경로 목록

검토 종료 시 `git diff --name-only -- app/desktop`에 나타난 경로입니다. 아래 경로 앞에는 모두 `app/desktop/`가 붙습니다.

```text
src-tauri/build.rs
src-tauri/src/app_state_keyring.rs
src-tauri/src/build_identity.rs
src-tauri/src/commands/agent_model_process.rs
src-tauri/src/commands/agent_models_databricks.rs
src-tauri/src/commands/project_repo_paths.rs
src-tauri/src/deep_link_tests.rs
src-tauri/src/lib.rs
src-tauri/src/managed_agents/nest.rs
src-tauri/src/managed_agents/nest/tests.rs
src-tauri/src/managed_agents/runtime.rs
src-tauri/src/migration.rs
src-tauri/src/reset.rs
src-tauri/src/reset_demo_tests.rs
src/features/messages/ui/MessageActionBar.tsx
src/features/projects/ui/CopyShareLinkMenuItem.tsx
src/features/projects/ui/ProjectsSelectionCountMenu.tsx
src/features/projects/ui/ShareLinkButton.tsx
src/features/settings/hooks/use-updater.ts
src/features/sidebar/ui/SidebarProjectsSection.tsx
```

새 파일도 `git diff`만으로 놓치지 않도록 별도로 확인했습니다.

```text
scripts/korean-build-identity.test.mjs
src-tauri/src/build_channel.rs
src/features/settings/hooks/updateChannel.jsdom-test.mjs
src/features/settings/hooks/updateChannel.ts
src/shared/lib/appLinkTransport.test.mjs
src/shared/lib/appLinkTransport.ts
```

현재 untracked 목록에는 `src-tauri/src/desktop_locale.rs`도 있습니다. 이는 앞선 localization 작업에서 이 검토자가 작성했던 locale 모듈이므로 이번 독립 재리뷰 대상에서 제외했습니다. 새 native-channel 작업자가 구현한 파일로 세지 않았습니다.

## 판단과 남은 증거

이번 수정 범위는 최소성 9/10, 구조 9/10, 정확성 9/10입니다. 처음 확인한 현실적 결함을 모두 전달했고 수정 후 확인했습니다. 새 차단 결함은 없습니다.

실제 앱 bundle identifier와 URL scheme 등록, Korean frontend/native marker 일치, 공개키·endpoint 병합, 모든 ARM64 sidecar, 실제 양앱 병행 실행·키체인·OS 권한·최초 Gatekeeper 승인, N→N+1 `Update Now` 교체와 재실행은 별도 release 통합 증거가 필요합니다. 이번 Cargo와 jsdom 결과를 그 증거로 대신하지 않습니다. 저장소 전체 `just ci`와 사용자 직접 확인도 총괄의 최종 기록에 따로 남겨야 합니다. 이 검토는 PR ready 또는 전체 배포 완료를 인증하지 않습니다.
