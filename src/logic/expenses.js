// 담당부서 선택 옵션 (복수 선택)
const DEPT_OPTIONS = ['컨설팅', '마케팅', '경영지원', '범용', '환급', '공공', '위캔디오', 'UI/UX'];

// 절감가능여부 옵션 (아이콘 드롭다운)
const REDUCIBLE_OPTS = [
    { value: '', icon: 'bi-dash-lg', cls: 'text-secondary', label: '미선택' },
    { value: 'O', icon: 'bi-check-circle-fill', cls: 'text-success', label: '가능' },
    { value: 'X', icon: 'bi-x-circle-fill', cls: 'text-danger', label: '불가' },
    { value: '세모', icon: 'bi-triangle-fill', cls: 'text-warning', label: '검토' },
];

// 절감 레버 (전략 유형 대분류) 옵션
const LEVER_OPTIONS = ['가격 인하', '사용량 절감', '통합', '대체', '제거', '구조·시점', '유지'];

// 인라인 편집 컬럼별 localStorage 키 + 초기값 함수
const STORES = {
    category: { key: 'gs-expense-cats', init: (it) => it.category || '' },
    lever: { key: 'gs-expense-lever', init: () => '' },
    // 담당부서: 복수 선택 배열 (원본값이 옵션에 있으면 [값], 없으면 [])
    dept: {
        key: 'gs-expense-depts',
        init: (it) => {
            const d = (it.dept || '').trim();
            return DEPT_OPTIONS.includes(d) ? [d] : [];
        },
    },
    // 절감가능여부: 원본값이 O/X/세모 일 때만 사용, 그 외는 미선택
    reducible: {
        key: 'gs-expense-reducible',
        init: (it) => {
            const r = (it.reducible || '').trim();
            return (r === 'O' || r === 'X' || r === '세모') ? r : '';
        },
    },
    // 절감 메모: 원본값이 O/X/세모 가 아닌 설명성 텍스트면 메모로 보존
    memo: {
        key: 'gs-expense-memos',
        init: (it) => {
            const r = (it.reducible || '').trim();
            return (r && r !== 'O' && r !== 'X' && r !== '세모') ? r : '';
        },
    },
    // 절감금액(E): 추정 절감액 (원본 데이터 없음 → 빈값)
    saving: { key: 'gs-expense-saving', init: () => '' },
};

