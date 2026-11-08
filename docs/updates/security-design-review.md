# 한국어판 자동 업데이트 독립 설계·보안 검토

검토일: 2026-11-09, Asia/Seoul. 검토자는 `/root/catalog_01`이며 부모 모델을 상속했습니다. 별도 모델·외부 보안 심사를 주장하지 않습니다. 이번 작업은 설계 검토입니다. 앱 소스, Git 메타데이터, 원격 저장소, Actions 설정, 키와 릴리스는 변경하지 않았습니다.

## 판단

승인된 `ondallio/buzz-korean`에서 공식 안정 데스크톱 릴리스를 감지하고, 별도 체크아웃에 한국어 변경을 적용한 뒤 검증·배포하는 구조는 구현할 수 있습니다. 현재 파일 그대로의 자동 배포는 준비되지 않았습니다. 특히 독립 앱 ID만 적용하면 공식판과 키체인·작업 폴더를 공유하고, 기존 수동 다운로드 링크는 공식 영어판으로 연결됩니다. 자체 Tauri 업데이트 서명과 macOS 신뢰 서명도 서로 다른 검사입니다.

제안은 감지, 동기화 PR, 비밀 없는 검증·빌드, 제한된 서명, 공개 배포를 분리하는 것입니다. 성공한 정확한 소스와 정확한 아카이브만 다음 단계로 넘깁니다. 실패하거나 충돌하면 기존 설치와 현재 배포 manifest를 유지합니다. 원격 설정과 실제 업데이트 시험을 수행하기 전에는 완료로 계산하지 않습니다.

## 현재 근거

다음 로컬 파일을 읽었습니다. `AGENTS.md`의 리뷰 규칙, `VISION.md`, `VISION_SOVEREIGN.md`, `TESTING.md`, `RELEASING.md`, `.github/workflows/release.yml`, `promote-oss-desktop-release.yml`, `scripts/verify-release-ref.sh`, `promote-oss-desktop-release.sh`, `desktop/scripts/build-release-config.mjs`, `generate-oss-latest-json.sh`, `desktop/src-tauri/build.rs`, `src/lib.rs`, `src/build_identity.rs`, `src/secret_store.rs`, `tauri.conf.json`, `desktop/src/features/settings/hooks/use-updater.ts`, `docs/localization/PLAN.md`.

- 현재 로컬 데스크톱 버전은 `0.5.28`입니다. 이 디렉터리는 원본 Git 커밋을 검증하지 못한 상태입니다. 기존 백업은 `/private/tmp/buzz-korean-backup-20261108/baseline.tar.gz`입니다. 원본 SHA를 추정하여 현재 폴더에 연결하거나 파일을 덮어쓰면 안 됩니다.
- `RELEASING.md`의 데스크톱 태그는 `desktop-vX.Y.Z`이며, squash merge 뒤 태그가 검토한 PR head의 별도 이력을 가리킬 수 있습니다. `main` 조상이라는 조건은 안정 릴리스 검증 기준으로 적합하지 않습니다.
- 기존 `release.yml`은 여러 job을 `github.repository == 'block/buzz'`로 제한하고 Block 서명 인프라를 호출합니다. 한국어판용 workflow는 별도로 필요합니다. 이 가드만 일괄 제거해서는 안 됩니다.
- `build.rs`는 공개키·endpoint 환경변수 둘이 있으면 release plugin을 등록할 조건을 만듭니다. 실제 plugin 설정은 별도 release config가 공급합니다. 기본 `tauri.conf.json`의 endpoint는 비어 있습니다. 환경변수만 설정하고 `--config` 병합을 누락하면 작동하는 updater가 아닙니다.
- 기존 앱은 시작 시와 6시간마다 확인하고, 업데이트가 있으면 먼저 다운로드한 후 `Update Now`에서 설치·재실행합니다. 수동 링크 상수는 현재 `https://github.com/block/buzz/releases/latest`입니다.

읽기 전용 공식 API 조회에서 확인한 현재 안정 릴리스는 다음과 같습니다. 이는 초기 기준 후보이며 로컬 원본과 동일하다는 증거는 아닙니다.

