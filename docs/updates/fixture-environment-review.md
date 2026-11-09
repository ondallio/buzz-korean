# Build fixture 환경 격리 독립 검토

2026-11-09에 `/root/link_review`가 `app/desktop/src/protectedFeatures/buildProtectedFeatureArtifacts.test.mjs`의 동결된 수정과 호출하는 production selection 함수를 읽었습니다. 차단 결함은 없습니다. 최소성·구조·정확성은 각각 9/10입니다.

이번 변경은 테스트가 만든 `.env.local`의 `VITE_BUZZ_BESTIE=1`을 검사할 때만 외부 프로세스의 같은 변수를 잠시 제외합니다. Vite의 실제 `loadEnv`가 ambient 값을 합치므로, public build job의 `0`이 fixture의 파일 선택을 가리던 실패 원인에 맞는 격리입니다. production `selectInternalVariant`, artifact build 로직과 앱 runtime은 수정하지 않습니다.

변수의 원래 값을 저장한 뒤 synchronous `loadEnv`를 호출하며 `finally`에서 복원합니다. 원래 변수가 없으면 다시 삭제하고, `0`·`1`이나 빈 문자열 같은 기존 값이 있으면 그 값을 그대로 돌려놓습니다. 이어지는 assertion이 복원을 확인합니다. 이 파일은 하나의 synchronous it을 사용하고 격리 구간에 await나 비동기 callback이 없어 다른 테스트 작업이 중간 상태를 관찰하는 흐름이 없습니다.

fixture의 본래 검증은 유지됩니다. 실제 production `selectInternalVariant`에서 파일 선택은 true, 명시적인 process override `0`은 false여야 합니다. 각 `buildArtifactMatrix` 호출의 순서 `[false, true]`와 `[true, false]`, 선택된 dist와 alternate dist의 internal marker 포함·부재 검사가 모두 남습니다. skip, 성공 강제, production 함수 대체를 추가하지 않았습니다. 기존 fakeBuilder는 선택·출력 계약을 검사하기 위한 원래 fixture이며 실제 Vite bundle build를 실행한 증거로 취급하지 않습니다.

Hermit을 활성화한 뒤 독립 child process 세 개로 같은 production-bound 테스트를 실행했습니다.

| ambient flag | 결과 |
| --- | --- |
| `VITE_BUZZ_BESTIE=0` | 1/1 통과 |
| `VITE_BUZZ_BESTIE=1` | 1/1 통과 |
| 변수 unset | 1/1 통과 |

각 실행은 `node --import ./test-loader.mjs --experimental-strip-types --test src/protectedFeatures/buildProtectedFeatureArtifacts.test.mjs`를 사용했습니다. root가 실행하는 전체 CI나 hosted build를 다시 시작하지 않았습니다.

이 검토자는 이 문서 외의 파일을 수정하지 않았고 Git·remote·키를 접근하지 않았습니다. 기존 A/B의 앱 동작 검토에는 영향을 주지 않는 테스트 fixture 수정입니다. 실제 전체 CI·release 성공은 후속 결과로 별도 확인해야 합니다.
