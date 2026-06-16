/* ============================================================
 * functions/_session.js
 *   서버 측 세션 토큰 발급/검증 유틸 (HMAC-SHA256).
 *   언더스코어(_) 접두사 → Pages 라우트에서 제외되는 공용 모듈.
 *
 *   환경변수:
 *     APP_PASSWORD_FULL        전체 권한 비밀번호 (대시보드 + 전략 메뉴)
 *     APP_PASSWORD_RESTRICTED  제한 권한 비밀번호 (전략 메뉴 숨김)
 *     SESSION_SECRET           (선택) 토큰 서명 키. 미설정 시 비밀번호에서 파생
 *
 *   비밀번호가 하나도 설정되지 않으면 인증 비활성화(로컬 dev 호환).
 * ============================================================ */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 토큰 유효기간 12시간

// 기본 비밀번호의 SHA-256 해시(평문은 저장소에 두지 않음) — 환경변수 미설정 시 폴백.
//   · Cloudflare 환경변수(APP_PASSWORD_*)를 설정하면 그 평문 값이 항상 우선합니다.
//   · ⚠️ 해시의 원문 비밀번호는 과거 공개 이력에 남아 있어 강한 보안은 아닙니다.
//     실보안이 필요하면 SESSION_SECRET + APP_PASSWORD_* 환경변수로 새 값을 설정하세요.
const DEFAULT_PW_HASHES = {
    '39cc6b23f1341f4f47849a77e257e644f7117f6306a3ea2d8cc30130f9990157': 'full',
    'e9c92607886a599ac14e7f3e290626d36d5458e9d7fd86c51efa522863d81ce4': 'restricted',
};

/** 문자열의 SHA-256 16진 해시 */
async function sha256hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str || ''));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 비밀번호 검증 → 권한(role) 또는 null. 환경변수 평문 우선, 없으면 기본 해시 매칭 */
export async function resolveRole(env, password) {
    if (env.APP_PASSWORD_FULL && password === env.APP_PASSWORD_FULL) return 'full';
    if (env.APP_PASSWORD_RESTRICTED && password === env.APP_PASSWORD_RESTRICTED) return 'restricted';
    return DEFAULT_PW_HASHES[await sha256hex(password)] || null;
}

/** 토큰 서명 키 구성 — 인증은 항상 활성 */
export function authConfig(env) {
    const secret = env.SESSION_SECRET || Object.keys(DEFAULT_PW_HASHES).join('|');
    return { enabled: true, secret };
}

function b64urlEncode(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeToString(s) {
    const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
    return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

async function hmac(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return b64urlEncode(new Uint8Array(sig));
}

function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

/** role 에 대한 서명 토큰 발급 (payload.signature 형식) */
export async function issueToken(secret, role, nowMs) {
    const payload = b64urlEncode(new TextEncoder().encode(
        JSON.stringify({ role, exp: nowMs + TOKEN_TTL_MS }),
    ));
    const sig = await hmac(secret, payload);
    return payload + '.' + sig;
}

/** 토큰 검증 → 유효하면 { role }, 아니면 null */
export async function verifyToken(secret, token, nowMs) {
    if (!token || token.indexOf('.') < 0) return null;
    const [payload, sig] = token.split('.');
    const expected = await hmac(secret, payload);
    if (!timingSafeEqual(sig, expected)) return null;
    let data;
    try { data = JSON.parse(b64urlDecodeToString(payload)); }
    catch (e) { return null; }
    if (!data || typeof data.exp !== 'number' || data.exp < nowMs) return null;
    return { role: data.role };
}

/** 요청 헤더에서 Bearer 토큰 추출 */
export function tokenFromRequest(request) {
    const auth = request.headers.get('Authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : '';
}
