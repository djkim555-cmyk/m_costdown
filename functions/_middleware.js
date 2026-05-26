/* ============================================================
 * functions/_middleware.js
 *   /api/* 경로에 대해 APP_PASSWORD 환경변수가 설정된 경우에만 인증 적용.
 *   요청은 X-App-Password 헤더로 비밀번호를 전달해야 함.
 *
 *   APP_PASSWORD 미설정 시: 인증 없이 통과 (개발용 기본값)
 * ============================================================ */
export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // /api/* 외의 경로(정적 파일)는 미들웨어 패스
    if (!url.pathname.startsWith('/api/')) return next();

    // APP_PASSWORD 미설정이면 인증 생략 (로컬 dev / 초기 배포 호환)
    if (!env.APP_PASSWORD) return next();

    // 비밀번호 일치 확인 — 헤더 또는 쿠키 둘 다 허용
    const fromHeader = request.headers.get('X-App-Password');
    const cookie = request.headers.get('Cookie') || '';
    const fromCookie = (cookie.match(/(?:^|;\s*)app_pw=([^;]+)/) || [])[1];
    const given = fromHeader || (fromCookie ? decodeURIComponent(fromCookie) : '');

    if (given === env.APP_PASSWORD) return next();
    return new Response(JSON.stringify({ error: '인증 실패' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
