/* ============================================================
 * functions/api/login.js — POST /api/login
 *   비밀번호를 서버에서 검증하고 서명된 세션 토큰을 발급한다.
 *   비밀번호 값은 서버 환경변수에만 존재하며 클라이언트로 노출되지 않는다.
 *
 *   요청  : { "password": "..." }
 *   응답  : 200 { ok, role, token }  |  401 { error }
 * ============================================================ */
import { authConfig, resolveRole, issueToken } from '../_session.js';

function json(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

export async function onRequestPost({ request, env }) {
    let body;
    try { body = await request.json(); }
    catch (e) { return json({ error: '잘못된 요청 본문' }, 400); }

    const password = body && typeof body.password === 'string' ? body.password : '';

    const role = await resolveRole(env, password);
    if (!role) return json({ error: '비밀번호가 올바르지 않습니다.' }, 401);

    const { secret } = authConfig(env);
    return json({ ok: true, role, token: await issueToken(secret, role, Date.now()) });
}
