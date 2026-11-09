# Buzz Korean

Buzz 데스크톱의 한국어·영어 버전입니다. Apple Silicon Mac을 대상으로 하며, Block의 공식 배포판과 구분되는 커뮤니티 배포입니다. 원본 [block/buzz](https://github.com/block/buzz)의 Apache-2.0 라이선스를 유지합니다.

현재 첫 설치 파일과 자동 업데이트 경로를 검증하고 있습니다. 소스 저장소 생성과 배포 완료를 구분합니다. [작업 상태](docs/updates/STATUS.md)에서 실제 검사 결과와 남은 항목을 확인할 수 있습니다.

## 설치와 업데이트

첫 정식 한글판을 공개한 뒤 다음 순서로 설치합니다.

1. [최신 한글판 Releases](https://github.com/ondallio/buzz-korean/releases/latest)에서 `BuzzKorean.dmg`를 내려받습니다.
2. DMG를 열고 `Buzz Korean.app`을 응용 프로그램 폴더에 넣습니다. 기존 `Buzz.app`은 유지할 수 있습니다.
3. `Buzz Korean`을 실행하고 연결 정보를 설정합니다. 기존 앱의 계정·키·메시지는 자동으로 가져오지 않습니다.

이후 검증된 한글판이 나오면 앱의 업데이트 알림에서 업데이트를 실행합니다. 지금 사용하던 개발용 앱에는 이 업데이트 채널이 없으므로 첫 한글판을 한 번 설치해야 합니다. 한국어·영어는 설정의 언어 항목에서 바꿀 수 있습니다.

현재 Apple Developer ID 공증은 준비되지 않았습니다. 초기 설치에서 macOS의 실행 허용 절차가 필요할 수 있으며, Gatekeeper를 끄거나 검역 속성을 제거하는 설치 스크립트는 사용하지 않습니다.

## 공식 업데이트를 받는 방식

GitHub Actions가 6시간마다 공식 Buzz의 새 정식 데스크톱 출시를 확인합니다. 시험판·모바일·릴레이 출시는 대상에서 제외합니다. 새 소스와 기존 한글화를 병합하고 번역 검사·타입·린트·테스트·빌드가 통과하면 한글판 전용 키로 서명한 설치 파일을 공개합니다. 충돌이나 검사 실패가 있으면 이전 배포를 유지하고 [Actions](https://github.com/ondallio/buzz-korean/actions/workflows/korean-release.yml)에 실패를 남깁니다. 새로운 영어 문구를 자동으로 완벽하게 번역한다고 보장하지 않습니다. 누락 검사를 통과하도록 번역을 보완해야 배포할 수 있습니다.

공개 저장소의 예약 실행은 GitHub 정책에 따라 비활성화될 수 있습니다. [Actions](https://github.com/ondallio/buzz-korean/actions/workflows/korean-release.yml)에서 활성 상태와 최근 실행을 확인하고, 필요하면 실행을 다시 활성화합니다. `Run workflow`의 `build_current`는 현재 소스로 새 한글판을 만드는 관리 기능입니다.

한국어판 자체 배포 버전은 `1.0.N`이며, 신형 공식 Buzz 1.0 베타를 뜻하지 않습니다. 현재 소스는 기존 `block/buzz`의 0.x 데스크톱입니다. 공식 Buzz 버전과 소스 커밋은 release 기록과 `upstream.lock.json`에서 별도로 확인합니다. 초기 기준 소스는 `ff6ab96e42b1fc64bfc1236104478a84e11b5abd`입니다. 현재 공식 정식판 `desktop-v0.5.28`보다 새로운 기준 소스이므로 과거 정식판으로 되돌리지 않습니다.

## 소스와 검증

`app/`에는 Buzz 소스와 한글화가 있으며, 저장소 root의 `scripts/`와 `.github/workflows/`가 배포를 관리합니다. `app/.github/workflows/`는 공식 원본을 보존한 소스이며 이 저장소에서 자동 실행하지 않습니다. 변경 이력·출처·독립 검토는 [docs/updates](docs/updates/)에 기록합니다.

```sh
. ./app/bin/activate-hermit
node --test tests/*.test.mjs
app/bin/actionlint .github/workflows/korean-release.yml
cd app
pnpm install --frozen-lockfile
just ci
```

서명 개인키는 소스에 포함하지 않습니다. 키 분실 시 기존 앱이 새 업데이트를 신뢰할 수 없으므로 관리자는 저장소 밖의 복구 사본을 보관해야 합니다. 사용자 직접 테스트와 네이티브 설치·업데이트 검증은 자동 테스트 통과로 대체하지 않습니다.
