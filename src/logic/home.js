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
            this.applyActuals();
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

        // 비용 상세에서 입력된 월별 실제 비용을 '절감 전략 수행' 표에 덮어쓴다.
        //   · 항목 행(지급수수료/광고선전비/외주비) + 소계 행의 5~12월(forecastFrom~)을 실제값으로 채움
        //   · 실제값이 있는 월은 컬럼 라벨의 '(E)'(예상치 표시)를 떼어 실측월로 표시
        //   · 회사 예측과의 증감(%)은 기존 cellSaving/savingText 가 셀마다 자동 표시
        applyActuals() {
            const tbl = this.tables.find((t) => t.baseRef != null);
            if (!tbl) return;

            // 항목명별 유효 월 실적 합계 (cost-items + 편집 반영)
            const groups = {};
            for (const it of this.items) {
                const name = (it.item || '').trim();
                if (!name) continue;
                const g = groups[name] || (groups[name] = new Array(12).fill(0));
                (it.months || []).forEach((v, i) => { g[i] += (Number(v) || 0); });
            }

            const from = tbl.forecastFrom;
            const itemRows = tbl.rows.filter((r) => r.kind === 'item');
            const hasActual = new Array(12).fill(false);

            // 항목 행: 실적 합계로 덮어쓰기 (0원이면 미입력으로 보고 null 유지)
            for (const row of itemRows) {
                const g = groups[(row.name || '').trim()];
                if (!g) continue;
                for (let mi = from; mi < 12; mi++) {
                    if (g[mi] > 0) {
                        row.values[mi] = g[mi];
                        hasActual[mi] = true;
                    }
                }
            }

            // 소계 행: 항목 행 실적 합 (해당 월에 실적이 하나라도 있을 때만)
            const sub = tbl.rows.find((r) => r.kind === 'sub');
            if (sub) {
                for (let mi = from; mi < 12; mi++) {
                    if (!hasActual[mi]) continue;
                    let s = 0;
                    for (const row of itemRows) {
                        const v = row.values[mi];
                        if (v != null) s += v;
                    }
                    sub.values[mi] = s;
                }
            }

            // 합계 컬럼 재계산 (실적이 쌓일수록 누적)
            for (const row of tbl.rows) {
                if (row.kind === 'item' || row.kind === 'sub') {
                    row.total = row.values.reduce((a, v) => a + (v == null ? 0 : v), 0);
                }
            }

            // 실적이 입력된 월은 컬럼 라벨에서 '(E)' 제거 (예측 → 실측)
            (tbl.cols || []).forEach((c, ci) => {
                if (hasActual[ci] && typeof c.label === 'string') {
                    c.label = c.label.replace('(E)', '');
                }
            });
        },

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
