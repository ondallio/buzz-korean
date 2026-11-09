# Production 정규식 호환성 독립 검토

2026-11-09에 `/root/link_review`가 verified official import `397f187`의 `app/desktop/src/`와 현재 working tree를 비교했습니다. 최초 감사에서 실제 동작을 바꾼 정규식 두 개를 확인했고 즉시 총괄에게 전달했습니다. 아래는 최초 감사와 수정 후 검증 결과입니다. 구현 수정과 회귀 검사는 별도 작업자가 담당했습니다.

이 검토자는 소스·Git·remote를 수정하지 않았습니다. Git 읽기 전에 관리 저장소의 Hermit을 활성화했고 `git ls-tree`와 한 번의 `git cat-file --batch`로 원본 blob을 읽었습니다. 원본 앱 `/Users/stan/orca/buzz-main-kor`와 개인 키는 접근하지 않았습니다. 작성 파일은 이 보고서뿐입니다.

## 검사 방법과 범위

실제 설치된 TypeScript parser로 `.ts`와 `.tsx`를 파싱한 뒤 `SyntaxKind.RegularExpressionLiteral`의 원문 token을 수집했습니다. 문자열과 주석을 grep한 결과를 정규식이라고 취급하지 않았습니다. 파일별 token multiset으로 원본과 현재 working tree를 비교하여 중복 개수도 확인했습니다. `__tests__`, `__mocks__`, test-fixtures 디렉터리와 `.test`, `.jsdom-test`, `.spec` TS 파일은 production 비교에서 제외했습니다.

원본에 있는 1,743개 production 경로를 비교했습니다. 해당 파일들의 정규식 token은 원본 554개, 최초 현재 상태 554개였습니다. 숫자가 같아도 두 개의 의미 손상이 있었으므로 총 개수만 통과 조건으로 사용하지 않았습니다. 기존 파일 중 차이가 있는 경로는 일곱 개였습니다. 새 production 파일도 별도로 파싱하여 추가된 정규식 목록을 확인했습니다. 문자열로 만든 `new RegExp`는 이번 literal audit 범위가 아닙니다.

## 최초 차단 결함

| 경로 | 공식 원본 | 손상된 working tree | 실제 영향과 수정 |
| --- | --- | --- | --- |
| `features/projects/ui/ProjectReadmePanel.tsx` | 90행 `/\n{3,}/g` | 92행 `/\n{3 }/g` | README HTML을 Markdown으로 바꾸며 세 개 이상의 개행을 두 개로 줄이는 처리가 동작하지 않습니다. 예시 `first\n\n\nsecond`가 그대로 남습니다. 공식 quantifier를 복원하고 실제 normalizer의 개행 collapse 회귀를 검사해야 합니다. |
| `shared/ui/rich-link-preview-attachment.tsx` | 143행 `/\n{2,}/` | 153행 `/\n{2 }/` | 링크 preview 설명의 빈 줄 경계가 paragraph로 나뉘지 않습니다. 예시 `first\n\nsecond`가 두 문단 대신 하나의 paragraph로 남습니다. 공식 quantifier를 복원하고 실제 렌더링에서 두 문단을 확인해야 합니다. |

위 경로 앞에는 모두 `app/desktop/src/`가 붙습니다. 두 손상된 pattern은 JavaScript에서 syntax error가 아닙니다. 공백이 포함된 중괄호는 원래의 반복 quantifier로 처리되지 않으므로 compiler와 formatting 통과만으로는 발견할 수 없습니다. 감사자가 실제 current AST에서 얻은 literal과 공식 literal을 실행하여 위의 다른 결과를 직접 확인했습니다. 기능 보존 계약에 맞지 않는 구체적 결함입니다.

## 나머지 기존 파일의 모든 정규식 차이

