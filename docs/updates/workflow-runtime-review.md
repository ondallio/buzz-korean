# 권한 작업의 런타임 분리 검토

2026-11-09, Asia/Seoul. `/root/locale_design`의 읽기 전용 독립 검토입니다. 대상은 `.github/workflows/korean-release.yml`, `scripts/test-management.mjs`, `tests/workflow-boundaries.test.mjs` 세 파일이며, 이전 승인 범위는 다시 열지 않았습니다. 부모와 같은 모델을 사용했습니다.

이 변경 범위에서 차단할 정확성 결함은 발견하지 않았습니다. 최소성·구조·정확성은 각각 9/10입니다.

- contents-write 권한의 prepare와 sign-publish는 앱의 Hermit을 활성화하지 않습니다. 두 작업은 `actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38`와 Node `24.15.0`을 명시합니다. signer는 계속 신뢰한 workflow revision인 `github.sha`를 checkout합니다.
- prepare의 관리 검사 진입점은 `node scripts/test-management.mjs`입니다. 현재 tests 디렉터리에서 관리 검사 13개 파일을 선택하고, 앱 도구·데이터에 의존하는 `nested-check.test.mjs`와 `plist.test.mjs` 두 파일을 제외함을 직접 확인했습니다.
- 제외한 두 검사를 삭제하지 않았습니다. 후보 app의 Hermit과 의존성 설치 뒤, publishing credential이 없는 contents-read build 작업에서 동일한 두 테스트 파일을 실행합니다. build 작업에는 signing secret 참조가 없습니다.
- 새로운 경계 회귀는 권한 작업의 Hermit/app working-directory 재도입, 고정 Node 설정 제거, 두 앱 검사 누락 및 signer의 checkout revision 변경을 감지합니다. selector의 정상 파일 선택과 경로형 입력 제외도 생산 함수에 연결돼 있습니다.

직접 실행한 `node --test tests/workflow-boundaries.test.mjs`는 1/1 통과했습니다. 현재 디렉터리에 대한 생산 selector 실행은 선택 13개, 제외 대상 2개 모두 존재, 잘못 포함된 제외 대상 0개였습니다. 로컬 실행 Node는 `v24.21.0`이므로 GitHub runner의 고정 `24.15.0`에서 직접 실행했다고 주장하지 않습니다. 총괄이 수행 중인 관리 도구 전체 검사 및 첫 변경 workflow 실행은 별도 증거입니다.

생산 소스나 workflow는 수정하지 않았으며 외부 게시·앱 실행도 하지 않았습니다. 이 작은 런타임 분리에 대해 검토가 차단하는 항목은 없습니다. 실제 macOS 빌드·패키지 검증·업데이트 설치가 완료됐다는 판단은 아닙니다.
