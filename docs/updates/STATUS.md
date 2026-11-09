# 한글판 자동 업데이트 작업 기록

공개 저장소는 [ondallio/buzz-korean](https://github.com/ondallio/buzz-korean), 대상은 Apple Silicon macOS입니다. 관리 폴더 `/Users/stan/orca/buzz-korean`의 `app/`에 앱 소스가 있습니다. 원본 `/Users/stan/orca/buzz-main-kor`와 실행 중인 기존 앱은 유지합니다.

## 구현과 출처

공식 소스 `block/buzz@ff6ab96e42b1fc64bfc1236104478a84e11b5abd`를 실제 Git blob과 대조하여 가져왔고 한글 변경을 별도 이력으로 보존했습니다. 현재 공식 정식판 `desktop-v0.5.28`은 초기 기준 소스보다 오래되어 자동으로 되돌리지 않습니다. 신규 `block/buzz-app`의 공식 1.0 베타로 이전하는 작업은 별도 범위입니다. 이 저장소의 `1.0.N`은 한글판 자체 배포 번호입니다.

6시간 주기의 공식 정식판 확인, 명시적 이전 소스 기준 3-way 병합, 번역·타입·린트·테스트·빌드, 독립 서명·게시, 중단 후 재시도와 해시 검사를 구현했습니다. 충돌이나 검사 실패 시 기존 배포를 유지합니다. source와 trusted 관리 코드를 분리하며 앱 빌드 작업에는 서명 키를 전달하지 않습니다. 개인키·계정 데이터·.env·캐시·복구 파일은 공개 소스에서 제외합니다.

앱 identifier, keyring, nest, CLI와 agent 설정 경로를 한국어판 전용으로 분리했습니다. 사용자 계정이나 키를 기존 앱에서 자동으로 복사하지 않습니다. 공유 clipboard는 기존 클라이언트와 호환되는 `buzz://`를 유지하고, 한글판 native 진입은 `buzz://`와 `buzz-korean://`를 모두 받습니다. 기본 외부 연결 앱은 OS와 사용자의 선택을 따릅니다.

macOS 마이크·카메라·로컬 네트워크 권한 안내 세 문장을 별도 en/ko 리소스로 추가했습니다. OS 권한창은 macOS의 앱 언어 설정을 따릅니다. 앱 내부의 한국어·영어 선택과 구분합니다. 원문·키가 바뀌면 빌드가 실패하도록 했습니다.

## 현재 검증

- 관리 도구 185/185, 앱 의존 도구 2/2, actionlint, diff check 통과. 로그 `/private/tmp/buzz-korean-link-and-permissions-management.log`와 `...app-tools.log`.
- 공유 링크 독립 검사 119/119, 실제 Rust identity debug/release 컴파일 2/2, Korean·official 각각 실제 clipboard → composer E2E 2/2 통과. [링크 독립 검토](link-compatibility-review.md)의 세 차단 결함을 해결했습니다.
- 신선한 mock-bridge 프런트엔드에서 verify-desktop의 sidebar-navigation, channel-context-menu, send-message, settings, localization, localization-surfaces 총 11개 흐름 통과. 증거는 비공개 `app/desktop/test-results/verify-desktop/korean-link-repair-current/`입니다. 네이티브 앱 증거로 세지 않습니다.
- macOS 리소스·config·native verifier·plist 검사 42/42, 독립 범위 41/41 통과. 실제 Apple Foundation이 명시적으로 선택한 ko.lproj의 한국어 문장을 읽었습니다. 실제 OS 권한창이나 최종 bundle 검증은 아닙니다. [독립 검토](macos-localization-review.md).
- 한글 static 검사: 4,930키, 누락·치환 오류·미분류 고정 JSX/속성/feedback 문구 0. macOS 권한 3키는 별도 리소스로 검사합니다.
- 링크 수정 후 `just ci` 첫 실행은 기존 buzz-db의 process-global pool metrics 병렬 테스트 race 한 건으로 실패했습니다. 원문 소스는 공식 기준과 byte 일치합니다. 해당 crate 재실행 191/191 통과, 병렬 반복에서 같은 실패를 재현했습니다. 테스트 삭제·assertion 완화 없이 `RUST_TEST_THREADS=1`로 전체 필수 검사를 다시 실행하며 GitHub 빌드에도 같은 설정을 적용합니다. 현재 전체 재실행 결과는 아직 대기 중입니다. 이전 수정 전 `just ci` 통과 기록을 현재 통과로 대신하지 않습니다.

## 실제 GitHub 실행과 다음 작업

[확인 실행 42541927839](https://github.com/ondallio/buzz-korean/actions/runs/42541927839)은 성공했습니다. 실제 upstream에서 build:false로 과거 정식판 다운그레이드를 하지 않는 동작을 확인했습니다.

[첫 빌드 42542407142](https://github.com/ondallio/buzz-korean/actions/runs/42542407142)는 공유 링크 호환성 결함을 발견하여 서명·게시 전에 취소했습니다. draft `korean-v1.0.0`에는 설치 파일이 없습니다. 실패·취소 번호는 재사용하지 않으므로 다음 후보는 1.0.1입니다. 위 수정과 독립 검토 후 새 빌드를 실행합니다. 실제 배포 완료로 표시하지 않습니다.

남은 작업은 새 hosted 전체 검사, 실제 DMG/archive 생성·검증·게시, feed 서명/해시 확인, 네이티브 설치와 N→N+1 교체입니다. Apple Developer ID가 없어 초기 서명은 ad-hoc이며 Apple 공증은 미완료입니다. Gatekeeper를 끄거나 quarantine을 제거하는 스크립트는 제공하지 않습니다.

사용자 직접 확인은 대기 중입니다. 실제 한글 IME, 권한창, 기존 앱·키체인 병행, 업데이트 후 재실행은 별도 미검증이며 브라우저 테스트로 완료 처리하지 않습니다. 실제 앱에서 커뮤니티 연결·온보딩을 마친 뒤 검증할 수 있습니다. 사용자 키를 임의로 가져오거나 실제 커뮤니티에 시험 메시지를 보내지 않습니다.

## 복구와 재개

초기 로컬 전체 검사에서 공유 target 캐시를 쓰면서 원본 `target/debug/buzz-desktop`이 integration-test 빌드로 바뀐 일을 복구했습니다. 실행 중인 원본의 UUID `B0947731-5E1B-332D-BF20-014DBE63F21D`와 일치하는 기존 deps 바이너리로 원자 복구하고 SHA 일치를 확인했습니다. 기존 PID80446은 유지했습니다. 복구 기록과 두 파일은 비공개 `.local/original-binary-recovery/`에 있습니다.

현재 workspace/native target은 새 저장소 `.local/build-cache/`의 전용 COW 복사본을 사용합니다. 원본 캐시를 다시 연결하지 마세요. 전용 updater 키는 저장소 밖 `~/.config/buzz-korean-signing/update.key`, 복구 사본은 `~/.local/share/buzz-korean-recovery/update-key-20261109.key`입니다. 키를 출력하거나 공개하지 마세요. GitHub Secret `KOREAN_UPDATER_PRIVATE_KEY`는 개인 Buzz 계정 키가 아닌 전용 updater 키입니다.

```sh
cd /Users/stan/orca/buzz-korean
. ./app/bin/activate-hermit
node scripts/test-management.mjs
node --test tests/nested-check.test.mjs tests/plist.test.mjs
app/bin/actionlint .github/workflows/korean-release.yml
gh run list --repo ondallio/buzz-korean --workflow korean-release.yml
```

실제 run id와 control/candidate SHA는 비공개 `.local/active-release.json`에도 남깁니다. 실행 중에는 remote main을 바꾸지 마세요. publisher가 원래 control SHA를 검사합니다. versioned asset을 `--clobber`로 바꾸지 마세요. 실패한 draft는 재시도 기록이며 동일 원본/관리 코드에서 새 후보 시도는 최대 세 번입니다. 업로드 중단은 해당 실행의 실패 job 재실행으로 같은 바이트를 재사용합니다.