export default {
    layout: 'default',

    data() {
        // 1~12월 컬럼 (5월은 예상치 → '5월(E)', 필터 없음)
        const monthCols = [];
        for (let i = 0; i < 12; i++) {
            monthCols.push({
                key: 'm' + i,
                label: (i + 1) + '월' + (i === 4 ? '(E)' : ''),
                type: 'num',
                filter: false,
            });
        }

        return {
            loaded: false,
            items: [],
            edits: { category: {}, lever: {}, dept: {}, reducible: {}, memo: {}, saving: {} },
            search: '',
            // 페이지 진입 시 기본 정렬: 항목 컬럼 오름차순
            sortKey: 'item',
            sortDir: 'asc',
            colFilters: {},
            openCol: null,
            valSearch: '',
            dropStyle: {},
            memoModal: { open: false, rowId: null, text: '' },
            deptOptions: DEPT_OPTIONS,
            deptDD: { open: false, rowId: null, style: {} },
            reducibleOpts: REDUCIBLE_OPTS,
            reduceDD: { open: false, rowId: null, style: {} },
            leverOptions: LEVER_OPTIONS,
            columns: [
                { key: 'item', label: '항목', type: 'text' },
                { key: 'category', label: '분류', type: 'text', cls: 'col-cat' },
                { key: 'detail', label: '내용', type: 'text', filter: false, cls: 'col-detail' },
                { key: 'vendor', label: '거래처', type: 'text' },
                { key: 'lever', label: '절감 레버', type: 'text', cls: 'col-sm' },
                { key: 'dept', label: '담당부서', type: 'text', cls: 'col-dept' },
                { key: 'reducible', label: '절감가능여부', type: 'text', cls: 'col-sm' },
                { key: 'memo', label: '절감 방안', type: 'text', cls: 'col-memo' },
                { key: 'saving', label: '절감금액(E)', type: 'text', filter: false, cls: 'col-saving' },
                ...monthCols,
                { key: 'total', label: '합계', type: 'num', filter: false },
            ],
        };
    },

    async mounted() {
        try {
            const items = await fetch('/data/cost-items.json').then((r) => r.json());
            items.forEach((it, idx) => { it._id = idx; });
            this.items = items;

            for (const col in STORES) {
                this.edits[col] = this.loadStore(STORES[col].key, items, STORES[col].init);
            }
            // 담당부서: 구버전 문자열 데이터를 배열로 정규화
            for (const id in this.edits.dept) {
                const v = this.edits.dept[id];
                this.edits.dept[id] = Array.isArray(v)
                    ? v
                    : (typeof v === 'string' && DEPT_OPTIONS.includes(v) ? [v] : []);
            }
        } catch (e) {
            console.error('비용 목록 데이터 로딩 실패:', e);
        }
        this.loaded = true;

        this._close = () => {
            this.openCol = null;
            this.deptDD.open = false;
            this.reduceDD.open = false;
        };
        document.addEventListener('click', this._close);
        document.addEventListener('scroll', this._close, true);
        window.addEventListener('resize', this._close);
    },

    unmounted() {
        document.removeEventListener('click', this._close);
        document.removeEventListener('scroll', this._close, true);
        window.removeEventListener('resize', this._close);
    },

    computed: {
        // 필터 + 검색 + 정렬 적용 결과
        filtered() {
            const list = this.items.filter((row) => this.matchRow(row, null));

            const col = this.columns.find((c) => c.key === this.sortKey);
            const numeric = col && col.type === 'num';
            const dir = this.sortDir === 'asc' ? 1 : -1;
            return list.slice().sort((a, b) => {
                const av = this.raw(a, this.sortKey);
                const bv = this.raw(b, this.sortKey);
                const cmp = numeric
                    ? (av - bv)
                    : String(av).localeCompare(String(bv), 'ko');
                return cmp * dir;
            });
        },

        filteredTotal() {
            return window.GS.sum(this.filtered.map((i) => i.total));
        },

        // 현재 열린 컬럼의 고유값 목록 (엑셀식 연동 + 드롭다운 검색어 반영)
        visibleValues() {
            if (!this.openCol) return [];
            // 다른 컬럼 필터가 적용된 결과에 존재하는 값만 표시
            const all = this.distinctFrom(this.openCol, this.rowsExcept(this.openCol));
            const q = this.valSearch.trim().toLowerCase();
            return q ? all.filter((v) => v.label.toLowerCase().includes(q)) : all;
        },
    },

    methods: {
        comma(n) { return window.GS.comma(n); },

        // 0원은 '–' 로 표기
        cell(n) { return n ? window.GS.comma(n) : '–'; },

        // 특정 월(0~11)의 합계 (필터 적용 결과 기준)
        monthTotal(idx) {
            return window.GS.sum(this.filtered.map((r) => r.months[idx] || 0));
        },

        // 절감금액(E) 문자열 → 숫자
        savingNum(id) {
            return Number(String(this.edits.saving[id] || '').replace(/[^\d.-]/g, '')) || 0;
        },

        // 절감금액(E) 합계 (필터 적용 결과 기준)
        savingTotal() {
            return window.GS.sum(this.filtered.map((r) => this.savingNum(r._id)));
        },

        // 절감금액 입력값을 천단위 콤마로 정리 후 저장
        formatSaving(id) {
            const n = this.savingNum(id);
            this.edits.saving[id] = n ? window.GS.comma(n) : '';
            this.saveEdit('saving');
        },

        // localStorage 값을 불러오고, 없으면 init 함수로 초기화
        loadStore(storeKey, items, initFn) {
            let saved = {};
            try {
                saved = JSON.parse(localStorage.getItem(storeKey) || '{}');
            } catch (e) {
                saved = {};
            }
            const result = {};
            for (const it of items) {
                result[it._id] = (it._id in saved) ? saved[it._id] : initFn(it);
            }
            return result;
        },

        // 컬럼의 원본 값 (필터·정렬 기준)
        raw(row, key) {
            if (key === 'dept') return (this.edits.dept[row._id] || []).join(', ');
            if (key in this.edits) return (this.edits[key][row._id] || '').trim();
            if (key === 'total') return row.total;
            if (/^m\d+$/.test(key)) return row.months[Number(key.slice(1))] || 0;
            return row[key] || '';
        },

        // 행이 필터·검색 조건을 통과하는지 (excludeKey 컬럼 필터는 제외)
        matchRow(row, excludeKey) {
            for (const key in this.colFilters) {
                if (key === excludeKey) continue;
                if (!this.colFilters[key].includes(String(this.raw(row, key)))) return false;
            }
            const q = this.search.trim().toLowerCase();
            if (q) {
                const hay = [
                    row.item, row.detail, row.vendor,
                    this.raw(row, 'category'), this.raw(row, 'lever'),
                    this.raw(row, 'dept'), this.raw(row, 'reducible'),
                    this.raw(row, 'memo'),
                ].join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        },

        // excludeKey 컬럼 필터만 제외하고 통과한 행들 (엑셀식 연동 필터용)
        rowsExcept(excludeKey) {
            return this.items.filter((row) => this.matchRow(row, excludeKey));
        },

        // 주어진 행 집합에서 컬럼 key 의 고유값 목록 → [{ raw, label }]
        distinctFrom(key, rows) {
            const col = this.columns.find((c) => c.key === key);
            const isNum = col && col.type === 'num';
            const seen = new Map();
            for (const row of rows) {
                const r = this.raw(row, key);
                const k = String(r);
                if (!seen.has(k)) seen.set(k, r);
            }
            const arr = [...seen.values()];
            arr.sort((a, b) => isNum
                ? (a - b)
                : String(a).localeCompare(String(b), 'ko'));
            return arr.map((r) => {
                let label = isNum
                    ? (r ? window.GS.comma(r) + '원' : '(0원)')
                    : (String(r).trim() === '' ? '(비어 있음)' : String(r));
                // 절감가능여부는 필터 목록에도 아이콘 표시
                if (key === 'reducible') {
                    label = { '': '(비어 있음)', O: 'O · 가능', X: 'X · 불가', '세모': '세모 · 검토' }[r] || label;
                }
                return { raw: r, label };
            });
        },

        // 전체 고유값 목록 (필터 토글·전체선택 판정 기준)
        distinct(key) {
            return this.distinctFrom(key, this.items);
        },

        isColActive(key) {
            return Object.prototype.hasOwnProperty.call(this.colFilters, key);
        },

        isChecked(key, raw) {
            const f = this.colFilters[key];
            return !f || f.includes(String(raw));
        },

        allChecked(key) {
            const f = this.colFilters[key];
            return !f || f.length === this.distinct(key).length;
        },

        toggleValue(key, raw) {
            const all = this.distinct(key).map((d) => String(d.raw));
            const cur = this.colFilters[key] ? this.colFilters[key].slice() : all.slice();
            const s = String(raw);
            const i = cur.indexOf(s);
            if (i >= 0) cur.splice(i, 1);
            else cur.push(s);

            if (cur.length === all.length) delete this.colFilters[key];
            else this.colFilters[key] = cur;
        },

        toggleAll(key) {
            if (this.allChecked(key)) this.colFilters[key] = [];
            else delete this.colFilters[key];
        },

        clearColFilter(key) {
            delete this.colFilters[key];
        },

        applySort(key, dir) {
            this.sortKey = key;
            this.sortDir = dir;
            this.openCol = null;
        },

        toggleDropdown(key, ev) {
            if (this.openCol === key) {
                this.openCol = null;
                return;
            }
            this.openCol = key;
            this.valSearch = '';
            this.deptDD.open = false;
            this.reduceDD.open = false;

            const rect = ev.currentTarget.getBoundingClientRect();
            const width = 250;
            let left = rect.right - width;
            if (left < 8) left = 8;
            if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
            this.dropStyle = {
                position: 'fixed',
                top: (rect.bottom + 4) + 'px',
                left: left + 'px',
            };
        },

        resetAll() {
            this.colFilters = {};
            this.search = '';
            this.valSearch = '';
            this.sortKey = 'item';
            this.sortDir = 'asc';
            this.openCol = null;
        },

        // 절감 방안 상세 팝업
        openMemo(id) {
            this.memoModal = { open: true, rowId: id, text: this.edits.memo[id] || '' };
        },

        closeMemo() {
            this.memoModal.open = false;
        },

        saveMemoModal() {
            if (this.memoModal.rowId != null) {
                this.edits.memo[this.memoModal.rowId] = this.memoModal.text;
                this.saveEdit('memo');
            }
            this.memoModal.open = false;
        },

        // 담당부서 복수 선택 드롭다운
        deptArr(id) {
            return this.edits.dept[id] || [];
        },

        openDeptDD(id, ev) {
            if (this.deptDD.open && this.deptDD.rowId === id) {
                this.deptDD.open = false;
                return;
            }
            this.openCol = null;
            this.reduceDD.open = false;
            const rect = ev.currentTarget.getBoundingClientRect();
            const width = 170;
            let left = rect.left;
            if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
            if (left < 8) left = 8;
            this.deptDD = {
                open: true,
                rowId: id,
                style: { position: 'fixed', top: (rect.bottom + 4) + 'px', left: left + 'px' },
            };
        },

        toggleDept(opt) {
            const id = this.deptDD.rowId;
            if (id == null) return;
            const arr = (this.edits.dept[id] || []).slice();
            const i = arr.indexOf(opt);
            if (i >= 0) arr.splice(i, 1);
            else arr.push(opt);
            this.edits.dept[id] = arr;
            this.saveEdit('dept');
        },

        clearDept() {
            const id = this.deptDD.rowId;
            if (id == null) return;
            this.edits.dept[id] = [];
            this.saveEdit('dept');
        },

        closeDeptDD() {
            this.deptDD.open = false;
        },

        // 절감가능여부 아이콘 드롭다운
        reduceIcon(value) {
            const o = REDUCIBLE_OPTS.find((x) => x.value === (value || '')) || REDUCIBLE_OPTS[0];
            return ['bi', o.icon, o.cls];
        },

        openReduceDD(id, ev) {
            if (this.reduceDD.open && this.reduceDD.rowId === id) {
                this.reduceDD.open = false;
                return;
            }
            this.openCol = null;
            this.deptDD.open = false;
            const rect = ev.currentTarget.getBoundingClientRect();
            const width = 124;
            let left = rect.left;
            if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
            if (left < 8) left = 8;
            this.reduceDD = {
                open: true,
                rowId: id,
                style: { position: 'fixed', top: (rect.bottom + 4) + 'px', left: left + 'px' },
            };
        },

        pickReduce(value) {
            const id = this.reduceDD.rowId;
            if (id != null) {
                this.edits.reducible[id] = value;
                this.saveEdit('reducible');
            }
            this.reduceDD.open = false;
        },

        // 인라인 편집값을 localStorage 에 저장
        saveEdit(col) {
            try {
                localStorage.setItem(STORES[col].key, JSON.stringify(this.edits[col]));
            } catch (e) {
                console.error('저장 실패:', col, e);
            }
        },
    },
};
