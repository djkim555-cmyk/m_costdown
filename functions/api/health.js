/* /api/health — 서버 동작 확인용 (D1 연결 포함) */
export async function onRequestGet({ env }) {
    let dbOk = false;
    let dbInfo = null;
    try {
        const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM expense_edits').first();
        dbOk = true;
        dbInfo = { rows: row && row.n != null ? row.n : 0 };
    } catch (e) {
        dbInfo = { error: e.message };
    }
    return new Response(JSON.stringify({
        ok: true,
        runtime: 'cloudflare-pages-functions',
        db: dbOk ? 'connected' : 'error',
        info: dbInfo,
    }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
