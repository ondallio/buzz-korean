# 빌드·서명 workflow 독립 검토

검토일은 2026-11-09입니다. `/root/catalog_01`이 현재 소스와 직접 실행한 검사로 작성했습니다. 프로덕션 소스·workflow·Git 메타데이터·원격 저장소는 변경하지 않았습니다. 실제 앱 빌드나 업로드도 하지 않았습니다. 아래는 첫 리뷰의 전체 발견 목록이며, 수정 전 상태를 기록합니다.

## 차단 권고

### B1. 공개키 검사가 실제 Tauri와 다릅니다

대상은 `scripts/channel-config.mjs:10–11`, `scripts/signature.mjs:7–14`, 두 모듈의 테스트입니다.

`channelConfig`는 outer base64를 관대한 `Buffer.from`으로 읽고 문자열 정규식으로 키 줄을 찾습니다. 실제 키의 decoded 길이·algorithm과 전체 2줄 형식을 검증하지 않습니다. `verifySignature`는 decoded 키의 길이와 key ID, 마지막 32바이트는 사용하지만 앞의 algorithm 바이트를 확인하지 않습니다.

공개 minisign test vector의 key algorithm을 `Ed`에서 `E\``로만 바꾸고 key ID와 공개키 32바이트를 그대로 둔 실제 실행 결과입니다.

```json
{"keyAlgorithm":"E`","channelConfigAccepts":true,"verifySignatureAccepts":true}
```

Tauri가 사용하는 `minisign-verify`의 `PublicKey::from_base64`는 앞 두 바이트가 `Ed` 또는 `ED`가 아니면 `UnsupportedAlgorithm`을 반환합니다. 확인한 로컬 생산 dependency 소스는 `minisign-verify-0.2.5/src/lib.rs:287–306`입니다. 현재 positive config 테스트의 `RW` + `A` 54개 가짜 키도 유효한 algorithm을 보장하지 않습니다. 따라서 손상된 공개키가 빌드·배포 전 검사를 통과하고 설치된 앱의 업데이트만 실패할 수 있습니다.

수정은 config와 verifier가 동일한 strict decoder를 사용하게 하는 것입니다. outer/inner canonical base64, 유효 UTF-8, 정확한 줄 수, 공개키 길이 42바이트와 지원 algorithm을 검사해야 합니다. 올바른 공개키와 실제 서명 positive를 유지하면서 잘못된 algorithm·garbage·키 형태/줄 추가를 거부하는 생산 API 회귀를 추가해야 합니다. private key 자료를 입력하거나 출력하는 검사는 필요하지 않습니다.

이 발견은 Ed25519/BLAKE2b 검증 수학이 틀렸다는 뜻이 아닙니다. 실제 설치된 정확한 `tauri-cli 2.11.4`로 합성 테스트 파일을 서명하여 현재 `verifySignature`가 통과하는 것을 별도로 확인했습니다.

### B2. 설정한 브라우저 gate가 한국어 채널과 불일치하고 한국어 흐름을 검사하지 않습니다

대상은 `.github/workflows/korean-release.yml:66–68,94–98`, `app/desktop/tests/e2e/message-copy-link.spec.ts:124–128`입니다.

build job은 `VITE_BUZZ_BUILD_CHANNEL=korean`을 설정하고 `pnpm test:e2e:smoke`를 실행합니다. 이 명령의 새 E2E 빌드도 해당 환경변수를 상속합니다. 현재 실제 `MessageActionBar`는 한국어 채널에서 `buzz-korean://message?...`를 복사합니다. 그런데 smoke에 등록된 message-copy-link 테스트는 정확히 `buzz://message?...`를 기대합니다. 앞선 독립 native 리뷰에서 실제 생산 copy 함수의 Korean 출력도 확인했습니다. 이 조합은 gate를 실패시키므로 서명 단계까지 도달하지 못합니다.

