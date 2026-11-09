# Build·browser 병렬 검증 독립 검토

2026-11-09에 `/root/link_review`가 현재 `.github/workflows/korean-release.yml`과 `tests/workflow-boundaries.test.mjs`의 실제 diff를 읽었습니다. 차단 결함은 없습니다. 최소성·구조·정확성은 각각 9/10입니다.

앞선 검토에서 읽은 제품·testing 지침과 배포 설계를 적용했습니다. 이번 변경은 검증과 keyless packaging을 같은 candidate에 대해 병렬로 실행하는 운영 변경입니다. 필수 사용자 흐름 검증이 성공하기 전에 서명·발행을 허용하지 않는 계약은 유지됩니다. 이 검토자는 이 보고서 외의 source·workflow·Git·remote를 수정하지 않았고 키를 접근하지 않았습니다.

## Dependency와 candidate

`prepare`가 하나의 candidate commit을 출력합니다. `build`와 `browser`는 모두 `needs: prepare`이며 `needs.prepare.outputs.build == 'true'`일 때만 시작합니다. 두 checkout의 ref는 정확히 같은 `needs.prepare.outputs.candidate`이고, credential persistence는 둘 다 false입니다. 독립 runner에서 각 작업이 다른 checkout 상태나 다른 mutable branch를 검증하는 연결은 없습니다.

`sign-publish`의 needs는 `[prepare, build, browser]`입니다. 실행 조건은 build와 browser 결과가 모두 `success`라는 두 조건의 AND입니다. 하나라도 failure·cancelled·skipped라면 두 success 조건을 충족하지 않습니다. prepare가 실패하거나 build를 요청하지 않은 경우에도 두 후속 작업이 성공한 것으로 취급되지 않습니다. 검증 job에 continue-on-error는 없습니다.

따라서 browser가 실패하는 동안 build가 완료되어 artifact가 생길 수는 있지만, 그 사실만으로 signer가 실행되지는 않습니다. keyless packaging의 완료와 발행 승인을 분리한 것입니다.

## 필수 검사의 보존

build에는 pinned dependency 설치, app-dependent tooling 검사, 전체 `just ci`, desktop typecheck와 최종 ARM64 release packaging이 남아 있습니다. 원래의 full OSS smoke 명령은 삭제되지 않고 browser job으로 이동했습니다.

browser job은 public compile env `VITE_BUZZ_BESTIE=0`에서 Chromium 설치와 동일한 `pnpm test:e2e:smoke`를 실행합니다. 다음 필수 step은 env를 `1`로 지정하고 `pnpm build:e2e`를 다시 실행한 뒤 동일 smoke project의 원래 `bestie.spec.ts`를 실행합니다. 기존 Bestie 양성 body의 보존·양 variant 검증은 별도 `bestie-variant-review.md`의 독립 확인과 같습니다.

최종 build-release script는 여전히 하위 build 환경에 public flag `0`을 명시합니다. 내부 기능 테스트 runner와 artifact를 만드는 runner도 서로 분리됐습니다.

현재 순서는 별도 job에서 browser 검사와 keyless packaging이 병렬로 일어나는 것입니다. 이전 Bestie 검토의 같은 job에서 검사 후 packaging이라는 순서는 이번 변경으로 대체됐습니다. **두 검사가 모두 성공한 뒤에만 signing/publishing을 시작한다는 조건은 유지됩니다.**

## Credential와 artifact 경계

build와 browser는 `contents: read` 권한이고 secrets 참조가 없습니다. 둘 다 pinned checkout 및 Hermit action을 사용하고 checkout token을 Git 설정에 남기지 않습니다. 새 browser job에 signing key나 release write token을 전달하는 step을 추가하지 않았습니다.

signer 변경은 needs와 실행 조건뿐입니다. trusted workflow revision `github.sha` checkout, 같은 run ID의 prepared·unsigned artifact 선택, pinned trusted signer 설치와 마지막 publish step에서만 key를 전달하는 기존 연결은 그대로입니다. browser evidence는 별도 `browser-evidence-<run_id>` 이름이어서 signer가 받는 unsigned artifact와 혼동되지 않습니다.

browser evidence 업로드 step은 `if: always()`이고 test-results·playwright-report를 7일 보존합니다. 파일이 아직 생성되지 않은 실패는 warn으로 기록하며 해당 실패가 테스트 job을 성공으로 바꾸지 않습니다. 120분 job timeout도 지정돼 있습니다.

## 독립 실행과 한계

Hermit을 활성화하고 다음을 직접 실행했습니다.

```sh
node --test tests/workflow-boundaries.test.mjs
git diff --check -- .github/workflows/korean-release.yml \
  tests/workflow-boundaries.test.mjs
```

결과는 **2/2 통과**, diff check 통과입니다. 새 검사는 실제 workflow source에서 두 candidate ref·read-only 권한·secret 부재·유지된 검사 명령·세 needs와 두 success 조건의 연결을 확인합니다. 별도 helper의 가상 dependency graph를 검사한 결과가 아닙니다.

이번 검토에서 새 Actions run이나 전체 smoke를 시작하지 않았습니다. 실제 hosted 병렬 실행, 실패 artifact 보존, 최종 release publication 성공은 다음 workflow 실행의 증거가 필요합니다. 이 검토는 진행 중인 broad smoke나 A/B localization 구현의 완료를 인증하지 않습니다.
