# macOS 번들 검증·아카이브 생성 독립 검토

2026-11-09, Asia/Seoul. 검토자 `/root/locale_design`은 부모와 같은 모델을 상속했습니다. 검토 대상은 inventory worker가 작성한 `scripts/verify-native-bundle.mjs`, `tests/native-bundle.test.mjs` 및 총괄의 `scripts/package-archive.mjs`, `tests/tar-build.test.mjs`입니다. 생산 호출 맥락을 확인하기 위해 `build-release.mjs`의 plist overlay·서명·archive 생성 순서도 읽었습니다. Python archive gate와 네이티브 identity 중 검토자 본인이 작성한 부분을 독립 승인한 것으로 계산하지 않습니다.

판정: 이 범위의 정상적인 앱·업데이트 패키징 동작에서 차단할 구체적 정확성 결함은 발견하지 않았습니다. 최소성 9/10, 구조 9/10, 정확성 9/10입니다. 이는 아래의 소스·회귀 범위에 대한 판단이며 첫 실제 한국어판 macOS 번들의 검증 결과를 대신하지 않습니다.

## 확인한 계약

- 입력 archive와 DMG를 개인 전용 임시 디렉터리로 복사합니다. 입력은 2GiB 이하 regular file이어야 하고, symlink를 따라 열지 않으며 복사 중 파일 상태 변화도 검사합니다. 검증 프로세스에 signing key/password 또는 GitHub token이 있으면 시작 전에 거부합니다.
- 개인 복사본에 Python archive gate를 먼저 실행한 뒤 해제합니다. 앱 코드를 호출하지 않습니다. 이름 `Buzz Korean`, identifier `io.github.ondallio.buzz-korean`, 요청 버전, 단일 `buzz-korean` URL scheme를 확인합니다.
- archive 앱에 `codesign --verify --deep --strict`를 실행합니다. DMG에는 `hdiutil verify`를 먼저 실행하고 `-readonly -nobrowse -noautoopen -plist -mountpoint`로 개인 경로에 마운트합니다. 성공 plist에 보고된 단일 mountpoint도 실제 요청 경로와 대조합니다.
- archive 앱과 DMG 안의 `Buzz Korean.app`에서 모든 앱 경로의 type·mode·size·symlink target 및 모든 regular-file SHA-256이 같아야 합니다. 각 파일과 전체 tree의 크기, 개수·깊이·경로 길이를 제한하고 파일을 나눠 읽습니다. DMG 바깥쪽 Finder 배경·Applications 링크 등 정상 설치용 레이아웃은 앱 payload 비교 대상이 아닙니다.
- 마운트된 앱의 identity와 code signature도 재확인합니다. attach 일부 성공, 반환 plist 오류, 앱 차이, signature 실패에서도 detach를 시도합니다. detach 실패는 성공으로 바꾸지 않고 개인 디렉터리를 보존해 경로를 오류에 남깁니다. 실제로 마운트됐을 수 있는 경로를 recursive 삭제하지 않습니다. cleanup 실패와 본래 실패가 함께 있으면 둘 다 전달합니다.
- `createUpdaterArchive`는 argument 배열로 `tar`를 실행하고 child 환경의 `COPYFILE_DISABLE=1`을 고정합니다. root build는 서명 전에 별도 Info.plist overlay를 구성하고, 최종 서명 검증 후 archive를 생성합니다. 검토한 순서에는 서명 뒤 plist를 고치는 문제가 없습니다.

## 직접 실행한 검사

```sh
node --test tests/native-bundle.test.mjs tests/tar-build.test.mjs
```

25/25 통과, 4.21초입니다. native verifier 24개와 archive 생성기 1개입니다.

native 회귀는 실제 생산 verifier, 실제 Python gate, 실제 TAR 생성·해제와 파일시스템 비교를 사용합니다. `codesign`과 `hdiutil`만 명시적 command double입니다. 일치하는 앱, 파일 내용·권한·링크·경로 차이, 크기·개수 한계, 두 signature 실패, DMG verify 실패, partial attach, 잘못된 attach plist, detach/cleanup 실패, 이름·scheme·버전 불일치와 credential 거부를 확인합니다. 앱 resource 실행 여부를 감지하는 marker가 생성되지 않는지도 검사합니다. CLI의 지원하지 않는 OS/architecture 거부도 포함합니다.

archive 생성기 회귀는 이 Mac의 실제 `xattr`로 파일에 metadata를 붙이고 실제 생산 생성기로 TAR를 만든 뒤 Python으로 raw member 목록을 읽습니다. 결과는 `Buzz Korean.app`과 내부 fixture 두 항목뿐이었고 AppleDouble 파일은 없었습니다. private 임시 파일은 검사 후 정리합니다.

## 선택 개선과 남은 실행 증거

선택 개선: native command double이 `codesign`의 `--verify --deep --strict` 인자 전체를 더 엄격하게 검사하면 향후 flag 변경도 회귀에서 직접 잡을 수 있습니다. 현재 생산 인자는 올바르며 서명 검사 호출 자체의 제거·오류 무시는 기존 실패 시나리오가 보호합니다. 이 제안은 차단 사항이 아닙니다.

실제 `codesign`, `hdiutil verify`, read-only attach/detach가 새 한국어판의 실제 app/DMG에 대해 성공하는지는 첫 macOS 빌드에서 확인해야 합니다. 위 25개 통과는 실제 DMG 마운트나 새 앱 실행을 했다는 증거가 아닙니다. 초기 설치와 N→N+1 교체, Gatekeeper·IME·사용자 직접 확인도 이 검토에서 완료 처리하지 않았습니다. 외부 게시, 사용자 앱 실행, 기존 설치 변경은 하지 않았습니다.
