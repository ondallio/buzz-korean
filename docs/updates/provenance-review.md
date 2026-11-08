# 원본 Git 기준 조사

조사 시점은 2026-11-08 23:51 UTC입니다. 작업 범위는 읽기 전용 조사이며, 이 문서만 작업 폴더에 작성했습니다. 기존 앱 소스, 기존 폴더의 Git 메타데이터, 원격 저장소는 변경하지 않았습니다. 아래 수치는 조사 당시 파일을 기준으로 합니다.

기존 소스의 재현 가능한 공식 기준으로 `ff6ab96e42b1fc64bfc1236104478a84e11b5abd`를 확인했습니다. 백업의 공식 파일 3,244개가 모두 이 커밋의 Git blob과 일치합니다. 현재 폴더의 데스크톱 외 공식 파일 3,130개도 모두 일치합니다. 바로 이전 커밋과 다음 커밋의 변경 파일은 현재 파일과 달라, 데스크톱 파일만 같은 인접 커밋과도 구분됩니다.

이는 파일 내용으로 검증한 기준 커밋입니다. 사라진 원래 `.git`의 브랜치명, 인덱스, 원격 설정, reflog 또는 다운로드 경로를 복구했다는 뜻은 아닙니다. 기존 폴더에 `.git`을 초기화하거나 추정한 원격을 연결하지 않았습니다.

## 확인된 공식 기준

| 항목 | 관측값 |
| --- | --- |
| 공식 원격 | `https://github.com/block/buzz.git` |
| 독립 조사용 clone | `/private/tmp/buzz-upstream-20261109` |
| clone 상태 | `upstream` 원격, `blob:none` 필터, shallow 아님 |
| 내용 기준 커밋 | `ff6ab96e42b1fc64bfc1236104478a84e11b5abd` |
| 커밋 tree | `9a46edd5fa6a326ec66aecd6e49f0262b41f99be` |
| 커밋 부모 | `972e89ac8972552f68efca53349f86104f6c7e0e` |
| 커밋 시각 | `2026-11-03T02:50:08Z` |
| 커밋 제목 | `fix(mobile): drop the # from Solo chat names in push notifications (#8955)` |
| 공식 main과 관계 | 조사 시점 `upstream/main`의 조상임. `merge-base --is-ancestor` 종료 코드 0 |
| 조사 시점 main | `4bfe60197e8c390a8701053228cd50c5391f37d3` |

