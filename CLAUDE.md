
## 기술 스택

- **프레임워크**: Vue 3 (CDN)
- **라우터**: ViewLogic Router 1.4.0 (파일 기반 라우팅)
- **CSS**: Bootstrap 5.3.3 + 최소한의 커스텀 CSS (`css/base.css`)
- **빌드**: 없음 (정적 파일 서빙)

## 프로젝트 구조

```
project/
├── index.html              # 진입점 (Vue, ViewLogic, Bootstrap CDN 로드)
├── css/base.css            # 커스텀 CSS (Bootstrap 우선, 최소화)
├── src/
│   ├── views/              # HTML 템플릿 (CSS 금지)
│   │   ├── layout/         # 레이아웃 템플릿
│   │   └── {page}.html     # 페이지 뷰
│   ├── logic/              # JavaScript 로직
│   │   ├── layout/         # 레이아웃 스크립트
│   │   └── {page}.js       # 페이지 로직
│   └── components/         # 재사용 컴포넌트
├── i18n/                   # 다국어 파일 (선택)
└── docs/                   # 상세 문서
```

## 핵심 규칙

1. **파일 쌍**: `views/{name}.html` ↔ `logic/{name}.js` 반드시 동일 이름
2. **폴더 = 라우트**: `goals/my-goals.html` → `#/goals/my-goals`
3. **CSS**: HTML에 `<style>` 태그 금지, 모든 CSS는 `css/base.css`
4. **라우팅**: `this.navigateTo()` 사용, `window.location` 직접 조작 금지
5. **비동기**: `async/await` 사용, `Promise.then/catch` 금지
6. **레이아웃**: `layout: null` 사용, `layout: false` 금지
7. **정적 데이터**: 법적 문서 등 긴 콘텐츠는 `data/` 폴더에 JSON으로 분리
8. **콘텐츠 영역 표준 너비**: 모든 페이지는 `<div class="container">` 사용 → `.page-content > .container`는 GNB(`container-fluid px-3 px-lg-4`)와 동일하게 `max-width: 100%` + 좌우 여백 `1rem`(기본) / `1.5rem`(lg 이상)으로 전역 적용됨. 페이지마다 별도 너비 지정 금지.
9. **2단 레이아웃 표준**: 메인 + 우측 보조 패널(미리보기, 가이드 등) 구성은 `.content-2col` 클래스 사용 (1fr + 360px, gap 32px). 우측 영역은 `.content-2col-aside` 클래스로 마크업하면 1024px 이하에서 자동으로 위로 올라가 단일 컬럼으로 스택됨. 사이드를 sticky로 두고 싶으면 `.content-2col-aside`에 `position: sticky` 추가.

## 상세 문서

기능별 상세 문서는 `docs/` 폴더 참조:

| 문서 | 내용 |
|------|------|
| [docs/routing.md](docs/routing.md) | 파일 기반 라우팅, 페이지 이동, 파라미터 |
| [docs/data-fetching.md](docs/data-fetching.md) | dataURL 자동 로딩, 수동 API 호출 |
| [docs/forms.md](docs/forms.md) | 명령형/선언적 폼 처리 |
| [docs/api.md](docs/api.md) | $api 메서드 (GET/POST/PUT/DELETE), 에러 처리 |
| [docs/auth.md](docs/auth.md) | 인증 설정, 로그인/로그아웃, 토큰 관리 |
| [docs/i18n.md](docs/i18n.md) | 다국어 설정, 메시지 파일, 언어 전환 |
| [docs/components.md](docs/components.md) | 컴포넌트 생성/등록 |
| [docs/components-builtin.md](docs/components-builtin.md) | 내장 컴포넌트 상세 (DatePicker, Table, Sidebar 등) |
| [docs/layout.md](docs/layout.md) | 레이아웃 시스템, 레이아웃 지정 |
| [docs/patterns.md](docs/patterns.md) | 공통 패턴 (로딩 상태, 에러 처리, 폼 밸리데이션, 검색/필터) |
| [docs/advanced.md](docs/advanced.md) | 라이프사이클, computed, watch, 캐싱, 상태 관리 |
| [docs/configuration.md](docs/configuration.md) | ViewLogicRouter 전체 설정 옵션 |
| [docs/billing.md](docs/billing.md) | 결제, 구독, 청구서, 환불, 해지 정책 |

## 커맨드

다음 커맨드를 사용하여 빠르게 작업할 수 있습니다:

| 커맨드 | 설명 |
|--------|------|
| `/create-page` | 새 페이지 (view + logic) 생성 |
| `/create-component` | 새 재사용 컴포넌트 생성 |
| `/create-layout` | 새 레이아웃 생성 |

## 템플릿

`.claude/templates/` 폴더에 변형 패턴 포함 템플릿 문서가 있습니다:

| 템플릿 | 용도 |
|--------|------|
| `page.md` | 페이지 (정적, 목록, 상세, 폼 4가지 변형) |
| `component.md` | 컴포넌트 (기본, 슬롯, v-model 3가지 변형) |
| `layout.md` | 레이아웃 (네비게이션, 사이드바 2가지 변형) |

## 개발 서버

```bash
python -m http.server 8000
# 또는 VS Code Live Server (포트 5502)
```

## 추가 리소스

- **프로젝트 GitHub**: https://github.com/malgnsoft/creatorlms-brand
- **ViewLogic GitHub**: https://github.com/hopegiver/viewlogic
- **npm**: https://www.npmjs.com/package/viewlogic