복사 결과의 기대 scheme만 선택한 distribution에 맞게 분리해야 합니다. channel/id/thread 전체와 두 메뉴 경로의 동일성 검사는 유지하고, 저장·내부 navigation용 canonical `buzz://` fixture를 일괄 바꾸면 안 됩니다. 단순히 Korean flag를 지워서 이 테스트를 통과시키는 것도 한국어판 검증이 아닙니다.

또한 현재 `app/desktop/tests/e2e`와 Playwright 설정에는 Korean 언어 선택·한국어 렌더링을 단언하는 흐름이 없습니다. workflow step의 `Exercise Korean and English browser flows`라는 이름만으로 두 언어 실행을 증명할 수 없습니다. 기존 전체 smoke를 유지하면서 실제 한국어/영어 전환 및 의미 있는 한국어 UI·접근성 이름을 확인하는 작은 production browser flow를 추가해야 합니다. 언어별 selector 의도를 보존하고 검사를 약화하지 않아야 합니다.

실제 앱 빌드가 금지된 이번 리뷰에서는 이 E2E 실패를 브라우저에서 재실행하지 않았습니다. 판정 근거는 현재 workflow의 환경 전달, 등록된 exact expectation, 이미 실행한 실제 생산 copy 함수의 출력입니다.

### B3. 사용자 plist가 한국어판 OS 표시 이름을 다시 Buzz로 덮습니다

대상은 `scripts/channel-config.mjs:13–16`, `scripts/build-release.mjs:30–32`, `app/desktop/src-tauri/Info.plist`입니다.

overlay의 `productName`은 `Buzz Korean`이지만 기존 `bundle.macOS.infoPlist: "Info.plist"`를 상속합니다. 그 plist에는 `CFBundleName`과 `CFBundleDisplayName`이 둘 다 `Buzz`로 고정되어 있습니다. 정확한 [tauri-cli-v2.11.4 bundler 원본](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle/macos/app.rs)은 productName 기본값을 만든 뒤 사용자 plist의 모든 키를 덮어씁니다. 해당 버전 소스의 기본값은 203/220줄, 사용자 override는 329–337줄에서 확인했습니다.

실제 입력 plist를 읽어 같은 merge 순서를 적용한 결과는 다음과 같습니다.

```json
{"CFBundleName":"Buzz","CFBundleDisplayName":"Buzz","CFBundleIdentifier":"io.github.ondallio.buzz-korean"}
```

`.app` 폴더 이름과 bundle identifier는 분리되어도 OS가 읽는 표시 이름은 공식판과 같습니다. 현재 build-release의 최종 검사도 ID와 short version만 검사하므로 이를 놓칩니다. 독립 한국어판을 사용자가 OS에서 구별하도록 한 계약에 맞게 Korean 전용 plist delta를 생성하거나 두 표시 이름을 명시적으로 교체해야 합니다. 기존 권한 설명과 entitlements는 보존합니다. 최종 앱의 두 이름, 실제 deep-link scheme와 version을 함께 검사하는 회귀가 필요합니다.

이 발견은 실제 앱 bundle 빌드 결과라고 주장하지 않습니다. 정확히 고정된 bundler 생산 소스와 현재 입력 plist에서 확인한 확정 merge 결과입니다.

## 직접 통과한 검사