공식 커밋은 [block/buzz의 해당 커밋](https://github.com/block/buzz/commit/ff6ab96e42b1fc64bfc1236104478a84e11b5abd)에서 식별할 수 있습니다. 위 값은 코디네이터가 공식 URL에서 준비한 clone의 실제 Git 객체와 ref를 읽어 확인했습니다. 서명 검증에 의한 별도 신뢰 보장은 주장하지 않습니다.

## 백업 무결성과 범위

`docs/localization/recovery/baseline.tar.gz`의 일반 파일 3,258개를 압축 해제 없이 읽었습니다. 모든 SHA-256이 `baseline-sha256.json`의 3,258개 항목과 일치했습니다. 누락, 추가 일반 파일, 해시 불일치는 각각 0개입니다. 나머지 tar 항목은 디렉터리 184개와 symlink 1개입니다. symlink는 일반 파일 SHA-256 manifest의 분모에 포함하지 않았으며, 전체 공식 경로 비교에서는 symlink의 대상 문자열과 Git mode를 함께 검사했습니다.

| 복구 자료 | SHA-256 |
| --- | --- |
| `baseline.tar.gz` | `256327d6e0b6dfc1e8a56cd4fa12233fbf6c78d0d6d9be11a5b49a221fc20629` |
| `baseline-sha256.json` | `95f8f334afe5a4a69b316f53574f8fbb093fac63c8f3cf561972c4d51da9ebf5` |

백업에는 `desktop/src` 2,528개, `desktop/src-tauri` 485개, `desktop/tests` 208개, `desktop/scripts` 19개, 데스크톱 package/index/vite 파일 3개, 루트 `pnpm-lock.yaml` 1개, 기존 로컬 verify-desktop 스킬 파일 14개가 들어 있습니다. 전체 저장소 또는 사용자 데이터의 백업은 아닙니다.

`.claude/skills/verify-desktop/node_modules` symlink의 대상은 `../../../desktop/node_modules`입니다. 이는 로컬 실행 환경의 의존성 연결이며 공식 Git 경로 비교 대상이 아닙니다. 공개 소스 반영 시 의존성 디렉터리를 포함하는 근거로 사용하면 안 됩니다.

공식 파일 3,244개의 tar mtime은 모두 `1793674208`입니다. 이는 위 공식 커밋 시각과 정확히 같습니다. mtime만으로 출처를 확정하지 않았고, Git blob 지문과 전체 비데스크톱 파일 비교를 함께 사용했습니다.

Git blob 지문은 각 파일의 실제 바이트에 `blob <바이트 수>\0` 헤더를 붙여 SHA-1을 계산했습니다. 작업 폴더에서 `git hash-object -w`를 실행하지 않았습니다. 따라서 기존 폴더의 Git 객체를 만들지 않고도 공식 tree의 blob ID와 비교할 수 있었습니다.

## 후보 비교

동일한 3,258개 백업 파일을 후보별 공식 tree와 비교했습니다.

| 후보 | 같은 blob | 다른 blob | 공식 tree에 없음 |
| --- | ---: | ---: | ---: |
| 내용 기준 `ff6ab96e42b1fc64bfc1236104478a84e11b5abd` | 3,244 | 0 | 14 |
| `desktop-v0.5.28` | 3,112 | 117 | 29 |
| 릴리스 기록의 `base_sha`인 `5142cf6b2a0f44686eeda1ed07905ee3560fd78e` | 3,111 | 118 | 29 |
| 조사 시점 `upstream/main` | 3,206 | 38 | 14 |

내용 기준 후보에 없는 14개는 전부 `.claude/skills/verify-desktop/` 아래의 기존 로컬 검증 도구입니다. 공식 파일과 내용이 다른 것으로 계산하지 않았습니다. 기존 로컬 도구이므로 보존하고, 공개 저장소에 포함할지는 출처와 필요성을 별도로 검토해야 합니다.

판별에 사용한 원본 파일 예시는 다음과 같습니다.

| 백업 경로 | Git blob SHA-1 |
| --- | --- |
| `desktop/package.json` | `0d3ed766732217e0bce23c9e14f7278da742c7e7` |
| `desktop/src/app/App.tsx` | `581987ed610645870666d98d8c5aded97cc340dd` |
| `desktop/src-tauri/src/lib.rs` | `4497eb78e563b33601290174b8d176f48ca2b099` |
| `pnpm-lock.yaml` | `3847cdc5e7dc317f124e954aad4fd227c274e6bb` |

## 인접 커밋과 전체 경로 검증

후보 tree의 공식 경로는 6,570개입니다. 현재 폴더에 모두 존재하며 실행 비트와 symlink를 포함한 Git mode 차이는 0개입니다. 바이트 동일 파일은 5,853개이고 변경 파일은 717개입니다. 변경 717개는 전부 `desktop/` 아래에 있습니다. 데스크톱 외 3,130개는 모두 후보와 바이트 단위로 같습니다.

데스크톱 변경 717개 중 714개는 원본 백업에 있습니다. 해당 백업 바이트는 공식 후보와 전부 같습니다. 원본 백업에 없는 변경 파일은 `desktop/biome.json`, `desktop/test-loader-hooks.mjs`, `desktop/tsconfig.json`입니다.

두 supplemental 파일은 공식 후보와 정확히 일치합니다.

| Supplemental 경로 | 공식 후보와 같은 Git blob SHA-1 |
| --- | --- |
| `recovery/supplemental-before-protected-split/desktop/test-loader-hooks.mjs` | `bdd15c3ae12b5a419395fff4dbe514793dcf8f20` |
| `recovery/supplemental-before-protected-split/desktop/tsconfig.json` | `02e86e194d31d19c1a290374ed6d1b42acf6b8fa` |

Supplemental은 문서상 원래부터 사전 백업이 아닌 수정 취소용 checkpoint입니다. 공식 객체와의 이번 비교가 새 근거이며, 이 비교 없이 사전 원본이라고 간주하지 않았습니다.

`desktop/biome.json`도 공식 후보에서 이미 추적하는 파일입니다. 공식 blob은 `12e778e4a925e415ac62e95525a5f4860b321c7a`이며 내용은 다음과 같습니다.

```json
{
  "extends": ["../biome.json"]
}
```

현재 파일은 여기에 locale hook의 의존성 검사 설정을 추가한 상태입니다. 기존 recovery 문서의 "added file" 분류는 초기 로컬 백업에 없다는 뜻으로만 해석해야 합니다. 검증된 공식 Git 기준으로 옮길 때에는 새 파일이 아닌 기존 추적 파일의 수정으로 기록해야 합니다. 원본 백업에 이 파일이 없었다는 한계는 그대로 남깁니다.

바로 이전 커밋은 같은 데스크톱 파일을 공유하지만, 아래 네 파일의 blob이 현재 파일과 다릅니다. 현재 파일은 후보의 네 blob과 모두 일치합니다.

| `mobile/ios/BuzzPushKit/` 아래 경로 | 후보와 현재의 Git blob SHA-1 |
| --- | --- |
| `Sources/BuzzPushKit/BuzzPushNotificationResolver.swift` | `3def120389df83291b044d45145a30c8790a3edf` |
| `Sources/BuzzPushKit/BuzzPushPresentationCache.swift` | `d6f0b7cc3108e6fe017929f000ffef1eda049103` |
| `Tests/BuzzPushKitTests/BuzzPushNotificationResolverTests.swift` | `ad0c6cdc783f96cb8f2f4bd4ff9598edb9409a8f` |
| `Tests/BuzzPushKitTests/BuzzPushPresentationCacheTests.swift` | `5619f4bd99811225822aacb017b3edf4a91145b1` |

main의 다음 first-parent 커밋은 `76bc66acfcaebda487813b2495adf8fec82c0b8a`입니다. 그 커밋이 바꾸는 `mobile/lib/features/channels/channels_provider_lifecycle.dart`, `mobile/test/features/channels/channels_sync_journey_test.dart`, `mobile/test/helpers/fake_relay.dart` 세 파일은 현재 파일과 모두 다릅니다. 따라서 이전 또는 다음 스냅샷을 같은 데스크톱 버전이라는 이유로 잘못 선택하지 않았습니다.

## 패키지 버전과 릴리스 기준의 구분

기존 `.release/desktop-candidate.json`에는 버전 `0.5.28`, `base_sha` `5142cf6b2a0f44686eeda1ed07905ee3560fd78e`, 태그 `desktop-v0.5.28`이 기록되어 있습니다. 패키지와 Tauri 설정도 `0.5.28`입니다. 이 기록은 릴리스 생성 당시의 기록이며 현재 다운로드 소스의 HEAD를 가리키는 archival 메타데이터가 아닙니다.

공식 `desktop-v0.5.28`은 `f87c10895ea35a9a2cea629fef1d7532a3fecbc5`로 해석되며 커밋 시각은 `2026-10-09T19:25:59Z`입니다. [공식 릴리스 커밋](https://github.com/block/buzz/commit/f87c10895ea35a9a2cea629fef1d7532a3fecbc5)과 이번 내용 기준은 다릅니다. 현재 한글화는 그 태그 이후 main 스냅샷에 적용되어 있으므로, `0.5.28`이라는 버전 문자열만 보고 태그 위에 결과를 덮어쓰면 upstream 변경까지 한글화 변경으로 섞이게 됩니다.

기존 폴더에서 `.git_archival*` 파일을 찾지 못했습니다. `.gitattributes`에는 LF 정규화만 있고 `export-subst` 또는 commit 치환 규칙이 없습니다. 원래 Git HEAD를 직접 선언하는 로컬 메타데이터는 확인하지 못했습니다.

## 후속 통합에 사용할 근거와 한계

유지보수용 작업 트리를 만들 때는 검증된 공식 커밋 `ff6ab96e42b1fc64bfc1236104478a84e11b5abd`를 시작점으로 삼을 수 있습니다. 기존 한글화 폴더를 보존한 채 별도 작업 트리에 현재 결과를 선택적으로 반영하면, upstream 소스와 한글화 변경을 Git 차이로 검토할 수 있습니다. 실제 작업 트리 생성, 공개 저장소 연결 및 배포 설계는 코디네이터가 수행합니다.

원래 로컬 Git 메타데이터를 복구한 것은 아닙니다. 파일 내용과 원본 백업의 대응 관계를 검증한 것입니다. 원래 다운로드 URL, 원래 브랜치명, 인덱스 상태, 커밋 서명 또는 사용자 작성 이력은 이 조사로 확인할 수 없습니다. 원본 백업에 포함되지 않은 Biome 설정의 사전 바이트도 단독 백업으로 증명하지 못합니다. 이러한 한계를 숨기기 위해 추정 이력을 생성하지 않았습니다.

원본 기준의 확인은 빌드나 실제 업데이트 설치 검증을 대신하지 않습니다. 네이티브 IME, OS별 배포, 서명, updater 호환성 및 사용자 확인 상태를 완료로 바꾸지 않았습니다.

임시 재검증 자료는 다음 경로에 있습니다. 이 문서에는 주요 수치와 재현 방법을 남겨 임시 파일에만 의존하지 않게 했습니다.

- `/private/tmp/buzz-baseline-git-fingerprints-20261109.json`에 백업 파일별 SHA-256, Git blob SHA-1, 크기와 mode가 있습니다.
- `/private/tmp/buzz-baseline-candidate-comparison-20261109.json`에 백업과 후보의 차이 목록이 있습니다.
- `/private/tmp/buzz-current-candidate-alltracked-comparison-20261109.json`에 전체 공식 경로의 현재 비교 결과가 있습니다.
- `/private/tmp/buzz-upstream-candidate-tree-20261109.z`에 공식 후보의 `ls-tree -r -z` 결과가 있습니다.

읽기 전용 재검증의 핵심 명령은 다음과 같습니다. Git 명령 전에 저장소의 Hermit 환경을 활성화합니다.

```sh
cd /Users/stan/orca/buzz-main-kor
. ./bin/activate-hermit
git -C /private/tmp/buzz-upstream-20261109 show -s --format='%H %T %P %cI %s' ff6ab96e42b1fc64bfc1236104478a84e11b5abd
git -C /private/tmp/buzz-upstream-20261109 ls-tree -r -z ff6ab96e42b1fc64bfc1236104478a84e11b5abd
git -C /private/tmp/buzz-upstream-20261109 rev-parse desktop-v0.5.28^{commit}
git -C /private/tmp/buzz-upstream-20261109 merge-base --is-ancestor ff6ab96e42b1fc64bfc1236104478a84e11b5abd upstream/main
```

압축을 기존 폴더에 풀지 않고 파일 지문을 다시 계산하는 방법은 다음과 같습니다.

```python
import hashlib
import json
import tarfile

manifest = json.load(open("docs/localization/recovery/baseline-sha256.json"))
with tarfile.open("docs/localization/recovery/baseline.tar.gz", "r:gz") as archive:
    for member in archive:
        if not member.isfile():
            continue
        path = member.name.removeprefix("./")
        data = archive.extractfile(member).read()
        assert hashlib.sha256(data).hexdigest() == manifest[path]
        header = b"blob " + str(len(data)).encode() + b"\0"
        print(path, hashlib.sha1(header + data).hexdigest())
```
