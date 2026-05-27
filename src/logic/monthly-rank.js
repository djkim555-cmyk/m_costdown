export default {
    layout: 'default',

    data() {
        return {
            loaded: false,
            items: [],
            selectedItems: [],       // 선택된 항목명 배열 ([] = 전체)
            selectedCategories: [],  // 선택된 분류 배열 ([] = 전체)
        };
    },

    async mounted() {
        try {
            const [items] = await Promise.all([
                fetch('/data/cost-items.json').then((r) => r.json()),
                window.GS.ensureExpenseEdits(),
            ]);
            this.items = window.GS.applyExpenseEdits(items);
        } catch (e) {
            console.error('비용항목 데이터 로딩 실패:', e);
        }
        this.loaded = true;
    },

    computed: {
        // 비용항목별 (개별 행) — 1~4월 월평균 내림차순 (전체 순위 부여)
        // 비용 상세에서 분기된 행은 별도 리스트로 추가되어 순위에 포함된다.
        byItem() {
            const rows = [];
            for (const i of this.items) {
                const item = (i.item || '').trim() || '(미상)';
                const category = (i.category || '').trim();
                const detail = (i.detail || '').trim();
                const vendor = (i.vendor || '').trim();
                const baseDetail = [detail, vendor].filter(Boolean).join(' · ');
                const baseAvg = this.avgQ1(i.months);
                const splits = Array.isArray(i.splits) ? i.splits : [];
                const splitSum = splits.reduce((s, x) => s + (Number(x.percent) || 0), 0);
                const parentPct = Math.max(0, Math.min(100, 100 - splitSum));

                if (!splits.length) {
                    rows.push({ item, category, detailFull: baseDetail || '-', total: baseAvg });
                } else {
                    if (parentPct > 0) {
                        const tag = parentPct < 100 ? `원행 ${parentPct}%` : '';
                        const detailFull = [baseDetail, tag].filter(Boolean).join(' · ') || '-';
                        rows.push({ item, category, detailFull, total: baseAvg * parentPct / 100 });
                    }
                    for (const s of splits) {
                        const pct = Number(s.percent) || 0;
                        if (pct <= 0) continue;
                        const deptArr = Array.isArray(s.dept) ? s.dept.filter(Boolean) : [];
                        const deptLabel = deptArr.join(', ');
                        const tag = `분기 ${pct}%` + (deptLabel ? ` · ${deptLabel}` : '');
                        const detailFull = [baseDetail, tag].filter(Boolean).join(' · ');
                        rows.push({ item, category, detailFull, total: baseAvg * pct / 100 });
                    }
                }
            }
            return rows
                .sort((a, b) => b.total - a.total)
                .map((r, idx) => ({ ...r, rank: idx + 1 }));
        },

        // 항목 필터 옵션 (유니크 항목명)
        itemOptions() {
            return [...new Set(this.byItem.map((r) => r.item))];
        },

        // 분류 필터 옵션 (선택된 항목의 유니크 분류, 빈 분류 제외)
        categoryOptions() {
            if (!this.selectedItems.length) return [];
            const set = new Set();
            for (const r of this.byItem) {
                if (this.selectedItems.includes(r.item) && r.category) set.add(r.category);
            }
            return [...set];
        },

        // 항목 + 분류 필터 적용
        filteredByItem() {
            return this.byItem.filter((r) => {
                if (this.selectedItems.length && !this.selectedItems.includes(r.item)) return false;
                if (this.selectedItems.length && this.selectedCategories.length
                    && !this.selectedCategories.includes(r.category)) return false;
                return true;
            });
        },
    },

    watch: {
        // 항목 선택이 바뀌면 사용할 수 없게 된 분류는 자동 제거
        selectedItems() {
            const valid = new Set(this.categoryOptions);
            this.selectedCategories = this.selectedCategories.filter((c) => valid.has(c));
        },
    },

    methods: {
        short(n) { return window.GS.short(n); },

        toggleAllItems(e) {
            this.selectedItems = e.target.checked ? [...this.itemOptions] : [];
        },
        toggleAllCategories(e) {
            this.selectedCategories = e.target.checked ? [...this.categoryOptions] : [];
        },

        itemLabel() {
            const n = this.selectedItems.length;
            if (!n || n === this.itemOptions.length) return '항목 전체';
            if (n === 1) return this.selectedItems[0];
            return `항목 ${n}개 선택`;
        },
        categoryLabel() {
            const n = this.selectedCategories.length;
            if (!n || n === this.categoryOptions.length) return '분류 전체';
            if (n === 1) return this.selectedCategories[0];
            return `분류 ${n}개 선택`;
        },

        // 1~4월(index 0~3) 월평균
        avgQ1(months) {
            const arr = (months || []).slice(0, 4);
            const sum = arr.reduce((a, b) => a + (Number(b) || 0), 0);
            return sum / 4;
        },

        // 가로 막대 너비 (목록 중 최대값 기준)
        width(value, list) {
            const max = Math.max(1, ...(list || []).map((r) => r.total));
            return Math.max(2, (value / max) * 100) + '%';
        },
    },
};
