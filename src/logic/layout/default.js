export default {
    data() {
        return {
            loggedIn: false,
            authRole: '',
            currentRoute: 'home',
        };
    },

    mounted() {
        this._onHash = () => this.syncState();
        this.syncState();
        window.addEventListener('hashchange', this._onHash);
    },

    unmounted() {
        window.removeEventListener('hashchange', this._onHash);
    },

    computed: {
        // 전략 메뉴 노출 여부 — restricted 권한이면 숨김
        // (구버전 세션처럼 role 정보가 없으면 기본은 노출 — 락아웃 방지)
        showStrategy() {
            return this.authRole !== 'restricted';
        },
    },

    methods: {
        // 로그인 상태와 현재 라우트를 동기화 (GNB 표시용)
        syncState() {
            this.loggedIn = !!sessionStorage.getItem('authToken');
            this.authRole = sessionStorage.getItem('authRole') || '';
            const raw = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
            this.currentRoute = raw || 'home';
        },

        doLogout() {
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('authRole');
            this.loggedIn = false;
            this.authRole = '';
            if (typeof this.navigateTo === 'function') this.navigateTo('login');
            else window.location.hash = '#/login';
        },
    },
};