| 경로 | 제거·추가 | 판단 |
| --- | --- | --- |
| `features/agents/ui/agentSessionTranscriptHelpers.ts` | 570행 `/^Buzz event(?::\s*(.*))?$/` 추가 | 기존 prompt section title을 보존하면서 표시용 buzz-event kind와 type metadata를 구합니다. 원래 regex를 손상한 변경이 아닙니다. |
| `features/messages/lib/dateFormatters.ts` | 49행 `/^(?:오전|오후)[\s\u00a0\u202f]*/` 추가 | 기존 영어 AM/PM suffix 제거에 한국어 prefix 제거를 더합니다. |
| `shared/lib/datetime.ts` | 60행 `/^(AM|PM)$/i` 추가 | 한국어 locale에서 부분 ICU가 반환한 영어 dayPeriod만 번역하는 표시 fallback입니다. |
| `features/workflows/ui/WorkflowDetailPanel.tsx` | 기존 359·380행 `/_/g` 두 개 제거 | status와 failure 표시 함수를 `workflowRunPresentation.ts`로 이동했습니다. underscore를 공백으로 바꾸는 처리는 해당 helper에 남습니다. |
| `features/workflows/ui/WorkflowRunTrace.tsx` | 기존 13행 `/_/g` 하나 제거 | 위와 같은 공통 status helper를 사용합니다. |

이 다섯 경로의 production context를 읽었습니다. 같은 기존 정규식의 세 번째 손상이나 추가 차단 결함은 찾지 못했습니다.

## 새 파일의 정규식

다음 새 production 파일들에서 총 11개를 확인했습니다.

- `features/agents/ui/agentSessionPresentation.ts`는 canonical lifecycle·plan·permission 표시 문장을 구분하는 다섯 pattern을 추가합니다. `Triggered by`, command count, plan progress·steps, Approved·Denied outcome을 대상으로 합니다.
- `features/workflows/ui/workflowRunPresentation.ts`는 이동된 status·error underscore 처리의 `/_/g` 두 개를 포함합니다.
- `shared/i18n/LocalizedMessage.tsx`는 rich interpolation sentinel을 나누고 해당 index를 구하는 두 개를 포함합니다.
- `shared/i18n/messages.ts`는 named placeholder의 `/\{([A-Za-z][A-Za-z0-9_]*)\}/g`를 포함합니다.
- `shared/i18n/store.ts`는 OS Korean locale을 판별하는 `/^ko(?:-|$)/i`를 포함합니다.

이 목록은 기존 pattern 치환과 새 localization 구현을 구분한 것입니다. 새 literal이라는 이유로 결함으로 판단하지 않았습니다.

## 별도로 전달한 미번역 label

`shared/ui/rich-link-preview-attachment.tsx` 78행은 `alt` 값을 `` `Preview from ${preview.imageDomain}` ``로 만들고 ImageLightbox와 thumbnail의 alt에 사용합니다. app이 만든 설명이 한국어에서도 영어로 남습니다. catalog에는 이미 `Preview from {value1}`의 한국어 `{value1}의 미리보기`가 있습니다. 해당 template을 locale translator로 표시하고 domain 값은 그대로 전달하면 됩니다. 이 항목은 두 regex 기능 손상과 별도로 총괄에게 전달했습니다.

## 최종 수정 검증 상태

작성자의 freeze 후 두 파일을 다시 실제 TypeScript AST로 파싱해 `397f187`과 비교했습니다. 두 파일의 모든 regex token multiset이 공식과 정확히 같습니다. 따라서 최초 regex 차단 두 건은 해결됐습니다.

preview alt도 기존 `Preview from {value1}` catalog를 사용하는 locale translator로 바뀌었으며 domain은 interpolation 값으로 그대로 보존합니다.

이 검토자가 직접 실행했습니다.

```sh
node --import ./test-loader.mjs --experimental-strip-types --test \
  src/shared/ui/rich-link-preview-attachment.test.mjs \
  src/features/projects/ui/ProjectReadmePanel.test.mjs
```

결과는 **4/4 통과**입니다. preview 검사는 실제 component를 React SSR로 렌더링하고 DOM의 두 paragraph·단일 개행 보존·영어와 한국어 image/lightbox label·domain/src/href 보존을 검사합니다. README 검사는 실제 production normalizer 함수를 AST로 읽어 실행하며 실제 panel이 해당 함수를 호출하는지도 확인합니다. 테스트용 복제 regex를 검사하지 않습니다.

현재 regex 수정 범위에 남은 차단 결함은 없습니다. 최소성·구조·정확성은 각각 9/10입니다. 전체 broad smoke와 사용자 직접 확인을 통과했다는 판정은 별도입니다.
