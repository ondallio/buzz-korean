# JSON import attribute 독립 검토

2026-11-09에 `/root/link_review`가 동결된 두 파일을 검토했습니다. 현재 수정 범위에 차단 결함은 없습니다. 최소성·구조·정확성은 각각 9/10입니다.

검토 범위는 `app/desktop/src/shared/i18n/catalogs/index.ts`의 JSON import 27개와 `app/desktop/src/shared/i18n/messages.ts`의 `preserved.json` import 한 개에 추가한 `with { type: "json" }`입니다. 기준 revision은 총괄이 지정한 `db78b20`입니다. Git 명령은 실행하지 않았습니다. 앞선 검토에서 읽은 `AGENTS.md`, vision, testing 지침을 적용했습니다. 이 보고서 외의 source·번역 catalog·dist·설정 파일을 수정하지 않았고 원본 앱·remote·개인 키를 접근하지 않았습니다.

## 판단

기존 `.local/full-smoke-collection-red.log`와 JSON 보고서에는 `preserved.json`의 `type: json` import attribute 누락 오류가 다섯 개 있습니다. 이 파일은 테스트가 가져오는 실제 `pubkey` helper에서 i18n을 통해 로드됩니다. import attribute는 Node ESM이 JSON module을 읽는 데 필요한 형식을 명시합니다. catalog의 객체 병합 순서, translator 함수, locale 저장·선택 로직을 바꿀 필요가 없습니다.

현재 두 파일의 JSON import 28개에는 모두 `type: "json"`이 있고, JSON이 아닌 TypeScript·alias import는 그대로입니다. default import의 값은 같은 JSON 데이터입니다. 이 수정 자체는 API·프로토콜·번역 문자열·사용자 데이터의 형식을 바꾸지 않습니다. 실제 문제가 발생한 production import 경로를 수정하므로 테스트에서 import를 우회하거나 대체하지 않습니다.

프로젝트 TypeScript 설정은 `module: ESNext`, `moduleResolution: bundler`, `resolveJsonModule: true`입니다. 실제 설치된 compiler가 두 파일을 포함한 `tsc --noEmit` 검사를 통과했습니다. 설치된 Vite의 Oxc transform도 두 파일을 메모리에서 정상 변환했습니다. production browser bundle을 새로 쓰거나 전체 smoke 동작을 다시 실행하지 않았습니다.

## 독립 실행 결과

모든 명령에서 새 관리 저장소의 Hermit을 활성화했습니다.

| 검사 | 결과 |
| --- | --- |
| Node 24.15.0의 원래 smoke `--list` | 161개 파일의 1,492개 테스트 collection 성공, import 오류 없음 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 통과 |
| 설치된 Vite의 `transformWithOxc`로 두 파일 변환 | 통과, JSON import attribute 수 27+1 확인 |
| `runtime.test.mjs` | 5/5 통과, 실제 translation API·placeholder 검증·locale 전환과 OS locale 선택 포함 |

collection은 `app/desktop/`에서 다음 명령으로 실행했습니다. 기존 private config의 원래 smoke project와 testMatch를 사용했습니다. `--reporter=list`는 보고서 파일 쓰기를 피하기 위한 실행 옵션입니다.

```sh
node node_modules/@playwright/test/cli.js test \
  --config=/Users/stan/orca/buzz-korean/.local/full-smoke.playwright.config.mjs \
  --project=smoke --list --reporter=list
```

문제의 production `pubkey` helper를 직접 import하는 다섯 spec이 모두 collection 목록에 포함됐습니다.

- `mentions.spec.ts`
- `mention-recipients.spec.ts`
- `huddle-transcription.spec.ts`
- `pubkey-display-screenshots.spec.ts`
- `workflow-local-controls.spec.ts`

최초 `pnpm exec` 시도는 pnpm의 자동 install preflight가 TTY 부재로 중단됐습니다. dependency 재설치를 허용하거나 설정을 변경하지 않고 설치된 Playwright CLI를 직접 실행했습니다. 이는 import 수정의 실패가 아닙니다.

## 검증 한계

`--list` 결과는 다섯 파일을 포함한 전체 원래 smoke project가 실제 Node import 경로로 수집된다는 증거입니다. 1,492개 동작 테스트가 통과했다는 뜻은 아닙니다. 전체 smoke 실행, 전체 `just ci`, 배포 build와 실제 앱 검증은 총괄의 별도 결과가 필요합니다. 이번 검토는 전체 bundle을 다시 빌드하거나 dist를 수정하지 않았습니다.
