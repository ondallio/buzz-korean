# Bestie variant와 clipboard origin 독립 검토

2026-11-09에 `/root/link_review`가 동결된 `bestie.spec.ts`, root workflow의 optional-feature 단계와 다섯 spec의 일곱 clipboard origin 변경을 검토했습니다. 현재 범위에 차단 결함은 없습니다. 최소성·구조·정확성은 각각 9/10입니다.

앞선 검토에서 읽은 `AGENTS.md`, vision, testing 지침을 적용했습니다. 공개 배포에 포함하지 않는 기능은 공개 build에서 제외되는지 검증하고, 해당 기능의 기존 양성 검증은 포함되는 build에서 계속 실행하는 것이 제품 계약에 맞습니다. 이번 검토자는 이 보고서 외의 소스·workflow·dist를 수정하지 않았고 Git·remote·키 접근이나 전체 smoke 재실행을 하지 않았습니다.

## Bestie 검증의 보존

기존 양성 테스트는 작성자가 보존한 `.local/bestie-original-aa25447.spec.ts`에서 읽었습니다. 현재의 동일한 제목 테스트 body와 TypeScript AST를 독립 비교했습니다. `ts.forEachChild`로 순회한 모든 node kind, identifier, string·number literal이 정확히 같았습니다. 따라서 양성 body의 기존 assertion·interaction·screenshot·payload·대기 순서는 삭제하거나 약화하지 않았습니다. formatting 차이는 의미 없는 punctuation으로 한정됩니다.

새 variant 선택은 Vite config와 같은 `loadEnv("e2e", desktopRoot, "")` 및 `process.env.VITE_BUZZ_BESTIE ?? modeEnv.VITE_BUZZ_BESTIE`를 사용하며 정확히 `"1"`일 때 포함된 build로 판단합니다. 정적으로 결정한 compile variant에 따라 반대쪽 describe만 skip합니다. 화면에 기능이 없거나 실행이 실패했다는 이유로 테스트를 skip하는 분기는 없습니다.

public 음성 테스트는 저장된 override를 `true`로 두고도 기능이 나타나지 않는지 확인합니다. sidebar, DM, agent card, profile management, 실제 message row, experimental settings가 정상적으로 표시된 상태를 확인한 뒤 floating avatar·sidebar entry·card badge·profile action·message action·설정 toggle의 부재를 검사합니다. override가 여전히 `true`인지도 확인하므로 값을 지워 성공하는 테스트가 아닙니다.

잘못된 build를 제공하는 경우 필수 검사가 실패한다는 판단은 코드에 근거합니다. public 검사를 internal UI에 실행하면 floating avatar의 `toHaveCount(0)`에서 실패합니다. internal 검사를 public UI에 실행하면 양성 body의 floating avatar `toBeVisible()`에서 실패합니다. 이 검토자가 의도적인 cross-variant E2E 실패 실행을 추가로 돌린 것은 아닙니다.

## Workflow 연결

job 기본값은 `VITE_BUZZ_BESTIE=0`입니다. 원래 `pnpm test:e2e:smoke` 이후 추가한 필수 단계는 별도 step env를 `1`로 지정하고 `pnpm build:e2e`를 먼저 실행한 뒤 원래 smoke project에서 `bestie.spec.ts`를 실행합니다. `continue-on-error`나 실패를 삼키는 조건은 없습니다. 따라서 양성 검사는 단순히 생략되는 대신 포함된 실제 bundle에서 실행됩니다.

그다음 최종 release 단계는 `scripts/build-release.mjs`를 실행합니다. 이 script가 모든 build subprocess에 전달하는 환경에 `VITE_BUZZ_BESTIE: "0"`을 명시합니다. 내부 기능 테스트용 build 설정이 최종 공개 artifact로 이어지는 경로는 이번 변경에 없습니다.

## Clipboard origin 변경

다섯 spec의 일곱 `grantPermissions` 호출에서 고정된 `http://127.0.0.1:4173` 대신 `new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin`을 사용합니다. 원래 preview port 4173과 private port 4381 모두 실제 project baseURL에 clipboard 권한을 부여합니다. navigation 이전에도 올바른 origin을 구하므로 기존 권한 부여와 navigation 순서를 유지합니다.

작성자가 보존한 `.local/<name>-original-aa25447.spec.ts` 원본 다섯 개를 현재 파일과 독립 AST 비교했습니다. 위의 정확한 origin 표현식만 같은 표식으로 정규화한 뒤 나머지 전체 node kind와 identifier·모든 text literal 값을 비교했습니다. 다섯 파일이 모두 일치했습니다.

| 파일 | 정확한 origin 치환 수 |
| --- | --- |
| `composer-selection-formatting.spec.ts` | 1 |
| `invite-link-copy.spec.ts` | 1 |
| `messaging.spec.ts` | 3 |
| `spoiler.spec.ts` | 1 |
| `community-rail.spec.ts` | 1 |

총 7개입니다. 모든 기존 assertion, clipboard payload, platform shortcut, 대기, bridge 설정과 navigation 순서가 보존됐습니다. 예를 들어 composer의 rich HTML·plain text ClipboardItem, macOS·Windows/Linux shortcut, `read_clipboard_text` 관찰과 formatting element 부재 검사는 그대로입니다. 앱 동작이나 테스트의 성공 조건을 바꾸는 수정이 아닙니다.

## 직접 확인한 증거와 한계

Hermit을 활성화하고 설치된 Playwright CLI를 직접 호출하여 기존 private full-smoke config의 `bestie.spec.ts`만 `--list --reporter=json`으로 수집했습니다. 실제 앱이나 서버는 실행하지 않았습니다.

| compile env | 기존 양성 | 새 public 음성 |
| --- | --- | --- |
| `VITE_BUZZ_BESTIE=0` | 정적 skip | required passed 기대 |
| `VITE_BUZZ_BESTIE=1` | required passed 기대 | 정적 skip |

두 경우 모두 정확히 두 테스트를 수집했고 expected status가 위와 같았습니다. 전체 smoke와 중복 실행하지 않았습니다.

작성자의 실제 focused 실행 receipt도 읽었습니다.

- `.local/bestie-public-report.json`은 public 음성 1 passed, 반대 variant 1 skipped, unexpected 0, flaky 0입니다.
- `.local/bestie-internal-report.json`은 기존 양성 1 passed, 반대 variant 1 skipped, unexpected 0, flaky 0입니다. 전체 run 시간은 약 10.3초입니다.
- 최종 `.local/clipboard-origins-report.json`은 일곱 origin 사용처를 포함한 focused 테스트 11 passed, skipped 0, unexpected 0, flaky 0입니다. `invite-link-copy`의 beforeEach는 네 case에 적용됩니다. 전체 run 시간은 약 12.7초입니다. 앞선 두 platform만의 receipt를 최종 범위 검증으로 대신하지 않았습니다.

위 실제 동작 실행은 작성자 receipt이며 이 검토자가 재실행한 E2E 결과와 구분합니다. 전체 broad smoke와 전체 CI 완료 여부는 총괄의 별도 최종 기록이 필요합니다. 이번 검토는 배포 완료나 사용자 직접 확인을 인증하지 않습니다.
