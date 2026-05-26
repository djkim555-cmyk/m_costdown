export default {
    layout: 'default',

    data() {
        return {
            loaded: false,
            items: [],    // 비용절감 항목 (data/cost-items.json)
            tables: [],   // 예측·전략 수행 표 (data/forecast.json)
            // 두 표 컬럼 너비 정렬용 (항목 + 1~4월 + 5~12월 + 평균/합계/비중)
            colWidths: [156, 88, 88, 88, 88, 120, 120, 120, 120, 120, 120, 120, 120, 92, 108, 62],
        };
    },

    async mounted() {
        try {
            const [items, forecast] = await Promise.all([
                fetch('/data/cost-items.json').then((r) => r.json()),
                fetch('/data/forecast.json').then((r) => r.json()),
                window.GS.ensureExpenseEdits(),
            ]);
            this.items = window.GS.applyExpenseEdits(items);
            this.tables = forecast.tables || [];
        } catch (e) {
            console.error('대시보드 데이터 로딩 실패:', e);
        }
        this.loaded = true;
    },

    computed: {
        // 거래처별 비용 — 1~4월 월평균 (내림차순)
        byVendor() {
            return window.GS.groupSum(
                this.items,
                (i) => i.vendor || '(미상)',
                (i) => this.avgQ1(i.months),
            );
        },

        // 분류별 비용 — 1~4월 월평균 (비용 상세에서 편집한 분류 반영)
        byCategory() {
            return window.GS.groupSum(
                this.items,
                (i) => (i.category || '').trim() || '(미분류)',
                (i) => this.avgQ1(i.months),
            );
        },
    },

    methods: {
        comma(n) { return window.GS.comma(n); },
        short(n) { return window.GS.short(n); },

        // 1~4월(index 0~3) 월평균
        avgQ1(months) {
            const arr = (months || []).slice(0, 4);
            const sum = arr.reduce((a, b) => a + (Number(b) || 0), 0);
            return sum / 4;
        },

        // 비중(%) 표기
        ratioText(r) {
            return (r == null) ? '-' : r.toFixed(2) + '%';
        },

        // 가로 막대 너비 (목록 중 최대값 기준)
        width(value, list) {
            const max = Math.max(1, ...(list || []).map((r) => r.total));
            return Math.max(2, (value / max) * 100) + '%';
        },

        // (행 ri, 월 mi) 셀의 절감율 = (기준표값 - 현재값) / 기준표값
        cellSaving(tbl, ri, mi) {
            if (tbl.baseRef == null || mi < tbl.forecastFrom) return null;
            const cur = tbl.rows[ri].values[mi];
            const baseTbl = this.tables[tbl.baseRef];
            const base = (baseTbl && baseTbl.rows[ri]) ? baseTbl.rows[ri].values[mi] : null;
            if (cur == null || !base) return null;
            return (base - cur) / base;
        },

        // 절감율 행: 소계(kind 'sub') 기준 월별 절감율 배열
        savingRow(tbl) {
            const si = tbl.rows.findIndex((r) => r.kind === 'sub');
            if (si < 0) return [];
            return tbl.rows[si].values.map((v, mi) => this.cellSaving(tbl, si, mi));
        },

        // 절감율 텍스트 (▼ 절감 / ▲ 증가)
        savingText(r) {
            if (r == null) return '';
            return (r >= 0 ? '▼' : '▲') + (Math.abs(r) * 100).toFixed(1) + '%';
        },

        // 절감율 색상 클래스
        savingClass(r) {
            if (r == null) return '';
            return r >= 0 ? 'down' : 'up';
        },
    },
};
