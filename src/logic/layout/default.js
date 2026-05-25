export default {
    data() {
        return {
            loggedIn: false,
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

    methods: {
        // 로그인 상태와 현재 라우트를 동기화 (GNB 표시용)
        syncState() {
            this.loggedIn = !!sessionStorage.getItem('authToken');
            const raw = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
            this.currentRoute = raw || 'home';
        },

        doLogout() {
            sessionStorage.removeItem('authToken');
            this.loggedIn = false;
            if (typeof this.navigateTo === 'function') this.navigateTo('login');
            else window.location.hash = '#/login';
        },
    },
};