| 항목 | 조회값 |
| --- | --- |
| 저장소 / 릴리스 | `block/buzz` / `desktop-v0.5.28` |
| Release ID | `408337383` |
| 게시 시각 | `2026-10-09T20:52:44Z` |
| draft / prerelease / immutable | `false` / `false` / `false` |
| 정확한 태그 target | `f87c10895ea35a9a2cea629fef1d7532a3fecbc5` |
| 태그 형식 | lightweight, `object.type == commit` |
| 커밋 서명 API 결과 | `verified: true`, `reason: valid` |

직접 읽은 공개 endpoint는 [릴리스 목록](https://api.github.com/repos/block/buzz/releases?per_page=100), [정확한 태그 ref](https://api.github.com/repos/block/buzz/git/ref/tags/desktop-v0.5.28), [커밋](https://api.github.com/repos/block/buzz/commits/f87c10895ea35a9a2cea629fef1d7532a3fecbc5)입니다. release 목록의 첫 페이지에서 안정 desktop 릴리스 21개를 확인했습니다. 운영 감지기는 페이지 수 제한과 불완전 조회 오류를 처리해야 하며, 이 1회 조회를 향후 버전의 증거로 재사용하지 않습니다.

## 구현 전 해결해야 할 구체 결함

| ID | 현실적인 실패 | 필요한 수정과 완료 증거 |
| --- | --- | --- |
| B1 | `identifier`만 바꾸면 `build_identity.rs`의 `buzz-desktop` 키체인, `~/.buzz`, `buzz` CLI와 URL scheme는 공식판과 같습니다. 병행 실행·초기화가 다른 앱의 자격 증명이나 설정에 영향을 줄 수 있습니다. | 한국어판의 영구 identity를 한곳에서 정의하고 앱 데이터, keyring, nest, CLI, OAuth/config root, deep link에 적용합니다. 두 앱의 실제 병행 실행·초기화와 키체인 분리를 시험합니다. |
| B2 | plugin 활성 조건만 설정하거나 기존 공식 endpoint를 상속하면 업데이트가 없거나 영어 앱을 받습니다. 수동 링크도 공식판을 엽니다. | 한국어판 공개키·유일 endpoint·수동 다운로드 URL을 하나의 정책으로 검사합니다. 빌드된 앱에서 공식 endpoint가 없고 한국어판 key만 허용되는지 확인합니다. |
| B3 | 같은 upstream 버전의 번역 수정에 `+ko.2` 같은 build metadata만 늘리면 SemVer 우선순위가 같아 업데이트로 인식되지 않습니다. | 독립적인 숫자 3부분 앱 버전을 사용하고 플랫폼·manifest·앱 버전을 일치시킵니다. 같은 upstream에서 한국어 수정 2회를 실제 업데이트로 검증합니다. |
| B4 | 원격 태그를 두 번 다른 시점에 resolve하거나 main만 빌드하면 검토한 릴리스와 실제 빌드가 다릅니다. 현재 upstream release는 immutable이 아닙니다. | 감지 때 tag object와 peeled commit을 고정하고 이후에도 같은 값을 확인합니다. 같은 tag가 이동하면 자동 갱신하지 않고 중단합니다. |
| B5 | upstream `.github/workflows`를 그대로 동기화하면 Docker/차트/기타 publish job이 한국어판 저장소에서 활성화되거나 새 workflow가 끼어들 수 있습니다. 기존 repository 가드는 모든 파일을 보호하지 않습니다. | 원본 workflow는 비활성 보관하고 한국어판 allowlist만 실행합니다. upstream 새 workflow를 발견해도 자동 활성화하지 않는 회귀 검사를 둡니다. |
| B6 | PR 코드·빌드 스크립트를 서명키가 있는 job에서 실행하면 `package.json` script나 Cargo build script로 키를 유출할 수 있습니다. | 빌드 job과 서명 job을 별도 runner로 나누고, 서명 job은 신뢰한 도구와 검증된 아카이브만 읽습니다. PR 실행에는 서명 secret와 publish token이 없어야 합니다. |
| B7 | 오래 걸린 이전 버전 job이 나중에 완료되어 최신 manifest를 덮으면 새 설치가 구버전을 받습니다. | 배포 전체에 단일 concurrency group과 SemVer 재검증을 둡니다. 동일 버전 재시도는 같은 소스·해시만 허용합니다. |
| B8 | 공식판의 4플랫폼 manifest 생성기·promotion guard를 그대로 쓰면 Mac ARM64 하나만 성공한 한국어판을 배포할 수 없습니다. 플랫폼 검사를 대충 제거하면 잘못된 아키텍처를 광고합니다. | 별도 한국어판 정책은 정확히 `darwin-aarch64` 하나를 허용합니다. 메인 앱·sidecar·native dylib 모두 ARM64를 포함하는지 검사합니다. |
| B9 | Tauri updater 서명이 맞더라도 ad-hoc/self-signed macOS 앱은 공증된 Developer ID 앱이 아닙니다. 최초 다운로드나 교체 뒤 Gatekeeper·권한에 막힐 수 있습니다. | 자체서명 범위와 최초 설치 안내를 명확히 하고 실제 격리 속성이 있는 다운로드와 N→N+1 교체를 시험합니다. Developer ID 공증을 수행하지 않았다면 수행했다고 표시하지 않습니다. |
| B10 | bot의 `GITHUB_TOKEN`이 만든 PR은 자동 CI가 바로 실행된다고 보장할 수 없으며, 공개 저장소의 cron은 비활성화될 수 있습니다. | 전용 App 토큰 또는 검증된 명시 dispatch로 CI를 시작합니다. cron 상태·마지막 성공을 점검하고 재개 가능한 수동 dispatch를 제공합니다. |

이 표는 아직 없는 구현의 보안 사고가 이미 발생했다는 뜻이 아닙니다. 현재 코드에 자동화만 붙이면 발생하는 기능·권한 결함이며 최초 배포의 통과 조건입니다.

## 권장 실행 구조

### 1. 안정 릴리스 감지

기본 브랜치에만 `schedule`과 `workflow_dispatch` 감지기를 둡니다. 예를 들어 하루 2회, 정각을 피한 cron을 사용합니다. 실행 시간과 페이지·재시도 수를 제한하고 API 장애는 최신 상태로 처리하지 않습니다. 한 번의 실행은 최신 후보 하나만 처리하고 같은 release ID/tag/SHA는 중복 PR을 만들지 않습니다.

공식 `block/buzz`의 releases 목록을 조회하여 `draft == false`, `prerelease == false`, `^desktop-v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`를 모두 만족하는 항목만 선택합니다. relay/mobile/rolling 태그와 정규식에만 맞는 미게시 Git 태그는 제외합니다. `/releases/latest`를 유일 기준으로 사용하지 않습니다. 릴리스 API는 Git 태그 목록과 다르며 별도 릴리스가 없는 태그는 포함하지 않습니다. [GitHub releases API](https://docs.github.com/en/rest/releases/releases?apiVersion=latest)

정확한 `git/ref/tags/<tag>`를 resolve하고 annotated tag이면 최대 깊이를 정해 `git/tags/<object-sha>`를 peel하여 최종 commit만 허용합니다. prefix matching 결과나 `target_commitish` 문자열을 최종 commit으로 취급하지 않습니다. 태그 ref는 이동할 수 있고 annotated/lightweight 형식이 다릅니다. [Git references](https://docs.github.com/en/rest/git/refs), [Git tags](https://docs.github.com/en/rest/git/tags)

원본 repository ID, release ID, tag, tag-object SHA, 최종 commit, 게시 시각, 조회 시각, manifest digest를 동기화 기록에 저장합니다. 공식 서명이 없는 향후 릴리스를 자동으로 신뢰하거나 임의 key를 신뢰 목록에 추가하지 않습니다. 현재 서명 검증은 GitHub가 보고한 결과이며 개인이 보유한 별도 신뢰키 검증과 같지 않습니다. upstream immutable release가 있으면 해당 attestation도 확인합니다. 없다면 SHA 고정과 이동 감지로 진행하되 immutable이라고 표시하지 않습니다. [Immutable release 검증](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/verify-release-integrity)

### 2. 별도 사본과 동기화 PR

현재 폴더를 재사용하지 않습니다. root가 확인한 공식 릴리스 SHA를 새 저장소/체크아웃에 가져와 원본 tree와 로컬 백업의 차이를 분류합니다. 한글화 overlay의 최초 기준과 적용 결과를 기록한 다음에만 향후 자동 동기화의 출발점으로 삼습니다. 초기 전체 폴더를 통째로 덮거나 unknown history를 공식 원본으로 서술하지 않습니다.

upstream 이력은 별도 ref로 보관하고 한국어판 기본 브랜치에는 검토한 localization·배포 변경을 유지합니다. PR에는 이전/새 upstream SHA, overlay SHA, 앱 버전, 적용 변경 파일과 검사 결과를 넣습니다. 한국어판 workflow와 secrets 정책은 upstream 내용으로 자동 덮어쓰지 않습니다. 충돌은 강제 `ours/theirs`나 파일 삭제로 통과시키지 않고 PR에 정확한 파일을 기록합니다. 자동 배포는 그 PR에 대해 중단하고 기존 배포는 유지합니다.

원본 workflow는 실행 경로 밖의 원본 보관 디렉터리에 두거나 비활성 상태를 유지합니다. 안전한 초기 방식은 새 저장소의 Actions를 먼저 비활성화한 상태에서 가져오고, 한국어판 workflow allowlist와 정책 검사가 기본 브랜치에 반영된 뒤 필요한 workflow만 활성화하는 것입니다. 기존 workflow의 remote disable만으로 끝내지 말고 매 동기화마다 새 `.github/workflows/*`가 활성 실행 경로에 추가되지 않는지도 검사합니다.

공개 fork의 scheduled workflow는 기본 비활성일 수 있고, 공개 저장소는 60일 비활동 후 cron이 꺼질 수 있습니다. 감지기의 마지막 성공 시각과 비활성 상태를 운영 기록에서 보여 줍니다. cron은 정확한 실행 시각 보장이 아닙니다. [Workflow 비활성 정책](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows), [Trigger 문제 해결](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows)

기본 토큰은 read-only입니다. PR 생성 단계만 해당 저장소의 contents/PR write 권한을 사용합니다. 보안 설정과 workflow 변경 권한은 필요 없는 자동 감지 토큰에 주지 않습니다. 최신 문서에서 `GITHUB_TOKEN`이 만든 PR의 opened/synchronize/reopened는 승인 대기 상태의 CI를 만들 수 있습니다. 무조건 실행되지 않는다는 오래된 설명도, 즉시 자동 실행된다는 가정도 잘못입니다. 무인 CI가 필요하면 짧은 수명의 전용 GitHub App 설치 토큰 또는 명시 dispatch와 정확한 SHA 검증을 사용합니다. [GITHUB_TOKEN의 실행 조건](https://docs.github.com/en/actions/concepts/security/github_token)

### 3. 비밀 없는 검증·빌드

PR 검증에는 서명키·배포키를 주지 않습니다. `pull_request_target`에서 PR head를 checkout하고 build/test를 실행하지 않습니다. upstream script와 lockfile도 실행 코드로 취급합니다. 자동 번역/코드수정 에이전트가 필요하면 비밀 없는 작업자에서 실행하고 변경을 PR에 남깁니다. 테스트 통과를 위해 missing catalog·빌드 guard를 비활성화하지 않습니다. [pull_request_target 공식 보안 지침](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)

검증 대상 SHA를 출력으로 고정하고 타입/린트/키·변수·날짜 검사, 현재 localization 회귀, 실제 앱 흐름 및 저장소가 요구하는 `just ci`를 실행합니다. 현재 로컬 `.git` 부재로 실패한 differential gate는 새 정상 checkout에서 재검증해야 합니다. upstream 변경으로 실패한 경우 실패 기록을 PR에 유지하고 배포하지 않습니다.

Mac ARM64 job은 ARM64 실행 환경인지 확인하고 target을 `aarch64-apple-darwin`으로 명시합니다. 앱·모든 sidecar·필요 dylib를 패키징하며 artifact 없는 성공을 허용하지 않습니다. `externalBin: []` 임시 우회는 배포 검증으로 인정하지 않습니다. target과 번들 내 Mach-O architecture를 검사합니다. 한국어판 전용 config는 `identifier`, `productName`, 버전, updater key/endpoint, updater artifacts만 명시적으로 소유하고 platform `externalBin` 목록을 덮어쓰지 않습니다.

### 4. 서명과 배포 권한 분리

Tauri updater private key는 한국어판 전용으로 한 번 만들고 안전한 별도 복구 사본을 보관합니다. 공개키는 소스에 공개할 수 있습니다. 공식 Buzz 키나 사용자의 Nostr/에이전트 자격 증명은 재사용하지 않습니다. 키는 저장소 파일, cache, artifact, 로그 또는 에이전트 prompt에 넣지 않습니다.

서명 job은 별도 ephemeral runner에서 실행합니다. 이미 검증된 default-branch commit 또는 보호된 한국어판 release tag만 허용하고 exact SHA/실행 ID/검증 workflow identity/artifact digest를 재확인합니다. `workflow_run`의 성공 문자열만 믿고 임의 PR artifact를 서명하지 않습니다. ZIP/TAR의 경로 이탈·symlink·중복 파일과 예상 bundle 이름도 검사합니다.

서명 job은 candidate의 npm/Cargo build scripts를 실행하지 않습니다. 신뢰한 기본 브랜치의 검토된 signer와 고정 도구만 사용합니다. environment secret은 서명 단계에만 주입하고, 게시 단계는 contents write 토큰만 받습니다. 감지·번역·PR job에는 둘 다 없습니다. Actions는 full commit SHA로 고정하고 checkout은 `persist-credentials: false`를 사용합니다. [Actions 공식 보안 지침](https://docs.github.com/en/actions/reference/security/secure-use?learn=adopting_github_actions_for_your_enterprise_ghec&learnProduct=admin)

GitHub environment로 브랜치/tag 접근과 secrets 범위를 제한합니다. 공개 저장소의 환경 기능은 공식 지원 범위에서 사용하되 실제 계정 설정을 검증해야 합니다. 이 문서는 매 버전 수동 승인 절차를 새로 요구하지 않습니다. 사용자가 승인한 자동 배포는 신뢰한 기본 브랜치·정확한 SHA·필수 검사·서명·플랫폼 조건을 모두 통과할 때만 작동하도록 구현합니다. workflow·서명 정책 자체 변경은 일반 번역 자동화와 분리하여 검토합니다. [Deployment 환경](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments), [환경 지원 범위](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

macOS code signing을 끝낸 **최종 앱**으로 `.app.tar.gz`를 만든 뒤 그 바이트를 Tauri signer로 서명합니다. 서명 후 다시 앱을 수정하거나 압축을 다시 만들지 않습니다. self-signed/ad-hoc macOS 서명은 Developer ID 공증이 아닙니다. Apple은 공증에 Developer ID와 hardened runtime 등 조건을 요구하고 self-signed/ad-hoc 인증서를 대체 수단으로 인정하지 않습니다. [Apple 공증 요구사항](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution), [서명 오류](https://developer.apple.com/documentation/security/resolving-common-notarization-issues)

처음 자체서명 버전은 사용자가 내려받아 보안 설정에서 실행을 허용해야 할 수 있습니다. 이를 자동으로 Gatekeeper 비활성화하거나 quarantine을 일괄 지우는 설치기로 해결하지 않습니다. Apple Silicon에서 최초 설치, 앱 교체, 재실행, 키체인과 마이크/접근성 권한을 실제로 시험합니다. 공증되지 않은 앱의 원활한 배포를 보장하지 않습니다. [Apple macOS 배포](https://developer.apple.com/macos/distribution), [Sequoia 보안 동작](https://developer.apple.com/news/?id=saqachfa)

### 5. 버전·앱 identity·배포 manifest

권장 예시는 한국어판 `1.0.N`이며 upstream `0.5.28`과 overlay revision은 release 기록에서 별도 표시합니다. 실제 숫자는 최초 채널 bootstrap 때 하나로 확정하고 이후 감소하지 않습니다. upstream source가 같아도 한국어 수정이 있으면 `N`을 올립니다. app/package/Cargo/Tauri/manifest 버전을 모두 일치시키고 SemVer 비교 라이브러리로 검증합니다. `+ko.N`만 바꾸거나 문자열 사전순 정렬을 사용하지 않습니다.

영구 예시 identity는 `io.github.ondallio.buzz-korean`, 표시명 `Buzz Korean`, keyring `buzz-korean-desktop`, nest `~/.buzz-korean`, CLI `buzz-korean`, scheme `buzz-korean`입니다. 실제 플랫폼이 허용하는 identifier 문자와 keychain 사용을 검증한 뒤 확정합니다. 앱 ID는 버전별로 바꾸지 않습니다. 기존 demo slug는 임시 데모와 reset 정책을 포함하므로 production 배포 identity 대신 재사용하지 않습니다. 기존 공식 프로필·자격 증명은 무단 자동 복사하지 않습니다. 가져오기 기능이 필요하면 별도 범위로 검토합니다.

독립 scheme를 선택하면 기존 `buzz://` 외부 링크를 한국어판으로 바로 여는 동작은 별도 설계가 필요합니다. 독립성을 보장한다고 하면서 공식 scheme를 동시에 등록하면 OS 기본 앱 경쟁이 생깁니다. 한국어판 내부 링크 생성·수신·중복 인스턴스 전달을 함께 점검합니다. 사용자 콘텐츠의 기존 링크를 일괄 치환하지 않습니다.

버전별 release tag는 `korean-v1.0.N`처럼 공식 `desktop-v*`와 분리합니다. 완료된 DMG, `.app.tar.gz`, `.sig`, checksum, source/검사 기록을 draft release에 먼저 모두 올린 뒤 공개합니다. public release의 기존 artifact를 다른 바이트로 `--clobber`하지 않습니다. 가능하면 immutable release를 사용합니다. 이 경우 mutable rolling asset을 immutable release에 붙여 교체할 수 없으므로 feed 전략을 함께 정해야 합니다. [Immutable release 정책](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)

단순한 초기 feed 후보는 `https://github.com/ondallio/buzz-korean/releases/latest/download/latest.json`입니다. 해당 저장소는 한국어판 release만 latest로 지정하고 다른 lane은 명시적으로 latest=false로 둡니다. 각 버전의 `latest.json`은 그 버전의 immutable asset이며 release를 최신으로 지정하기 전에 모든 URL과 서명을 확인합니다. 이 방법은 rolling asset의 delete/reupload 공백을 피하지만, GitHub의 latest 포인터 변경 자체는 신뢰 경계에 남습니다. 별도 Pages/rolling feed를 쓰려면 그 갱신·원자성·재시도 정책을 추가 검토합니다.

manifest에는 정확히 `darwin-aarch64`만 넣고 한국어판 versioned HTTPS asset URL과 `.sig` **내용**을 사용합니다. 메타데이터에 canonical source SHA와 archive SHA-256을 추가 기록하되 앱이 기본 updater 검증 이상을 수행한다고 주장하지 않습니다. Tauri의 서명 검증은 끌 수 없고, signature 값은 URL이 아닙니다. 현재 SemVer보다 높은 업데이트만 제공하고 한국어판 고유 공개키를 pin합니다. 공식 영어판 artifact는 그 키로 검증되지 않아야 합니다. [Tauri updater 형식·서명](https://v2.tauri.app/plugin/updater/)

모든 publish에 공통 concurrency group 하나와 `cancel-in-progress: false`를 적용합니다. 완료 순서가 버전 순서라는 가정을 버리고 최종 publish 직전에 현재 채널 버전을 다시 읽어 downgrade를 거부합니다. 동일 버전의 재시도는 동일 source와 동일 artifact digest일 때만 허용합니다. 병렬 외부 게시자가 있으면 concurrency만으로 보호되지 않으므로 release publish 권한도 제한합니다. 설치된 문제 버전을 되돌릴 때도 더 높은 한국어판 버전에 이전에 안전한 소스를 담습니다.

기본 Tauri 업데이트 서명은 archive의 신뢰를 확인하는 것이며 JSON의 모든 메타데이터를 독립적으로 서명하는 구조와 같지 않습니다. HTTPS·고정 저장소·채널 게시 권한이 추가 신뢰 경계입니다. 키 탈취 시 자동 키 교체가 안전하다고 가정하지 말고 배포 중지, 공지, 신뢰 가능한 재설치 경로를 준비합니다.

## 구현 수락 검사

아직 다음 검사를 실행하지 않았습니다. 구현자가 실제 production seam에 연결한 테스트와 실행 기록을 남겨야 합니다.

1. stable desktop만 선택하고 draft/prerelease/relay/mobile/rolling/malformed tag, 잘못된 repo, 불완전 pagination을 거부합니다. lightweight/annotated 양쪽을 확인하고 이동한 태그·SHA 불일치·반복 tag를 차단합니다.
2. sync 충돌 시 기존 main·배포·원본 폴더를 보존합니다. 새 upstream workflow와 악성 입력을 넣어도 signing secret 또는 임의 Actions가 실행되지 않습니다.
3. 서명 job이 PR SHA, 다른 workflow/run의 artifact, 불일치 digest, zip/tar 경로 이탈과 잘못된 아키텍처를 거부합니다. 키 누락·틀린 서명·다운로드 손상은 실패 상태를 보이고 재시도할 수 있어야 합니다.
4. manifest는 ARM64 하나만 광고하고, 공식 key·official URL·빠진 asset·낮거나 같은 변경 버전·이전 늦은 job을 거부합니다. 동시 게시·업로드 중단 후 재시도가 현재 유효 채널을 복구하는지 확인합니다.
5. 격리된 Mac에서 N 버전을 최초 설치하고 N+1을 게시한 뒤 실제 `Update Now`로 교체·재실행합니다. 새 버전, 한국어와 영어 선택, 저장된 언어, 사용자 데이터, sidecar 실행 및 재시도 오류 표시를 확인합니다. mock updater의 성공은 실제 native 교체 증거를 대신하지 않습니다.
6. 공식 앱과 한국어 앱을 함께 설치하여 실행, 키체인, 앱 데이터, nest, CLI와 링크가 구분되는지 확인합니다. 한국어판 초기화가 공식판 프로필·agent secret을 삭제하지 않아야 합니다.
7. 새 Git checkout에서 `just ci`와 한국어판 패키징 검사를 완료합니다. 이전 localization 검사 통과는 새 release-config·업데이트 코드 검증을 대신하지 않습니다. `AGENTS.md`에 따른 사용자 직접 확인은 에이전트가 대신 완료 처리하지 않습니다.

## 검토 종료 상태

설계의 최소성·구조는 9/10 기준에 도달할 수 있지만 현재 구현 완료 점수를 부여하지 않습니다. B1–B10은 위협과 실패 조건을 명시한 구현 수락 조건입니다. 특히 B1, B2, B4, B6, B7과 실제 N→N+1 native 설치 증거가 없으면 첫 자동 배포의 안전성을 확인할 수 없습니다. remote branch protection, workflow allowlist/활성 상태, signing secret 존재·복구 사본, App 권한, macOS code signing과 실제 설치는 이번 읽기 전용 검토에서 확인하지 않았습니다.

제품 방향과의 긴장은 크지 않습니다. 원본·사용자 데이터·접근 권한을 보존하고 사람이 선택한 한국어판이 공식판으로 무단 전환되지 않는 설계가 `VISION_SOVEREIGN.md`의 사용자 통제 방향과 맞습니다. 공개 한국어판은 Block 공식 서명 배포물로 표시하지 않아야 합니다.
