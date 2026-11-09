# macOS 권한 문구 리소스 독립 검토

검토일은 2026-11-09입니다. `/root/link_review`가 `/Users/stan/orca/buzz-korean`의 동결된 구현을 읽고 검사했습니다. 현재 범위에 차단 결함은 없습니다. 최소성·구조·정확성은 각각 9/10입니다.

## 범위와 계약

앞선 검토에서 읽은 `app/AGENTS.md`, `app/VISION.md`, 관련 `VISION_SOVEREIGN.md`, `VISION_PROJECTS.md`, `app/TESTING.md`의 제품·검증 계약을 적용했습니다. 이번에는 `scripts/prepare-plist.py`, 두 `locales/macos.*.json`, `tests/macos-localizations.test.mjs`, `channel-config.mjs`, `build-release.mjs`, `verify-native-bundle.mjs`와 channel/native bundle 테스트를 검토했습니다.

한국어 배포판의 macOS 권한 설명을 번역하는 변경입니다. 사용자 identity·데이터·프로토콜을 바꾸거나 새 권한을 요청하는 변경이 아닙니다. 상위 소스의 영어 설명은 base Info.plist와 영어 리소스에 유지합니다. 원본 `/Users/stan/orca/buzz-main-kor`, 앱 소스, 개인 키, OS 권한과 기본 handler는 접근하거나 수정하지 않았습니다. 이 보고서 외의 구현 파일은 수정하지 않았으며 Git·GitHub 명령도 실행하지 않았습니다.

## 구현 판단

- preparation script는 세 가지 검토된 `NS*UsageDescription`만 허용합니다. 상위 권한 key 집합이나 영어 문장이 달라지면 output 생성 전에 실패합니다. 두 catalog는 정확한 key 집합과 비어 있지 않은 문자열을 요구합니다. 한국어 문구는 마이크의 허들·음성 메모, 카메라의 움직이는 아바타 녹화, 선택적인 컴퓨팅 공유·로컬 릴레이 연결이라는 기존 영어 의미를 보존합니다.
- localization을 요청한 경로는 base에 `CFBundleDevelopmentRegion=en`, `CFBundleLocalizations=[en, ko]`를 선언하고 각 언어의 `InfoPlist.strings`를 binary plist로 생성합니다. 기존 두 인자 CLI는 영어 base와 관련 없는 metadata를 보존합니다. 출력은 파일별 임시 파일과 atomic replace로 기록하며 오류를 성공으로 바꾸지 않습니다. 여러 파일 중 쓰기가 실패해도 preparation과 release build가 실패하므로 부분 결과가 정상 배포로 진행하지 않습니다.
- 실제 release script가 절대 경로의 localization 디렉터리를 preparation에 전달하고 같은 경로를 Tauri config에 전달합니다. config의 목적지는 `Resources/en.lproj/InfoPlist.strings`, `Resources/ko.lproj/InfoPlist.strings`입니다. 설치된 CLI `config.schema.json`과 `tauri-utils-2.9.3/src/config.rs`의 `MacConfig.files` 설명은 목적지가 `Contents` 기준임을 명시합니다. 따라서 최종 위치는 `Contents/Resources/<locale>.lproj/InfoPlist.strings`입니다.
- native verifier는 추출한 archive 앱과 읽기 전용으로 mount한 DMG 앱 양쪽에서 언어 선언, 영어 base 문구, 두 localized resource의 정확한 key와 값을 현재 검토된 catalog와 비교합니다. metadata는 bounded regular file로 읽고 plist로 해석합니다. 누락되거나 다른 값이면 실패합니다. 기존 양쪽 bundle의 파일·mode·symlink·내용 비교도 유지됩니다. 새 앱 실행 없이 리소스를 검사합니다.

실제 production 목적지와 verifier 목적지가 일치하며, 영어 fallback과 한국어 번역을 같은 검증된 catalog로 준비·확인합니다. 현실적인 correctness·security·합의된 계약 위반은 발견하지 못했습니다.

## 직접 실행한 증거

새 관리 저장소의 Hermit을 활성화한 뒤 실행했습니다.

```sh
node --test tests/macos-localizations.test.mjs \
  tests/channel-config.test.mjs tests/native-bundle.test.mjs
```

결과는 **41/41 통과**입니다. source 권한 추가·영어 변경, 누락·빈 값·예상하지 않은 catalog key, 기존 output 보존, 실제 resource 위치, 리소스 없는 native bundle의 거부를 포함합니다. bundle 검사는 실제 production verifier와 Python archive validator를 사용하지만 `codesign`·`hdiutil`은 테스트 도구로 대체합니다. 실제 서명 앱이나 DMG를 새로 빌드한 증거는 아닙니다.

기존 `.local/native-localization-smoke/Metadata Proof.bundle`도 직접 확인했습니다. binary resource 두 개가 현재 catalog와 정확히 같고 base 영어와 언어 선언도 일치했습니다. 다음 Apple Foundation 실행을 독립 재실행했습니다.

```sh
/usr/bin/swift .local/native-localization-smoke/read.swift \
  '.local/native-localization-smoke/Metadata Proof.bundle'
```

Foundation의 `Bundle.localizedString`은 한국어 microphone 설명을 그대로 반환했습니다. 이 script는 `ko.lproj` bundle을 명시적으로 선택합니다. 결과의 `preferred` 값은 `[en, en]`입니다. 따라서 이 증거는 실제 Apple Foundation이 생성한 binary `InfoPlist.strings`를 읽는다는 확인이며 OS가 한국어를 기본 선택하거나 실제 권한 dialog를 한국어로 표시했다는 증거가 아닙니다.

## 남은 검증

실제 Tauri release bundle의 최종 resource 배치·서명·archive/DMG 동등성은 release gate에서 확인해야 합니다. 한국어 macOS 환경 또는 앱별 언어 설정에서 실제 마이크·카메라·로컬 네트워크 권한 dialog는 실행하지 않았습니다. 시스템 권한을 reset하거나 앱을 실행하여 요청을 발생시키지 않았습니다. 사용자 직접 확인과 전체 release 완료를 이 검토가 대신하지 않습니다.
