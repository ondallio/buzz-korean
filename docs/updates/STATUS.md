# 한글판 자동 업데이트 작업 기록

대상은 공개 저장소 `ondallio/buzz-korean`, Apple Silicon macOS 데스크톱입니다. 원본 `/Users/stan/orca/buzz-main-kor` 앱과 실행 파일은 보존했습니다. 새 작업 폴더는 `/Users/stan/orca/buzz-korean`, 앱 소스는 `app/`입니다.

## 확보한 내용

- 원본 기준 소스 `block/buzz@ff6ab96e42b1fc64bfc1236104478a84e11b5abd`를 Git blob으로 대조했습니다. 최신 공식 정식판 `desktop-v0.5.28`은 그보다 오래되어 자동으로 덮어쓰지 않습니다.
- 공식 원본과 한글 변경을 구분하여 Git에 가져왔습니다. 이전 changed-files.json에서 빠진 desktop_locale.rs와 verify-desktop 소스는 별도 보완 커밋 `a1cc706`로 복구했습니다. 비공개 실행 로그, .env, 사용자 데이터, 기존 개인 키, 빌드 캐시는 공개 소스에서 제외했습니다.
- 전용 영구 identity, keyring, nest, CLI, 외부 링크와 수동 다운로드 주소를 구현했습니다. 독립 리뷰에서 CLI 테스트와 두 링크 복사 메뉴 누락을 찾아 수정했습니다.
- 새 전용 updater 키를 저장소 밖 `~/.config/buzz-korean-signing/`에 보관하고 공개키만 channel.json에 넣었습니다. 개인키는 승인된 저장소의 KOREAN_UPDATER_PRIVATE_KEY Secret으로 등록했습니다. 이 복구 파일은 삭제하거나 공개하지 마세요.
- 관리 root의 GitHub Actions만 실행합니다. app/.github의 공식 workflow는 실행하지 않습니다. 빌드 작업에는 서명 키가 없고, 서명 작업은 원래 관리 코드만 실행합니다.
- 안정 버전 선택, 명시적 이전 소스 기준 3-way 병합, 충돌 시 원본 보존, 이동한 태그 거부, 버전·서명·파일 해시·중단 후 재시도 검사를 구현했습니다. 공식 release가 별도 이력을 쓸 수 있으므로 이전 release의 Git 조상을 요구하지 않습니다. 공식 출처·검증된 commit·새 버전·초기 기준보다 새로운 commit/release 날짜를 확인합니다.

## 현재 검증

- 독립 네이티브 테스트: Korean 전체 lib 3440 통과, 19 ignored. 공식 variant 확대 검사 106 통과, 1 ignored. --lib만 사용해 실행 중인 원본 바이너리를 덮어쓰지 않았습니다.
- 프런트엔드 독립 검사: 41개 및 mounted updater 2개 통과, 전체 TypeScript 통과. 후속 한/영 브라우저 및 채널 링크 검사 진행 중입니다.
- 관리 도구 현재 회귀 검사는 계속 추가 중입니다. 실제 임시 Git 저장소와 실제 publisher 코드를 fake GitHub에 연결해 충돌·잘못된 키·서명 재사용·중간 상위 버전 게시를 검사합니다. 이를 실제 GitHub 배포나 native 설치 증거로 세지 않습니다.
- 전용 실제 Tauri CLI 서명과 공개키 검증은 합성 파일에서 통과했습니다. 실제 앱 서명 검증으로 세지 않습니다.
- 현재 코드의 한/영 전환·OS 기본값·저장·메시지·검색·메뉴·좁은 화면 브라우저 검사는 4/4 통과했고 독립 재실행도 4/4 통과했습니다. 화면 전환 직후 애니메이션 대기를 추가해 재현된 메뉴 조작 실패를 해결했습니다.
- 기존 verify-desktop 도구를 새 checkout에서 직접 실행했습니다. 4327 전용 포트의 신선한 mock-bridge build가 doctor를 통과했고 sidebar-navigation, channel-context-menu, send-message, settings, localization, localization-surfaces를 재검증했습니다. 화면별 스크린샷·ARIA·상태 증거는 `app/desktop/test-results/verify-desktop/korean-channel-current/`에 있으며 공개 소스에 올리지 않습니다.
- `just ci`는 새 소스에서 종료 코드 0으로 전체 통과했습니다. 로컬 의존성은 보존한 동일 lockfile의 캐시를 사용합니다. pnpm 11의 자동 재설치는 `pnpm_config_verify_deps_before_run=false`로 방지하고, CI에서는 frozen-lockfile로 새로 설치합니다. 변경 전 기준은 a1cc706입니다. 로그 `/private/tmp/buzz-korean-current-ci.log`.

