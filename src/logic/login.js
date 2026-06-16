export default {
    // 로그인 페이지는 GNB/푸터 없이 전체 화면으로 표시
    layout: null,

    data() {
        return {
            password: '',
            error: '',
            loading: false,
        };
    },

    mounted() {
        // 이미 입장한 상태면 바로 대시보드로 이동
        if (sessionStorage.getItem('authToken')) {
            this.navigateTo('home');
            return;
        }
        if (this.$refs.pw) this.$refs.pw.focus();
    },

    methods: {
        async submit() {
            this.error = '';
            if (!this.password) {
                this.error = '비밀번호를 입력하세요.';
                return;
            }

            this.loading = true;
            try {
                // 비밀번호는 서버에서 검증 — 일치 시 서명된 세션 토큰을 발급받는다
                const base = (window.GS && window.GS.API_BASE) || '';
                const res = await fetch(base + '/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: this.password }),
                });
                const data = await res.json().catch(() => ({}));

                if (!res.ok || !data.token) {
                    this.error = data.error || '비밀번호가 올바르지 않습니다.';
                    this.password = '';
                    this.loading = false;
                    if (this.$refs.pw) this.$refs.pw.focus();
                    return;
                }

                // ViewLogic 인증 토큰 저장 (sessionStorage → 보호 페이지 입장 + API 호출 헤더)
                if (typeof this.setToken === 'function') {
                    this.setToken(data.token);
                } else {
                    sessionStorage.setItem('authToken', data.token);
                }
                // 권한 저장 — GNB 가 이 값을 보고 전략 메뉴 노출 여부를 결정
                sessionStorage.setItem('authRole', data.role || 'full');
                this.navigateTo('home');
            } catch (e) {
                this.error = '서버 연결에 실패했습니다. 잠시 후 다시 시도하세요.';
                this.loading = false;
                if (this.$refs.pw) this.$refs.pw.focus();
            }
        },
    },
};
