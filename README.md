# 맑은 비용절감 (m_costdown)

전사 비용절감 전략 대시보드. Vue 3 (CDN) + ViewLogic Router 정적 프론트 + Cloudflare Pages Functions + D1 (서버리스 SQLite).

## 빠른 시작

```bash
npm install
npm run dev          # → http://localhost:8788 (wrangler + 로컬 D1)
```

또는 wrangler 없이 기존 Node 서버로:

```bash
npm start            # → http://localhost:3001 (server.js + 파일 SQLite)
```

## Cloudflare Pages 배포

GitHub 리포지토리 → Cloudflare Pages 자동 배포 + D1 바인딩. 한 번만 설정하면 이후 git push 마다 자동 배포됩니다.

### 1. Cloudflare 계정 로그인 (최초 1회)

```bash
npx wrangler login
```

### 2. D1 데이터베이스 생성

```bash
npm run db:create
```

출력 예시:
```
[[d1_databases]]
binding = "DB"
database_name = "malgn-costdown-edits"
database_id = "abc12345-def6-7890-..."
```

→ 출력된 **`database_id`** 를 [wrangler.toml](wrangler.toml) 의 `database_id = "REPLACE_AFTER_WRANGLER_D1_CREATE"` 자리에 붙여 넣습니다.

### 3. 원격 D1 에 테이블 생성

```bash
npm run db:migrate:remote
```

### 4. GitHub 리포지토리에 푸시

```bash
git add .
git commit -m "feat: Cloudflare Pages + D1 백엔드"
git push
```

### 5. Cloudflare Pages 프로젝트 연결

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. GitHub 리포지토리 선택 (`djkim555-cmyk/m_costdown`)
3. 빌드 설정:
   - **Framework preset**: None
   - **Build command**: (비워두기)
   - **Build output directory**: `/`
4. **Save and Deploy**

### 6. D1 바인딩 연결 (Pages 프로젝트)

배포 후 Pages 프로젝트 → **Settings** → **Functions** → **D1 database bindings** → **Add binding**
- Variable name: `DB`
- D1 database: `malgn-costdown-edits` 선택

저장 후 다음 배포부터 적용됩니다. 한 번 더 **Deployments** → **Retry deployment** 로 재배포해 바인딩을 활성화하세요.

### 7. (선택) 비밀번호 보호

같은 화면의 **Environment variables** → **Add variable**
- `APP_PASSWORD = <원하는 비밀번호>`

설정 시 `/api/*` 호출에 `X-App-Password` 헤더가 필요합니다. (미설정 시 인증 없이 작동)

### 8. 기존 localStorage 데이터 이관

배포 후 그동안 데이터를 입력해 둔 **브라우저** 로 새 배포 URL 에 접속하면, 빈 D1 을 감지하고 localStorage 의 기존 편집값을 자동으로 D1 에 업로드합니다 (1회). 이후 모든 브라우저/기기에서 같은 데이터를 공유합니다.

## 디렉터리 구조

```
project/
├── functions/              # Cloudflare Pages Functions (배포 시 자동 라우팅)
│   ├── _middleware.js     # /api/* 비밀번호 인증 (선택)
│   └── api/
│       ├── edits.js       # GET/POST /api/edits
│       └── health.js      # GET /api/health
├── migrations/
│   └── 0001_init.sql      # D1 테이블 스키마
├── wrangler.toml          # Pages + D1 바인딩 설정
├── server.js              # 로컬 Node 대안 (wrangler 없이 dev)
├── src/                   # Vue 페이지 (views/ + logic/)
├── css/, js/, data/       # 정적 자산
└── index.html
```

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET`  | `/api/edits`  | 전체 비용 편집값 조회 `{category, lever, dept, reducible, memo, saving, splits}` |
| `POST` | `/api/edits`  | 편집값 전체 저장 (UPSERT, D1 batch 트랜잭션) |
| `GET`  | `/api/health` | 서버 + D1 연결 확인 |

`APP_PASSWORD` 환경변수가 설정된 경우 `X-App-Password` 헤더로 비밀번호 전달 필요.

## 로컬 개발 시나리오

| 시나리오 | 명령 | URL | DB |
|----------|------|-----|-----|
| **권장**: Cloudflare 환경 그대로 | `npm run dev` | http://localhost:8788 | 로컬 D1 (`.wrangler/state/v3/d1`) |
| 대안: 단순 Node | `npm start` | http://localhost:3001 | 파일 SQLite (`db/expense-edits.db`) |
| 정적만 (Live Server / python http.server) | 평소처럼 | localhost:5500/5501/8000 | → `npm start` 별도 기동 (자동 감지) |

[js/gs-utils.js](js/gs-utils.js) 의 API_BASE 감지 로직이 출처를 보고 자동으로 적절한 API 호스트를 선택합니다.

## 데이터 백업 / 복구

```bash
# 원격 D1 전체 SQL 덤프
npm run db:export:remote     # → db/d1-dump.sql

# 다른 D1 에 복원
npx wrangler d1 execute <db-name> --remote --file=db/d1-dump.sql
```

## 비밀번호 변경

페이지 진입 비밀번호는 [index.html](index.html) 의 `window.APP_PASSWORD`. 자세한 내용은 [docs/pw.md](docs/pw.md).