## 남은 작업

실제 GitHub 워크플로 실행, 첫 DMG와 archive 생성, 서명 단계의 앱 내부 검사, release feed 점검, 설치와 N→N+1 업데이트를 수행해야 합니다. 현재 설치 파일 배포 완료로 표시하지 않습니다. Apple Developer ID가 없어 초기 macOS 서명은 ad-hoc이며 Apple 공증은 미완료입니다. OS Gatekeeper를 끄거나 quarantine을 제거하는 스크립트를 제공하지 않습니다.

사용자 직접 확인은 대기 중입니다. 에이전트 검사로 대신 완료하지 않습니다. 실제 한글 IME, OS 키체인 병행 실행, 권한과 업데이트 후 재실행 증거는 별도 기록합니다.

## 로컬 검사 중 복구한 사항

`just ci`의 `cargo test --workspace`가 integration-test 의존성으로 정상 실행 파일도 생성한다는 점을 놓쳤습니다. 공유 native target 캐시를 사용한 결과 원본 `target/debug/buzz-desktop` 경로가 검사 빌드로 바뀌었습니다. 기존 앱 프로세스는 계속 실행 중이었고, 그 프로세스의 Mach-O UUID와 일치하는 기존 `deps` 빌드를 찾아 원래 경로에 원자적으로 복구했습니다. 복구 파일과 보존 빌드의 SHA-256 일치를 확인했습니다. 새 검사 바이너리를 실행해 사용자 데이터를 변경하지 않았습니다. 복구 영수증과 두 파일은 새 저장소의 비공개 `.local/original-binary-recovery/`에 보관합니다. 검사 종료 후 공유 target symlink를 제거하여 다음 작업이 같은 경로를 다시 쓰지 않게 했습니다. 배포 빌드는 격리된 GitHub runner에서만 실행합니다.

## 재개

```sh
cd /Users/stan/orca/buzz-korean
. ./app/bin/activate-hermit
node --test tests/*.test.mjs
app/bin/actionlint .github/workflows/korean-release.yml
gh run list --repo ondallio/buzz-korean --workflow korean-release.yml
```

개인키를 출력하지 마세요. 기존 버전 asset을 --clobber로 교체하지 마세요. 실패한 draft는 재시도 기록이며 동일 원본/관리 코드에서 최대 세 번 새 빌드를 시도합니다. 업로드 중단은 해당 실행의 실패한 job 재실행으로 같은 바이트를 재사용합니다. root 공통 스크립트는 총괄이 작성하고, 변경 파일별 작업자는 독립 검토서에 기록합니다.

현재 전체 관리 검사 172/172, actionlint, git diff --check 통과를 `verification.json`에 기록했습니다. 실제 GitHub workflow와 최초 설치 파일 검증은 다음 단계이며 아직 완료로 표시하지 않습니다.

실제 GitHub 확인 작업 https://github.com/ondallio/buzz-korean/actions/runs/42541927839이 성공해 과거 정식판으로 돌아가지 않고 build:false로 기존 소스를 유지하는 동작을 확인했습니다. 이후 관리 런타임 분리를 독립 검토했고 현재 관리171개와 앱 의존 검사2개가 모두 통과했습니다. 서명 키 복구 사본은 별도 경로 `~/.local/share/buzz-korean-recovery/`에 0600 권한으로 만들고 일치를 확인했습니다. 다음 단계에서 첫 build_current를 실행합니다.
