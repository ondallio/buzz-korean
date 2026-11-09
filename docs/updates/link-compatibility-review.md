# 공유 링크 호환성 독립 검토

검토일은 2026-11-09입니다. `/root/link_review`가 `/Users/stan/orca/buzz-korean`에서 검토했습니다. 원본 `/Users/stan/orca/buzz-main-kor`는 읽거나 수정하지 않았습니다. 이 보고서 외의 소스 수정, GitHub 쓰기, 키 접근은 하지 않았습니다.

## 범위와 제품 계약

`app/AGENTS.md`, `app/VISION.md`, `app/VISION_SOVEREIGN.md`, `app/VISION_PROJECTS.md`, `app/TESTING.md`, `docs/updates/design.md`, `docs/updates/native-review.md`를 읽었습니다. 검토 기준점은 공개 관리 저장소의 `459b810`입니다.

이번 검토는 한국어판에서 복사한 메시지·프로젝트 링크를 기존 Buzz와 한국어판에서 그대로 읽고 붙여넣을 수 있다는 계약을 다룹니다. 링크의 canonical 표현은 `buzz://`를 유지합니다. 한국어판의 별도 app identifier, 키체인, 데이터 경로는 그대로 독립적입니다. 한국어판은 native 진입에서 `buzz://`와 `buzz-korean://`를 모두 받아 기존 navigation 표현으로 정규화합니다. 공식·dev·demo 수신 정책은 바꾸지 않습니다.

이 방향은 같은 signed conversation과 portable metadata를 여러 클라이언트가 공유한다는 vision에 맞습니다. 두 앱을 함께 설치할 때 canonical 링크의 외부 연결은 OS와 사용자의 앱 선택을 따릅니다. 이번 수정에 기본 handler를 강제하는 호출은 필요하지 않습니다.

## 최초 검토의 전체 차단 발견

| 발견 | 실제 실패 | 필요한 수정 |
| --- | --- | --- |
| Korean clipboard 경계의 scheme 변경 | 메시지의 Copy link나 프로젝트 공유에서 `buzz-korean://`를 복사합니다. 실제 `parseMessageLink`, `parseEntityLink`, composer의 `buzz://` 식별 규칙이 이를 거부하므로 같은 한국어판에 다시 붙여넣거나 공식 클라이언트로 전달해도 정상적인 링크 표현이 되지 않습니다. 기존 transport 테스트는 이 잘못된 scheme를 기대하여 통과했습니다. | 다섯 clipboard 호출부의 변환과 helper를 제거하고 canonical builder 결과를 그대로 복사합니다. production clipboard 출력으로 실제 parser roundtrip과 composer 붙여넣기를 검사합니다. |
| Korean native 수신·등록의 canonical 배제 | 기존 Buzz가 만든 `buzz://message`, `buzz://project`, 연결·초대 링크를 한국어판으로 전달해도 native gate가 `buzz-korean`만 허용하여 거부합니다. bundle 역시 canonical scheme를 등록하지 않았습니다. | Korean bundle에 두 scheme를 등록하고, native 공통 수신 gate에서만 두 scheme를 허용합니다. 동일 payload와 entity canonical 정규화, 다른 scheme 거부를 검사합니다. |
| 단일 인스턴스 전달 경로의 별도 gate | `lib.rs`는 duplicate-launch argv를 `build_identity::is_deep_link_for_build`로 먼저 검사합니다. 이 검사에서 canonical 링크가 떨어지면 수정된 native handler에 도달하지 않고 창만 focus합니다. | 실제 cold/warm 수신과 single-instance caller가 같은 receive 정책을 쓰도록 연결하고 그 production 연결을 검사합니다. 독립 배포 namespace와 수신 정책을 혼동하지 않습니다. |

최종 freeze 후 세 항목 모두 해결됐음을 확인했습니다. 새 차단 결함은 없습니다.

