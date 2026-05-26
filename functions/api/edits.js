/* ============================================================
 * functions/api/edits.js
 *   Cloudflare Pages Function — /api/edits
 *   GET  : 전체 비용 편집값 조회
 *   POST : 전체 비용 편집값 저장 (UPSERT, D1 batch 트랜잭션)
 *
 *   D1 binding 이름: DB  (wrangler.toml 의 [[d1_databases]] binding)
 * ============================================================ */

const FIELDS = ['category', 'lever', 'dept', 'reducible', 'memo', 'saving', 'splits'];
const JSON_FIELDS = new Set(['dept', 'splits']);

function parseField(field, raw) {
    if (raw == null) return JSON_FIELDS.has(field) ? [] : '';
    if (!JSON_FIELDS.has(field)) return raw;
    try { return JSON.parse(raw); }
    catch (e) { return []; }
}

function serializeField(field, val) {
    if (val == null) return null;
    if (JSON_FIELDS.has(field)) {
        try { return JSON.stringify(val); }
        catch (e) { return null; }
    }
    return String(val);
}

function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

export async function onRequestGet({ env }) {
    try {
        const { results } = await env.DB.prepare('SELECT * FROM expense_edits').all();
        const out = { category: {}, lever: {}, dept: {}, reducible: {}, memo: {}, saving: {}, splits: {} };
        for (const r of (results || [])) {
            for (const f of FIELDS) {
                out[f][r.row_id] = parseField(f, r[f]);
            }
        }
        return jsonResponse(out);
    } catch (e) {
        console.error('GET /api/edits 실패:', e);
        return jsonResponse({ error: '조회 실패', detail: e.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    let payload;
    try { payload = await request.json(); }
    catch (e) { return jsonResponse({ error: '잘못된 JSON 본문' }, 400); }

    if (!payload || typeof payload !== 'object') {
        return jsonResponse({ error: '잘못된 요청 본문' }, 400);
    }

    const idSet = new Set();
    for (const f of FIELDS) {
        if (payload[f] && typeof payload[f] === 'object') {
            for (const id in payload[f]) idSet.add(Number(id));
        }
    }
    const now = Date.now();

    const insertSql = `
        INSERT INTO expense_edits (row_id, category, lever, dept, reducible, memo, saving, splits, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(row_id) DO UPDATE SET
            category   = excluded.category,
            lever      = excluded.lever,
            dept       = excluded.dept,
            reducible  = excluded.reducible,
            memo       = excluded.memo,
            saving     = excluded.saving,
            splits     = excluded.splits,
            updated_at = excluded.updated_at
    `;

    try {
        const statements = [];
        for (const id of idSet) {
            statements.push(env.DB.prepare(insertSql).bind(
                id,
                serializeField('category', payload.category && payload.category[id]),
                serializeField('lever', payload.lever && payload.lever[id]),
                serializeField('dept', payload.dept && payload.dept[id]),
                serializeField('reducible', payload.reducible && payload.reducible[id]),
                serializeField('memo', payload.memo && payload.memo[id]),
                serializeField('saving', payload.saving && payload.saving[id]),
                serializeField('splits', payload.splits && payload.splits[id]),
                now,
            ));
        }
        if (statements.length) await env.DB.batch(statements);
        return jsonResponse({ ok: true, count: idSet.size, updatedAt: now });
    } catch (e) {
        console.error('POST /api/edits 실패:', e);
        return jsonResponse({ error: '저장 실패', detail: e.message }, 500);
    }
}
