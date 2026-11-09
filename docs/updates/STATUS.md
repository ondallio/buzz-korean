# 한글판 자동 업데이트 작업 기록

공개 저장소는 [ondallio/buzz-korean](https://github.com/ondallio/buzz-korean), 대상은 Apple Silicon macOS입니다. 관리 폴더 `/Users/stan/orca/buzz-korean`의 `app/`에 앱 소스가 있습니다. 현재 최종 소스를 동결했고 전체 필수 검사를 다시 실행 중입니다. 아직 공개 설치 파일이나 유효한 latest.json은 없습니다.

## 구현과 출처

공식 `block/buzz@ff6ab96e42b1fc64bfc1236104478a84e11b5abd`를 Git blob으로 대조하여 가져왔고 한글 변경을 별도 이력으로 보존했습니다. 공식 정식판 `desktop-v0.5.28`은 초기 기준 소스보다 오래되어 되돌리지 않습니다. 별도 `block/buzz-app`의 공식 1.0 베타 이전은 이번 작업에 포함하지 않습니다. 한글판 자체 번호 `1.0.N`은 공식 제품 버전과 다릅니다.

6시간 주기의 정식판 확인, 명시적 이전 소스 기준 3-way 병합, 번역·타입·린트·테스트·빌드, 전용 updater 서명과 게시, 중단 후 재시도·해시 검사를 구현했습니다. 충돌이나 검사 실패 시 이전 배포를 유지합니다. 원본 workflow는 app/.github에 보존하고 root의 검토된 workflow만 실행합니다. 앱 빌드와 브라우저 검사는 서명 키 없이 같은 candidate에서 병렬 실행합니다. 두 작업이 모두 성공해야 별도 trusted signer가 실제 bundle 검사와 서명·게시를 수행합니다.

앱 identifier, keyring, nest, CLI, agent 설정 경로를 한글판 전용으로 분리했습니다. 기존 계정이나 키는 자동으로 가져오지 않습니다. clipboard는 기존 Buzz와 호환되는 `buzz://`를 유지합니다. native 진입은 `buzz://`, `buzz-korean://`를 모두 받고, 외부 연결 기본 앱은 OS와 사용자의 선택을 따릅니다. 개인 계정 키·데이터·.env·캐시·복구 파일은 공개 소스에서 제외합니다.

## 번역과 독립 검토

- 공유 링크 clipboard/parser/native 단일 인스턴스 경로의 결함을 수정했습니다. [링크 검토](link-compatibility-review.md).
- macOS 마이크·카메라·로컬 네트워크 권한 안내 3키를 en/ko 리소스로 추가했습니다. 실제 OS 권한창의 언어는 macOS 앱 언어 설정을 따릅니다. [권한 리소스 검토](macos-localization-review.md).
- Node 24가 직접 읽는 JSON import 28곳에 표준 type 속성을 추가해 전체 Playwright 수집 오류를 해결했습니다. [import 검토](json-import-review.md).
- 원본과 다른 README/preview의 newline regex 두 곳을 복원하고 실제 production 입력·출력 회귀를 추가했습니다. 1,743개 기존 production TS/TSX의 regex를 비교하여 다른 기존 regex 손상이 없음을 확인했습니다. [regex 검토](regex-compatibility-review.md).
- 계산된 문구의 51개 누락 그룹과 Archive·MessageComposer 경로를 수정했습니다. 입력 안내, 버튼·툴팁·접근성 이름·빈 화면 등을 포함합니다. 17개 파일과 19개 파일을 겹치지 않게 나누고, 별도 fallback 4개 파일도 수정했습니다. 새 155키를 추가하고 기존 participant template 3개를 재사용했습니다. 사용자 이름·채널명·파일명·hash·선택값·진단 원문은 보존합니다. [전체 목록](computed-label-review.md), [A/B 독립 검토](computed-batches-review.md).
- 공개판에서 빠진 Bestie의 음성 검증과 기능을 켠 별도 빌드의 기존 전체 양성 검증을 모두 필수로 실행합니다. 기존 양성 assertion은 AST로 동일함을 확인했습니다. 테스트 포트에 맞게 clipboard 권한과 음성 fixture 주소를 구하며 payload·단축키·판정은 유지합니다. [variant 검토](bestie-variant-review.md).
- 독립 build/browser 작업과 signer의 두 success gate를 검토했습니다. [병렬 검사 검토](parallel-checks-review.md).

위 독립 검토에 남은 차단 결함은 없습니다. 이것을 전체 release·native 설치·사용자 확인 완료로 확대하지 않습니다.

## 현재 검증 증거

- 관리 검사 186/186, 앱 의존 도구 2/2, actionlint, diff check 통과. 로그 `/private/tmp/buzz-korean-publication-final-management.log`, `...app-tools.log`.
- 새 computed/fallback/README/preview 회귀를 독립 검토자가 직접 실행하여 43/43 통과했습니다. 실제 모듈의 같은 props·같은 DOM node에서 EN→KO→EN, 선택값·focus 유지, 불필요한 write 부재를 확인했습니다. 작성자의 확대 A 96/96, B 20/20 및 새 B 브라우저 7/7 결과는 별도 기록합니다.
- 최종 static 검사: 전체 소스 catalog 5,085키, 공개 runtime 5,068키와 별도 protected 17키. protected 제외는 영어 fallback을 완료로 센 것이 아닙니다. 1,757개 production 파일에서 누락·변수 오류·분류되지 않은 직접 JSX/속성/feedback 0입니다. static 검사는 임의의 런타임 문자열을 보증하지 않으므로 계산 문구의 별도 inventory와 production 회귀를 함께 사용합니다. macOS 권한 3키는 별도입니다.
- verify-desktop의 신선한 mock bridge에서 탐색·채널 메뉴·전송·설정·번역 등 11흐름을 확인했습니다. 이후 새 private build에서도 언어 전환·유지, OS-KO 첫 실행, 검색·메시지·Nostr 서명·온보딩 등의 주요 흐름을 재확인했습니다. 브라우저 증거를 native IME나 설치 증거로 세지 않습니다.
- 전체 smoke 진단 실행은 1,492개를 끝까지 실행하여 1,480 통과·11 실패·기존 제외 1개였습니다. 이 실행은 수정 전 frontend 진단이며 최종 통과가 아닙니다. 실패는 variant 1, clipboard origin 2, owner DOM 기대값 1, 실제 paragraph regex 1, 음성 fixture origin 4, 별도 재현되지 않은 boot/video timing 각 1입니다. 후속 focused 검사는 Bestie 각 variant, clipboard 11/11, profile·owner·preview 3/3, 원래 video 1/1, 음성 전체 13/13을 통과했습니다. 최종 frozen source의 전체 hosted smoke 통과는 여전히 필요합니다.
- 수정 중간 소스의 `just ci`는 종료 코드 0을 확인했습니다. 최신 computed 문구까지 동결한 뒤 다시 `just ci`를 실행 중이며 이전 통과로 대신하지 않습니다. 현재 로그 `/private/tmp/buzz-korean-computed-final-ci.log`.
- 기존 buzz-db process-global metrics의 병렬 테스트 race를 재현했습니다. 원본 소스는 공식과 byte 일치합니다. assertion이나 테스트를 바꾸지 않고 `RUST_TEST_THREADS=1`로 실행합니다. [원인과 재현](ci-race-diagnosis.md).

## 실제 GitHub 실행

확인 전용 [42541927839](https://github.com/ondallio/buzz-korean/actions/runs/42541927839)은 성공했고 과거 정식판으로 되돌리지 않는 build:false를 확인했습니다.

이후 세 후보는 서명·게시 전에 취소했습니다. 모두 draft이며 assets 0입니다.

| 실행 | draft | 취소 이유 |
| --- | --- | --- |
| [42542407142](https://github.com/ondallio/buzz-korean/actions/runs/42542407142) | korean-v1.0.0 | 실제 canonical link 호환성 결함 수정 |
| [42548557350](https://github.com/ondallio/buzz-korean/actions/runs/42548557350) | korean-v1.0.1 | Node 24 JSON import 수집 오류 수정 |
| [42549476700](https://github.com/ondallio/buzz-korean/actions/runs/42549476700) | korean-v1.0.2 | 전체 진단 이후 variant·regex·계산 문구 수정 반영 |

세 번째 실행의 cache post는 실행됐지만 저장되지 않았습니다. 취소된 compiler 출력이 tar 중에도 바뀌어 gtar가 실패했고 실제 캐시 목록도 비어 있습니다. post의 success만으로 캐시 확보를 주장하지 않습니다. 해당 실제 로그는 비공개 `.local/run-42549476700.log`입니다. 다음 후보는 1.0.3이며 번호는 재사용하지 않습니다.

## 남은 검증과 사용자 확인

현재 frozen source의 전체 CI, 새 병렬 hosted 검사와 실제 앱/DMG 생성·검증·게시, feed 서명·해시 확인이 남았습니다. 실제 설치와 N→N+1 교체, OS 권한창·키체인 병행·한글 IME도 별도 미검증입니다. 커뮤니티·프로필 온보딩을 마쳐야 설정과 대화 화면을 사용할 수 있으며 사용자 키를 임의로 가져오거나 실제 커뮤니티에 시험 메시지를 보내지 않습니다.

사용자 직접 확인은 대기 중입니다. 에이전트 검사가 이를 대신하지 않습니다. PR을 만들지 않았고 `buzz-review-completed`도 선언하지 않았습니다. Apple Developer ID 공증은 준비되지 않아 초기 서명은 ad-hoc입니다. Gatekeeper를 끄거나 quarantine을 제거하는 스크립트는 제공하지 않습니다.

## 복구와 재개

원본 `/Users/stan/orca/buzz-main-kor`의 코드와 기존 앱은 유지합니다. 초기 공유 target 캐시의 integration-test 빌드가 원본 실행 파일을 바꾼 일을 복구했습니다. 실행 중인 UUID `B0947731-5E1B-332D-BF20-014DBE63F21D`와 같은 기존 deps 바이너리로 원자 복구하고 SHA 일치를 확인했습니다. 기존 PID80446을 유지했습니다. 기록과 두 파일은 비공개 `.local/original-binary-recovery/`에 있습니다.

현재 workspace/native target은 새 저장소 `.local/build-cache/`의 전용 COW 복사본입니다. 원본 캐시를 다시 연결하지 마세요. 전용 updater 키는 `~/.config/buzz-korean-signing/update.key`, 복구 사본은 `~/.local/share/buzz-korean-recovery/update-key-20261109.key`에 있습니다. 키를 출력·공개하지 마세요. GitHub Secret `KOREAN_UPDATER_PRIVATE_KEY`는 개인 Buzz 계정 키가 아닌 전용 updater 키입니다.

```sh
cd /Users/stan/orca/buzz-korean
. ./app/bin/activate-hermit
node scripts/test-management.mjs
node --test tests/nested-check.test.mjs tests/plist.test.mjs
app/bin/actionlint .github/workflows/korean-release.yml
gh run list --repo ondallio/buzz-korean --workflow korean-release.yml
```

실제 run/control/candidate는 비공개 `.local/active-release.json`에도 기록합니다. 실행 중 remote main을 바꾸면 publisher가 게시를 거부합니다. versioned asset을 --clobber로 바꾸지 마세요. 실패한 draft는 재시도 기록이며 동일 원본/관리 코드에서 새 후보 시도는 최대 세 번입니다. 업로드 중단은 해당 실행의 실패 job 재실행으로 동일 바이트를 재사용합니다.