- `node --test tests/channel-config.test.mjs tests/signature.test.mjs tests/nested-check.test.mjs`는 현재 **5/5** 통과했습니다. 이 positive 결과가 위의 빠진 거부 조건을 증명하지는 않습니다.
- 수정된 생산 `app/scripts/check-file-sizes-core.mjs`를 사용하는 기존 upstream 테스트 **10/10**도 통과했습니다. root layout, symlink 진입, 원래 규칙·ceiling·증분 ratchet·기준 ref 오류의 동작을 유지했습니다. 새 nested 테스트는 실제 임시 Git 저장소의 `app/desktop/src/large.ts`가 4줄에서 11줄로 늘 때 production gate의 exit 1과 violation을 확인합니다. 경로만 바꾸고 크기 기준을 완화한 변경이 아닙니다.
- `tauri-command.mjs`를 임시 capture CLI와 함께 실제 실행했습니다. 작업 cwd는 실제 `app/desktop`이며 바깥 디렉터리의 절대 channel config 인자를 그대로 전달했습니다. wrapper가 추가하는 private frontend override는 `BUZZ_PROTECTED_BUILD_OUTPUT`과 같은 디렉터리를 가리켰습니다. 실제 Tauri config deserialization이나 앱 빌드를 실행한 검사는 아닙니다.
- 설치된 정확한 CLI `2.11.4`로 임시 합성 파일 전용 키를 생성하고 서명했습니다. signature algorithm은 `ED`였고 현재 config·독립 `verifySignature` 모두 정상 통과했습니다. 임시 private key는 출력하지 않았고 전체 fixture를 정리했습니다. 실제 배포 키·앱·원격 릴리스에는 접근하지 않았습니다.

## 확인한 설계와 범위

workflow는 schedule/manual 진입을 canonical 저장소의 main으로 제한하고 공통 concurrency를 사용합니다. prepare의 write token, build의 read token, sign-publish의 key와 write token은 별도 job에 있습니다. signing job은 candidate script가 아니라 workflow 실행 원본 `github.sha`를 checkout합니다. 앱 build hook을 signing job에서 실행하지 않는 방향이 맞습니다. 상위 prepare/publish의 source·artifact journal 검증 자체는 다른 독립 검토 담당 범위입니다.

