/* ============================================================
 * server.js — 맑은 비용절감 API + 정적 파일 서버
 *
 *   GET  /api/edits          현재 저장된 비용 편집값 전체 조회
 *   POST /api/edits          편집값 전체 저장 (덮어쓰기)
 *
 *   ENV:
 *     PORT          서버 포트 (기본 3001)
 *     APP_PASSWORD  요청 인증 비밀번호 (미설정 시 인증 생략)
 *     DB_PATH       SQLite 파일 경로 (기본 ./db/expense-edits.db)
 * ============================================================ */
const path = require('path');
const fs = require('fs');
const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3001;
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db', 'expense-edits.db');

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Password');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// 비밀번호 게이트 — APP_PASSWORD 환경변수가 설정된 경우에만 적용
function requireAuth(req, res, next) {
    if (!APP_PASSWORD) return next();
    if (req.get('X-App-Password') === APP_PASSWORD) return next();
    res.status(401).json({ error: '인증 실패' });
}

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
    if (!APP_PASSWORD) console.log('[server] APP_PASSWORD 미설정 — 인증 없이 운영됩니다');
});
