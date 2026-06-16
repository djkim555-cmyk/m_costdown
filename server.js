/* ============================================================
 * server.js — 맑은 비용절감 API + 정적 파일 서버
 *
 *   GET  /api/edits          현재 저장된 비용 편집값 전체 조회
 *   POST /api/edits          편집값 전체 저장 (덮어쓰기)
 *
 *   ENV:
 *     PORT                     서버 포트 (기본 3001)
 *     APP_PASSWORD_FULL        전체 권한 비밀번호 (미설정 시 인증 생략)
 *     APP_PASSWORD_RESTRICTED  제한 권한 비밀번호 (전략 메뉴 숨김)
 *     SESSION_SECRET           (선택) 토큰 서명 키
 *     DB_PATH                  SQLite 파일 경로 (기본 ./db/expense-edits.db)
 * ============================================================ */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db', 'expense-edits.db');

// ── 서버 측 인증 ──────────────────────────────────────────────
//   비밀번호의 SHA-256 해시만 코드에 둠(평문 미보관). 환경변수 평문이 있으면 우선.
//   ⚠️ 해시 원문은 과거 공개 이력에 존재 — 실보안 필요 시 환경변수로 새 값 설정.
const DEFAULT_PW_HASHES = {
    '39cc6b23f1341f4f47849a77e257e644f7117f6306a3ea2d8cc30130f9990157': 'full',
    'e9c92607886a599ac14e7f3e290626d36d5458e9d7fd86c51efa522863d81ce4': 'restricted',
};
function sha256hex(s) {
    return crypto.createHash('sha256').update(String(s == null ? '' : s)).digest('hex');
}
function resolveRole(password) {
    if (process.env.APP_PASSWORD_FULL && password === process.env.APP_PASSWORD_FULL) return 'full';
    if (process.env.APP_PASSWORD_RESTRICTED && password === process.env.APP_PASSWORD_RESTRICTED) return 'restricted';
    return DEFAULT_PW_HASHES[sha256hex(password)] || null;
}
const AUTH_ENABLED = true; // 기본 해시가 항상 존재하므로 인증 상시 활성
const SESSION_SECRET = process.env.SESSION_SECRET || Object.keys(DEFAULT_PW_HASHES).join('|');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12시간

