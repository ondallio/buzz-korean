# 관리 스크립트 독립 검토와 수정 확인

2026-11-09, Asia/Seoul. 검토자 `/root/locale_design`은 부모와 같은 모델을 상속했습니다. 별도 모델이나 외부 보안 심사를 주장하지 않습니다. 이 검토는 `scripts/process.mjs`, `channel-config.mjs`, `github.mjs`, `prepare.mjs`, `build-release.mjs`, `publish.mjs` 및 관련 테스트·정책·워크플로를 대상으로 했습니다. 제품 기준은 `design.md`, `security-design-review.md`, 앱의 AGENTS/VISION/TESTING입니다. 검토자가 작성한 네이티브 identity 구현은 이 독립 검토의 승인 대상에서 제외했습니다.

초기 판단은 최소성 9/10, 구조 8/10, 정확성 7/10이었습니다. 아래의 실제 실패와 계약 위반을 수정하도록 권고했습니다. 수정 후 R1–R6은 생산 경로 회귀 및 소스 확인으로 해결했습니다. R7 Python 검사기는 이후 검토자가 구현했으므로 본인의 구현을 독립 검토 통과로 계산하지 않습니다. 별도 검토자 `/root/catalog_01`이 발견한 R7a–R7d를 수정했고, 그 재검토 및 새 macOS 네이티브 게이트 검증은 별도 증거가 필요합니다.

## 첫 검토의 차단 결함

| ID | 현실적인 실패와 근거 | 수정과 확인 |
| --- | --- | --- |
| R1 | `.sig` 업로드 후 다음 업로드가 실패하면 재시도에서 다시 만든 유효 minisign 서명의 trusted comment가 달라 기존 digest와 충돌했습니다. 실제 `publish.mjs`에 fake-gh와 두 공개 유효 서명 벡터를 연결해 최초 업로드 중단 → 재시도 digest 불일치를 재현했습니다. | 기존 draft `.sig`를 8KiB 제한으로 받고 현재 공개키·원본 바이트로 검증한 뒤 정확한 bytes를 재사용합니다. 현재 생산 publisher 테스트는 재시도 성공, 서명 1회, 여섯 asset의 중복 업로드 없음, 고정 manifest, 잘못된 key의 최초·재사용 거부를 검사합니다. |
| R2 | detached 자손이 inherited pipe를 보유하면 `run(timeoutMs:100)`이 자손의 종료까지 1242ms 동안 반환하지 않았습니다. 무기한 자손이면 timeout도 끝나지 않습니다. | timeout 후 process-group kill, 스트림 정리, 명시적 rejection으로 close 대기를 끊었습니다. 같은 안전한 1.2초 자손 fixture가 103ms에 실패를 반환하는 것을 재확인했습니다. job 밖으로 분리한 임의 프로세스까지 로컬 helper가 전부 제거한다고 주장하지 않습니다. |
| R3 | 업로드 전에만 최신 버전을 검사해, 업로드 도중 다른 게시자가 상위 버전을 공개하면 이전 job이 latest를 되돌릴 수 있었습니다. | 최종 PATCH 직전 채널 버전을 다시 조회합니다. 여섯 asset 업로드 후 상위 release가 나타나는 생산 publisher fixture가 draft 유지·공개 0회·main push 없음으로 통과합니다. |
| R4 | 초기 source floor의 Git 조상만 허용해 정상적인 side-history 안정 릴리스를 거부했습니다. 이는 명시적 snapshot merge 설계와 충돌했습니다. | 조상 강제를 제거하고 고정 초기 source 날짜·안정 버전·검증된 정확한 SHA를 검사합니다. 실제 임시 Git 저장소로 unrelated release history의 신규 stable 통합, 기존 한국어·관리 workflow 보존, 오래된 source 거부를 검사했습니다. 날짜 검사는 코드의 모든 의미적 변경을 증명하는 장치가 아닙니다. |
| R5 | ARM64 main만 검사해 다른 architecture의 helper/dylib가 ARM64 manifest로 배포될 수 있었습니다. | 빌드를 `aarch64-apple-darwin`으로 고정하고 앱 안의 Mach-O 파일을 순회 검사합니다. 새 Python gate도 thin/fat의 실제 slice CPU를 확인합니다. 이 소스·fixture 검사는 새 실제 번들 전체의 실행 검증을 대신하지 않습니다. |
| R6 | npm source 버전만 검사해 Tauri/Cargo 불일치를 채널 overlay로 숨길 수 있었습니다. | 공식 tag와 npm/Tauri/Cargo 세 manifest를 대조합니다. 각 manifest를 독립적으로 틀리게 만든 생산 prepare 회귀가 모두 mutation·draft 게시 전에 거부합니다. |
| R7 | receipt digest와 유효 서명만으로는 TAR envelope·앱 내용이 검증되지 않았습니다. 실제 publisher가 공개 서명 벡터의 payload인 문자열 `test`도 앱 archive로 게시하는 것을 확인했습니다. | 서명키 사용 전 Python streamed archive gate를 연결했습니다. 별도 macOS codesign·DMG·payload 동일성 gate도 추가 중입니다. Python 구현 및 아래 회귀는 완료했으며 실제 macOS gate 판정은 아직 이 문서에서 승인하지 않습니다. |

