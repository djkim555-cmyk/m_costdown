/* ============================================================
 * functions/_middleware.js
 *   /api/* 보호 미들웨어.
 *   · 공개 경로(/api/login, /api/health)는 통과
 *   · 그 외 /api/* 는 Authorization: Bearer <token> 헤더의
 *     서명 세션 토큰을 검증 (POST /api/login 으로 발급받은 값)
 *   · 비밀번호 환경변수 미설정 시 인증 생략 (로컬 dev / 초기 배포 호환)
 * ============================================================ */
import { authConfig, verifyToken, tokenFromRequest } from './_session.js';

const PUBLIC_PATHS = new Set(['/api/login', '/api/health']);

export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // /api/* 외의 경로(정적 파일)는 미들웨어 패스
    if (!url.pathname.startsWith('/api/')) return next();
    if (PUBLIC_PATHS.has(url.pathname)) return next();

    const { enabled, secret } = authConfig(env);
    if (!enabled) return next(); // 비밀번호 미설정 → 인증 생략

    const session = await verifyToken(secret, tokenFromRequest(request), Date.now());
    if (session) return next();

    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