각 action은 전체 SHA로 고정되어 있습니다. 고정된 [cashapp/activate-hermit action](https://raw.githubusercontent.com/cashapp/activate-hermit/cea9af7913204a965fd488637a8d1811bba2e616/action.yml)이 `working-directory: app`을 실제 지원하는 것도 확인했습니다. `macos-15`는 현재 [GitHub 공식 ARM64 runner](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)이고 build script도 플랫폼과 architecture를 먼저 확인합니다. build script는 sidecar Cargo target과 bundling target을 `aarch64-apple-darwin`으로 일치시킵니다.

channel overlay는 updater URL·public key·deep-link scheme·앱 identifier를 고정하고 기존 `externalBin` 목록을 덮어쓰지 않습니다. `createUpdaterArtifacts: false`는 비밀 없는 build에서 수동 archive를 만든 후 별도 signer가 서명하는 구조와 맞습니다. Cargo package, frontend package, base Tauri와 override version을 같은 값으로 설정합니다. 최종 Info.plist ID·version 및 메인 ARM64를 확인하고, bundle 아래 regular Mach-O를 순회하여 ARM64 포함 여부를 확인합니다. 실제 helper 포함·서명·배포 결과는 앱 빌드가 필요합니다.

`just ci`가 요구하는 Node workspace와 mobile pub 의존성을 설치하고, 기본 브랜치의 후보 부모를 읽을 수 있도록 checkout depth 2를 사용합니다. nested Git root를 반영한 size gate의 동작은 직접 검증했습니다. 전체 hosted CI의 실행 시간·디스크·외부 의존성·브라우저 실행 성공은 이 리뷰에서 확인하지 않았습니다. 알려진 B2 외에 원격 CI가 통과했다고 추정하지 않습니다.

## 점수와 인계

최초 상태의 최소성은 9/10입니다. 구조는 8/10이며 config/verifier의 중복되고 불일치한 키 parsing을 공유 검증으로 정리하면 개선됩니다. 정확성은 7/10이며 B1–B3이 그 구체 근거입니다. 세 발견을 수정하고 실제 검사를 확인하기 전에는 이 scope를 통과로 처리하지 않습니다.

실제 hosted workflow, 최종 한국어판 bundle·권한·architecture, 공개 endpoint, N→N+1 설치와 사용자 직접 확인은 아직 별도 증거입니다. 이 문서는 다른 검토자의 prepare/publish/process 검토 또는 native 리뷰를 대체하지 않습니다.

## 수정 재검토와 새 archive gate 첫 검토

B1과 B3의 수정은 생산 코드 및 직접 실행한 검사로 확인했습니다. `public-key.mjs`의 공유 decoder는 canonical base64·유효 UTF-8·2줄 envelope·42바이트·Ed/ED algorithm을 검사하고 config와 서명 verifier가 모두 사용합니다. 잘못된 algorithm이나 쓰레기 문자를 넣었던 이전 재현이 거부됩니다. 새 positive는 실제 공개 test vector를 사용합니다. `prepare-plist.py`는 기존 권한 설명을 보존하면서 두 bundle 이름만 바꾸고, build script는 그 절대 경로를 config에 전달합니다. 완성 앱의 이름 두 개와 유일한 `buzz-korean` URL scheme 검사도 추가됐습니다. 새 3개 회귀를 포함한 관련 config/key/plist/signature 테스트는 독립 실행 **7/7** 통과했습니다.

B2의 clipboard expectation은 빌드 채널에 따라 정확한 전체 URL을 기대하도록 바뀌었고, 권한 origin도 실제 Playwright baseURL에서 얻습니다. canonical helper나 event-data fixture는 바꾸지 않았습니다. 새 `korean-channel.spec.ts`가 smoke에 등록되어 실제 설정의 영어·한국어 전환, 한국어 접근성 이름, 초안과 전송, reload 후 저장, 검색·메뉴·좁은 화면 및 Korean OS 첫 실행을 검사합니다. 독립 source 검토에서 의도한 검사가 실제 UI 동작에 연결됨을 확인했습니다. 총괄의 focused browser 실행은 마지막 좁은 화면 단계가 조사 중이며, 이 시점에는 B2의 실제 브라우저 검증 완료로 처리하지 않습니다.

### R7 첫 검토의 전체 발견 목록

새 `scripts/verify-archive.py`는 추출·실행 없이 TAR 경로와 링크, plist, ARM64 binary를 확인하는 방향입니다. publisher는 signer 환경변수에서 key를 제거한 뒤 이 gate를 호출하고 검증 뒤의 전용 signer에만 key를 전달합니다. 실제 `/Applications/Buzz.app/Contents/MacOS`의 메인과 여섯 helper는 읽기 전용으로 header·크기·mode를 확인했습니다. 모두 ARM64 Mach-O 및 mode 0755였고 앱이나 helper를 실행하지 않았습니다.

기존 B1–B3와 별개인 이 새 parser의 첫 검토에서는 다음 3건을 한 배치로 전달했습니다. 후속 검토는 이 발견과 수정이 도입한 회귀에 한정합니다.

| 발견 | 직접 재현과 영향 | 필요한 수정 |
| --- | --- | --- |
| R7a: 잘못된 TAR header가 EOF로 처리됨 | 유효한 bundle 마지막의 TAR end marker 직전에 checksum이 잘못된 비영(非零) 512바이트 header를 넣어도 gate가 성공합니다. Python `TarFile.next`가 첫 member 뒤 `InvalidHeaderError`를 EOF로 삼키고, gate는 그 다음 padding만 확인하기 때문입니다. 엄격한 실제 설치 loader는 이 archive unpack을 실패시킬 수 있습니다. | 빈 정상 end marker와 손상된 header를 구별하고 손상된 checksum/header를 명시적으로 거부합니다. 같은 fixture의 거부 회귀를 추가합니다. |
| R7b: 소유자 실행·탐색 권한 미검사 | 7개 binary를 mode 0001로 만든 실제 임시 archive가 성공합니다. `mode & 0111`은 other 실행 비트만 있어도 참이므로 설치 파일 소유자가 실행할 수 없을 수 있습니다. bundle directory의 탐색 권한도 필요합니다. | binary의 owner 실행 권한과 directory의 owner 탐색 권한을 검사하고 각각 잘못된 mode를 거부하는 회귀를 추가합니다. |
| R7c: unsupported sparse를 거부하기 전에 메타데이터를 크게 할당함 | 7,448바이트 gzip fixture의 GNU sparse extension block 4,096개는 header count에 포함되지 않습니다. 생산 parser가 region tuple 86,016개를 먼저 만들고 peak RSS가 7,094,272바이트 늘어난 뒤에야 unsupported sparse로 거부했습니다. 4GiB expanded 한도에 도달하기 전에도 tuple 할당으로 VM 메모리를 소진할 수 있습니다. | GNU sparse와 PAX sparse의 각 처리 진입을 metadata parsing 전에 거부합니다. `_proc_sparse`와 `_proc_gnusparse_*` 같은 생산 처리 경계에서 작은 확장 fixture를 즉시 거부하는 회귀가 필요합니다. |

R7a/b는 gate의 현재 공개 API에 실제 gzip/TAR 임시 파일을 전달하여 `ACCEPTED`를 확인했습니다. R7c도 같은 생산 parser에 실제 압축 fixture를 입력했습니다. fixture는 모두 정리했습니다. 거대한 폭탄 파일이나 실제 메모리 고갈은 실행하지 않았습니다. Sparse 확장 처리 자체는 표준 Python `tarfile`의 생산 메서드를 함께 읽어 확인했습니다.

Archive 작성자는 explicit parent directory와 implicit-directory 자원 경계도 수정 중이라고 총괄이 알렸습니다. 이 수정과 R7a–c의 최종 source freeze 후 전체 archive 회귀와 재현을 다시 확인해야 합니다. 이 시점에는 새 archive gate를 통과로 인증하지 않습니다.

### B1–B3 최종 재확인과 R7 후속 증거

기존 build 차단 결함 B1–B3은 모두 해결 확인했습니다. B1/B3의 생산 API 검사 7개 통과에 더해, B2의 frozen focused browser 4개를 검토자가 직접 재실행하여 **4/4 passed, 10.4초**를 확인했습니다. 명령은 `app/desktop`에서 `VITE_BUZZ_BUILD_CHANNEL=korean node node_modules/@playwright/test/cli.js test --config=playwright.channel.config.ts --output=/private/tmp/buzz-korean-independent-channel-results`입니다. 총괄이 만든 별도 E2E frontend를 사용했으며 새 앱 빌드는 하지 않았습니다. 독립 로그는 `/private/tmp/buzz-korean-independent-channel-e2e.log`, 결과는 `/private/tmp/buzz-korean-independent-channel-results`입니다. 총괄의 앞선 4/4 결과도 읽었지만 이 수치는 검토자의 새 실행입니다.

R7a–c의 frozen 수정도 읽고 **archive 40개 + key/config/plist/signature 7개, 총 47/47**을 직접 실행해 통과했습니다. 잘못된 header 예외는 더 이상 EOF로 삼키지 않고, owner read/search/execute 권한을 검사합니다. GNU sparse는 처리 전에 거부하고 PAX sparse의 세 allocator 진입도 override하여 차단합니다. 네 sparse tripwire 테스트는 stdlib allocator를 호출하면 실패하므로 단순 오류 문자열 검사로 대체하지 않았습니다. 정상 framework symlink chain과 ARM64 thin/fat positive도 유지됐습니다.

다만 parent-directory 수정의 실제 frozen 구현을 검토하면서 새로운 material 증거 R7d를 확인해 총괄에게 전달했습니다. 앞서 알린 explicit-parent 요구와 달리 구현은 없는 부모를 계속 implicit directory로 허용하고 exact-case로 조회합니다. `Contents/ALIAS -> MacOS` symlink와 `Contents/alias/buzz` 일반 파일을 함께 담으면 현재 gate가 성공합니다. 이 검토자의 실제 Mac 파일시스템에서 같은 임시 archive를 Python의 표준 `data` filter로 임시 폴더에 풀었더니, gate가 검사했던 `Contents/MacOS/buzz`를 다른 plain bytes가 덮어썼습니다. 운영 앱은 실행하거나 변경하지 않았습니다.

이는 단순한 speculative hardening이 아니라 macOS case-insensitive 경로에서 ancestor 검사를 우회하는 실제 사례입니다. 모든 부모가 명시된 directory여야 한다는 요구를 적용하거나, NFD/casefold canonical key로 ancestor 조회까지 통일하여 symlink/일반 파일 부모를 거부해야 합니다. root envelope, validated helper와 나중에 alias로 쓰는 파일 사이의 충돌도 막아야 합니다. 이 fixture를 거부하면서 정상 framework 링크를 유지하는 생산 회귀가 필요합니다. 기존 세 수정의 통과 결과는 유지하지만 R7d가 해결될 때까지 archive scope는 완료로 처리하지 않습니다.

### Frozen archive 수정의 최종 독립 재확인

R7d를 수정한 현재 `verify_links`는 모든 ancestor가 정확한 이름으로 등록된 실제 directory인지 확인합니다. implicit directory 추론을 제거했고, symlink 해석의 중간·최종 대상도 실제 member에 한정합니다. 전체 경로의 NFD/casefold 충돌 거부도 유지합니다. 따라서 `ALIAS`와 `alias`, NFC `café`와 NFD `café`처럼 macOS에서 같은 부모가 되는 변이로 검증한 helper를 덮을 수 없습니다. 같은 이름의 directory를 추가하여 우회하려 해도 기존 collision 검사가 거부합니다.

수정된 소스와 테스트를 읽고 다음 명령을 독립 실행했습니다.

```sh
node --test tests/archive.test.mjs tests/public-key.test.mjs \
  tests/plist.test.mjs tests/channel-config.test.mjs tests/signature.test.mjs
```

현재 결과는 **49/49 passed**입니다. archive 42개와 key/config/plist/signature 7개를 포함합니다. 로그는 `/private/tmp/buzz-korean-independent-build-gates.log`입니다. missing explicit parents, 실제 reported casefold alias, Unicode normalization alias를 거부하는 회귀가 추가됐고 정상 bundle과 framework chain positive는 유지됐습니다. R7a의 checksum/header, R7b의 owner 권한, R7c의 allocator 진입 전 sparse 거부도 같은 실행에 포함되어 통과했습니다. 이 수정에서 새 material regression은 찾지 못했습니다.

현재 확인한 frozen 파일 SHA-256은 다음과 같습니다.

```text
a8a4644f3237670d061a73041657297740154781601e2b8a5073a67af33d8516  scripts/verify-archive.py
8e2a3c4255fe7b5fb3b268239fcc2813001974989b66f52a69735368a95805e0  scripts/public-key.mjs
4ae8dfd8177bdb891f2a8af57d4975b1d1652cd0ee08ef0f710ea25aa5b51c2b  scripts/prepare-plist.py
0ab0007fc2214e5e369aed65eeb7d98b3cad47b00f5df7799a6d222f4d17abc7  app/desktop/tests/e2e/korean-channel.spec.ts
```

B1/B2/B3와 R7a–d의 차단 권고는 해결 확인했습니다. 이 검토 범위의 최종 점수는 최소성 9/10, 구조 9/10, 정확성 9/10이며 남은 material blocker는 없습니다. 별도로 추가 중인 native codesign/DMG 검증기는 이번 통과 판단에 포함하지 않습니다. archive의 header·경로·권한 검사는 실제 code-signature·설치 가능성·프로그램 실행의 증거를 대신하지 않습니다. hosted 전체 CI와 실제 앱·업데이트·사용자 확인의 기존 한계도 그대로 남습니다.