- 다섯 clipboard 호출부는 원래 builder 또는 `projectSelectionShareLinks`가 만든 값을 그대로 전달합니다. 불필요해진 transport helper와 잘못된 기대값의 테스트를 제거했습니다. 새 테스트는 실제 production clipboard 인자와 메시지 copy handler를 실행하고 실제 parser·composer 함수에 출력값을 전달합니다. canonical message/entity builder, ID, tag, route, API, relay schema는 수정하지 않았습니다.
- Korean release overlay는 정확히 `buzz`, `buzz-korean` 두 scheme를 선언합니다. 실제 release build 검사와 독립 bundle verifier도 두 값이 모두 있고 다른 값은 없는지 검사합니다. 누락·중복·다른 scheme에 대한 실패 테스트가 있습니다.
- `build_identity::is_deep_link_for_scheme`는 Korean receiver에만 canonical `buzz://`를 추가로 허용합니다. `is_deep_link_for_build`를 쓰는 기존 `lib.rs`의 duplicate-launch caller와 `deep_link.rs`의 handler가 같은 정책을 따릅니다. entity normalization도 같은 정책을 검사한 뒤 기존 `buzz://` frontend 표현으로 전달합니다. message payload는 scheme에 관계없이 같습니다. 공식·dev의 `buzz`와 각 demo의 전용 scheme 경계는 유지됩니다.
- distribution의 `deep_link_scheme()`는 계속 `buzz-korean`입니다. app identifier·키체인·nest·CLI·credential 경로와 데이터 격리 코드는 이번 diff에서 바꾸지 않았습니다. 기본 handler를 설정하는 호출을 추가하지 않았습니다.

검토 대상 변경은 `459b810` 이후의 다섯 clipboard 호출부, transport 제거·대체 테스트, native receiver/identity 네 파일, message copy E2E, Korean config·build·bundle 검사와 그 회귀 테스트, design 문구입니다. 범위 밖의 parser 개선이나 배포 관리 전체 감사는 하지 않았습니다.

## 이전 보고서의 정정

`native-review.md`는 clipboard 변환을 올바른 OS transport 분리라고 판단했습니다. 또한 canonical 링크를 거부하는 테스트의 통과를 호환성 근거로 사용했습니다. 그 판단은 실제 parser와 composer 사이의 계약을 확인하지 못했습니다. 위의 clipboard/parser 실패가 해당 부분을 정정합니다. 과거의 Cargo·Node 통과 결과는 이번 링크 수정 후 검증을 대신하지 않습니다.

## 최종 검증

모든 명령에서 새 관리 저장소의 Hermit을 활성화했습니다. 최종 freeze 소스에 대해 이 검토자가 직접 실행했습니다.

| 검사 | 결과 |
| --- | --- |
| `scripts/korean-build-identity.test.mjs` | 2/2 통과. 실제 Rust identity/keyring 소스를 debug와 release로 컴파일하고 Korean canonical URI 수신과 독립 identity를 확인합니다. |
| `shareLinkCompatibility.test.mjs`, `messageLink.test.mjs`, `entityLink.test.mjs`, `projectShareLinks.test.mjs`, `composerMessageLinkNode.test.mjs`, `composerLinkPastePipeline.test.mjs`, `shared/deep-link.test.mjs` | 119/119 통과. 실제 clipboard 경계·message/entity parser·composer paste 함수, 실제 production editor를 mount한 DOM paste, native payload navigation queue를 포함합니다. |
| `tests/channel-config.test.mjs`, `tests/native-bundle.test.mjs` | 31/31 통과. bundle 테스트는 fixture와 대체 native tool을 사용하며 실제 배포 bundle을 검증했다는 뜻은 아닙니다. |
| `git diff --check` | 통과. |

Frontend 명령은 `app/desktop/`에서 다음 loader 옵션으로 실행했습니다.

```sh
node --import ./test-loader.mjs --experimental-strip-types --test <위 테스트 파일>
```

root의 최종 검증 인계에 따르면 변경된 message copy E2E는 Korean과 official 각각 2/2 통과했습니다. 이 E2E는 action rail과 More가 쓴 실제 clipboard 값을 읽고 화면의 TipTap composer에 붙여넣어 canonical link chip을 확인합니다. 이 검토자는 해당 spec의 production 연결과 assertion을 읽었으며 E2E를 다시 실행하지 않았습니다. worker가 보고한 Korean Cargo 범위 검사는 59 통과, 1 ignored입니다. 이 검토자의 직접 실행 결과와 구분합니다.

최소성 9/10, 구조 9/10, 정확성 9/10입니다. 세 최초 차단 항목은 닫혔으며 현재 수정 범위에 새 차단 결함은 없습니다. 새 helper 체계를 추가하지 않고 잘못된 clipboard 변환을 제거하고 기존 공통 수신 predicate를 확장한 변경입니다.

전체 `just ci`, 실제 새 앱 bundle의 URL scheme 등록, OS handler 선택·기존 앱 병행 실행, 실제 설치와 N에서 N+1 업데이트, 사용자 직접 확인은 이 보고서가 인증하지 않습니다. 이 검토자는 전체 Cargo와 OS activation을 실행하지 않았습니다. `AGENTS.md`의 human 확인이나 `buzz-review-completed` 준비 완료를 대신하지 않습니다.
