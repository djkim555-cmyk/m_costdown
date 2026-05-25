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
            // 입력 처리 UX를 위한 짧은 지연
            await new Promise((resolve) => setTimeout(resolve, 250));

            if (this.password === window.APP_PASSWORD) {
                // ViewLogic 인증 토큰 발급 (sessionStorage 저장 → 보호 페이지 입장 허용)
                if (typeof this.setToken === 'function') {
                    this.setToken('granted');
                } else {
                    sessionStorage.setItem('authToken', 'granted');
                }
                this.navigateTo('home');
            } else {
                this.error = '비밀번호가 올바르지 않습니다.';
                this.password = '';
                this.loading = false;
                if (this.$refs.pw) this.$refs.pw.focus();
            }
        },
    },
};