## R7 구현 및 독립 리뷰 후 수정

`verify-archive.py`는 파일을 추출하거나 실행하지 않습니다. 압축 파일 2GiB, 확장 스트림 4GiB, 물리 TAR header 20,000개, PAX/long-name metadata 1MiB를 제한합니다. 예상 `Buzz Korean.app` envelope, 경로·중복·macOS case/Unicode 충돌, safe symlink chain, plist identity/version, main과 실제 이름의 여섯 sidecar, owner 권한, 모든 Mach-O의 ARM64 slice를 검사합니다. path 깊이를 제한하고 모든 부모 경로가 정확한 이름의 명시적 디렉터리 항목인지 확인합니다. implicit directory 추론은 허용하지 않습니다. 실제 설치된 `/Applications/Buzz.app/Contents/MacOS`의 7개 바이너리를 생산 파서로 읽어 ARM64/MH_EXECUTE 형식 호환성을 확인했습니다. 이는 기존 공식 앱의 읽기 전용 형식 확인입니다.

별도 검토자 catalog_01의 첫 검토는 처음 세 결함을 찾았으며, 이후 macOS 추출 실행 증거로 R7d를 추가 확인했습니다. 각각 실패 테스트를 먼저 실행하고 수정했습니다.

- R7a: Python `TarFile.next`가 뒤쪽의 잘못된 checksum header를 EOF로 흡수했습니다. 완성된 valid bundle 바로 뒤 `X * 512`를 넣은 실제 TAR가 수락되는 RED를 확인했습니다. `InvalidHeaderError`·빈 header·잘린 header를 명시적인 검사 실패로 승격해 막았습니다.
- R7b: 다른 사용자에게만 execute 권한이 있는 파일도 통과했습니다. regular file owner-read, directory owner-read/execute, 필수 executable owner-execute를 요구합니다. `0401` helper 및 읽기·탐색 권한이 없는 파일/디렉터리의 네 RED를 GREEN으로 바꿨습니다.
- R7c: GNU sparse 확장 목록은 늦은 `member.sparse` 검사 전에 표준 라이브러리에서 할당됐습니다. GNU header를 parser 진입 전에 거부하고 PAX sparse 0.0/0.1/1.0 parser를 모두 선행 거부합니다. 표준 sparse allocator에 tripwire를 두고 GNU extension 16개 블록 및 각 PAX format의 실제 TAR로 네 RED → GREEN을 확인했습니다. Solaris PAX에도 metadata 크기 제한을 적용했습니다.

- R7d: `Contents/ALIAS → MacOS` symlink와 `Contents/alias/buzz` 일반 파일을 함께 넣으면 case-insensitive macOS에서 검증했던 helper가 덮어써졌습니다. catalog_01이 실제 임시 macOS 추출로 확인했습니다. 같은 TAR 및 NFC `café`/NFD `café` alias, 누락된 부모 항목의 세 RED를 재현했습니다. 모든 조상은 정확한 이름의 명시적 directory entry여야 하고 owner 권한 검사도 통과해야 합니다. 전역 NFD/casefold 경로 충돌 거부와 함께 정규형·대소문자 alias 조상 및 implicit directory 허용을 제거했습니다. 표준 전체-tree TAR와 framework symlink positive는 유지합니다.