function b64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// JWT(HS256) 형식 — header.payload.signature, exp 는 초 단위(클라이언트 라우터 호환)
const JWT_HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
function signToken(role) {
    const payload = b64url(JSON.stringify({ role, exp: Math.floor((Date.now() + TOKEN_TTL_MS) / 1000) }));
    const signingInput = JWT_HEADER + '.' + payload;
    const sig = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(signingInput).digest());
    return signingInput + '.' + sig;
}
function verifyToken(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expected = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(header + '.' + payload).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    let data;
    try { data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); }
    catch (e) { return null; }
    if (!data || typeof data.exp !== 'number' || data.exp * 1000 < Date.now()) return null;
    return { role: data.role };
}
function bearer(req) {
    const m = (req.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : '';
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
    CREATE TABLE IF NOT EXISTS expense_edits (
        row_id       INTEGER PRIMARY KEY,
        category     TEXT,
        lever        TEXT,
        dept         TEXT,
        reducible    TEXT,
        memo         TEXT,
        saving       TEXT,
        saving_month TEXT,
        splits       TEXT,
        updated_at   INTEGER
    );
`);

// 구버전 스키마(0001) 호환: 컬럼 누락 시에만 ALTER (기존 데이터 보존)
const existingCols = new Set(
    db.prepare("PRAGMA table_info(expense_edits)").all().map((c) => c.name),
);
if (!existingCols.has('saving_month')) {
    db.exec('ALTER TABLE expense_edits ADD COLUMN saving_month TEXT');
}

const FIELDS = ['category', 'lever', 'dept', 'reducible', 'memo', 'saving', 'saving_month', 'splits'];
const JSON_FIELDS = new Set(['dept', 'splits']);

function parseField(field, raw) {
    if (raw == null) return JSON_FIELDS.has(field) ? (field === 'dept' ? [] : []) : '';
    if (!JSON_FIELDS.has(field)) return raw;
    try { return JSON.parse(raw); }
    catch (e) { return field === 'dept' ? [] : []; }
}

function serializeField(field, val) {
    if (val == null) return null;
    if (JSON_FIELDS.has(field)) {
        try { return JSON.stringify(val); }
        catch (e) { return null; }
    }
    return String(val);
}

const selectAllStmt = db.prepare('SELECT * FROM expense_edits');
const upsertStmt = db.prepare(`
    INSERT INTO expense_edits (row_id, category, lever, dept, reducible, memo, saving, saving_month, splits, updated_at)
    VALUES (:row_id, :category, :lever, :dept, :reducible, :memo, :saving, :saving_month, :splits, :updated_at)
    ON CONFLICT(row_id) DO UPDATE SET
        category     = excluded.category,
        lever        = excluded.lever,
        dept         = excluded.dept,
        reducible    = excluded.reducible,
        memo         = excluded.memo,
        saving       = excluded.saving,
        saving_month = excluded.saving_month,
        splits       = excluded.splits,
        updated_at   = excluded.updated_at
`);
const beginStmt = db.prepare('BEGIN');
const commitStmt = db.prepare('COMMIT');
const rollbackStmt = db.prepare('ROLLBACK');

function loadAllEdits() {
    const rows = selectAllStmt.all();
    const out = { category: {}, lever: {}, dept: {}, reducible: {}, memo: {}, saving: {}, saving_month: {}, splits: {} };
    for (const r of rows) {
        for (const f of FIELDS) {
            out[f][r.row_id] = parseField(f, r[f]);
        }
    }
    return out;
}

function saveAllEdits(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('잘못된 요청 본문');
    const idSet = new Set();
    for (const f of FIELDS) {
        if (payload[f] && typeof payload[f] === 'object') {
            for (const id in payload[f]) idSet.add(Number(id));
        }
    }
    const now = Date.now();
    beginStmt.run();
    try {
        for (const id of idSet) {
            upsertStmt.run({
                row_id: id,
                category: serializeField('category', payload.category && payload.category[id]),
                lever: serializeField('lever', payload.lever && payload.lever[id]),
                dept: serializeField('dept', payload.dept && payload.dept[id]),
                reducible: serializeField('reducible', payload.reducible && payload.reducible[id]),
                memo: serializeField('memo', payload.memo && payload.memo[id]),
                saving: serializeField('saving', payload.saving && payload.saving[id]),
                saving_month: serializeField('saving_month', payload.saving_month && payload.saving_month[id]),
                splits: serializeField('splits', payload.splits && payload.splits[id]),
                updated_at: now,
            });
        }
        commitStmt.run();
    } catch (e) {
        try { rollbackStmt.run(); } catch (_) { /* ignore */ }
        throw e;
    }
    return idSet.size;
}

const app = express();
app.use(express.json({ limit: '5mb' }));

// CORS — Live Server(5501) 등 다른 포트에서 개발할 때 API 호출 허용
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// 세션 토큰 게이트 — /api/login 으로 발급받은 Bearer 토큰 필요
function requireAuth(req, res, next) {
    if (!AUTH_ENABLED) return next();
    if (verifyToken(bearer(req))) return next();
    res.status(401).json({ error: '인증이 필요합니다.' });
}

// 비밀번호 검증 후 서명 세션 토큰 발급 (서버 측 인증)
app.post('/api/login', (req, res) => {
    const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
    const role = resolveRole(password);
    if (!role) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    res.json({ ok: true, role, token: signToken(role) });
});

app.get('/api/edits', requireAuth, (req, res) => {
    try {
        res.json(loadAllEdits());
    } catch (e) {
        console.error('GET /api/edits 실패:', e);
        res.status(500).json({ error: '조회 실패' });
    }
});

app.post('/api/edits', requireAuth, (req, res) => {
    try {
        const n = saveAllEdits(req.body);
        res.json({ ok: true, count: n, updatedAt: Date.now() });
    } catch (e) {
        console.error('POST /api/edits 실패:', e);
        res.status(400).json({ error: e.message || '저장 실패' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true, db: DB_PATH });
});

// 정적 파일 서빙 (index.html, css/, src/, data/, js/, docs/)
app.use(express.static(__dirname, { extensions: ['html'] }));

app.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}  (DB: ${DB_PATH})`);
    if (!process.env.APP_PASSWORD_FULL && !process.env.APP_PASSWORD_RESTRICTED) {
        console.log('[server] APP_PASSWORD_* 미설정 — 기본 비밀번호(해시 폴백)로 운영됩니다');
    }
});