## 실행 증거와 범위

| 명령/확인 | 결과 | 의미와 제한 |
| --- | --- | --- |
| `node --test tests/*.test.mjs` | 당시 136/136 통과, 34.12초 | R7a–c 및 새 native-gate 호출 계약을 추가하기 전 관리 도구 snapshot입니다. 최신 전체 검사로 재사용하지 않습니다. prepare의 실제 temp Git merge·source 정책과 publisher orchestration을 포함했습니다. |
| `node --test tests/*.test.mjs` R7c 시점 재실행 | 145/145 통과, 34.32초 | R7a–c 및 native-gate 호출·환경 fixture를 포함한 관리 도구 snapshot입니다. R7d 이전 snapshot이며 별도 작업 중인 실제 macOS verifier의 OS 실행 증거는 포함하지 않습니다. |
| `node --test tests/archive.test.mjs tests/publish-retry.test.mjs` | R7c 수정본 45/45 통과, 2.47초 | archive 40개, publisher 5개. Python gate와 R7a–c 수정, key 격리된 native gate의 호출 계약을 포함합니다. |
| `node --test tests/archive.test.mjs tests/publish-retry.test.mjs` R7d 재실행 | 47/47 통과, 2.23초 | archive 42개와 publisher 5개. 새로운 casefold/NFD alias 조상 및 명시적 부모 검사 회귀를 포함합니다. |
| R7d 직후 전체 관리 suite | exit 1, 새 native fixture의 AppleDouble envelope 거부 | 기존 아카이브 검사를 완화하지 않았습니다. 별도 worker가 raw TAR에서 `._Buzz Korean.app`/`com.apple.provenance`를 확인했고, 총괄은 `package-archive.mjs`의 `COPYFILE_DISABLE=1` 및 실제 xattr 회귀로 생산 archive 생성기를 수정했습니다. native worker freeze 후 전체 suite 재실행이 필요합니다. |
| 공개 minisign 벡터 기반 publisher fixture | 실제 publisher·receipt 검증·암호 검증 실행 | 새 개인키를 생성하거나 실제 GitHub에 쓰지 않습니다. 벡터가 서명하는 bytes는 `test`이므로 positive orchestration에서는 Python/native gate를 **명시적인 외부 fixture로 대체**합니다. 이 positive 결과로 올바른 앱 번들을 검증했다고 주장하지 않습니다. |
| 실제 Python gate를 연결한 publisher의 non-TAR 실패 | signer 0회, native gate 0회, 공개/업로드/main push 0회 | signing key가 없는 상태에서도 archive 거부가 먼저 발생함을 검사합니다. |
| native gate fixture | 최초·재시도 모두 호출, TAURI signing key/password 및 GH_TOKEN 상속 시 실패 | 호출·환경 경계만 검증합니다. 실제 codesign/hdiutil 동작의 증거가 아닙니다. |

현재 수정된 관리 스크립트의 최소성·구조는 9/10 수준입니다. 정확성은 실제 native gate 및 새 최종 번들 증거가 남아 있어 최종 승인하지 않습니다. 사용하지 않는 `downloadReleaseAsset` helper의 다운로드 byte 상한은 선택 개선으로 보고했습니다. 향후 호출부를 추가하면 다운로드 크기·프로세스 제한도 그 경로에서 검증해야 합니다.

## 아직 별도로 필요한 증거

새 macOS native gate의 독립 리뷰, native worker freeze 뒤 전체 관리 검사 재실행과 실제 codesign 확인, DMG read-only mount/verify 및 TAR 앱과의 비교·해제, 새 한국어판 전체 빌드·필수 CI, 실제 설치된 N → N+1 업데이트, 공식판과 한국어판의 OS keychain·앱 데이터·CLI 병행 실행/초기화, 네이티브 IME 및 사용자 직접 확인은 이 보고서가 대신 완료하지 않습니다. 위 production fixture는 실제 공개 릴리스나 사용자의 승인이 아닙니다.
