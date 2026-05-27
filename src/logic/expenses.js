// 담당부서 선택 옵션 (복수 선택)
const DEPT_OPTIONS = ['컨설팅', '마케팅', '경영지원', '범용', '환급', '공공', '위캔디오', 'UI/UX', '기타'];

// 절감가능여부 옵션 (아이콘 드롭다운)
const REDUCIBLE_OPTS = [
    { value: '', icon: 'bi-dash-lg', cls: 'text-secondary', label: '미선택' },
    { value: 'O', icon: 'bi-check-circle-fill', cls: 'text-success', label: '가능' },
    { value: 'X', icon: 'bi-x-circle-fill', cls: 'text-danger', label: '불가' },
    { value: '세모', icon: 'bi-triangle-fill', cls: 'text-warning', label: '검토' },
];

// 절감 레버 (전략 유형 대분류) 옵션
const LEVER_OPTIONS = ['가격 인하', '사용량 절감', '통합', '대체', '제거', '구조·시점', '유지'];

// 인라인 편집 컬럼별 초기값 함수 (서버에 해당 row 가 없을 때 채울 기본값)
const STORES = {
    category: { init: (it) => it.category || '' },
    lever: { init: () => '' },
    // 담당부서: 복수 선택 배열 (원본값이 옵션에 있으면 [값], 없으면 [])
    dept: {
        init: (it) => {
            const d = (it.dept || '').trim();
            return DEPT_OPTIONS.includes(d) ? [d] : [];
        },
    },
    // 절감가능여부: 원본값이 O/X/세모 일 때만 사용, 그 외는 미선택
    reducible: {
        init: (it) => {
            const r = (it.reducible || '').trim();
            return (r === 'O' || r === 'X' || r === '세모') ? r : '';
        },
    },
    // 절감 메모: 원본값이 O/X/세모 가 아닌 설명성 텍스트면 메모로 보존
    memo: {
        init: (it) => {
            const r = (it.reducible || '').trim();
            return (r && r !== 'O' && r !== 'X' && r !== '세모') ? r : '';
        },
    },
    // 절감금액(E): 추정 절감액 (원본 데이터 없음 → 빈값)
    saving: { init: () => '' },
    // 절감시기: 절감 시작 년월 (YYYY-MM, 원본 데이터 없음 → 빈값)
    saving_month: { init: () => '' },
    // 비용분기: 행을 팀별로 % 분기한 하위 행 목록 [{ dept, percent }]
    splits: { init: () => [] },
};

// 인라인 편집 시 서버 PUSH 디바운스 (ms)
const SAVE_DEBOUNCE_MS = 600;

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
            edits: { category: {}, lever: {}, dept: {}, reducible: {}, memo: {}, saving: {}, saving_month: {}, splits: {} },
            search: '',
            // 페이지 진입 시 기본 정렬: 항목 컬럼 오름차순
            sortKey: 'item',
            sortDir: 'asc',
            colFilters: {},
            openCol: null,
            valSearch: '',
            dropStyle: {},
            memoModal: { open: false, rowId: null, splitIdx: null, text: '' },
            updateMsg: '',
            offline: false,
            saving: false,
            deptOptions: DEPT_OPTIONS,
            deptDD: { open: false, rowId: null, splitIdx: null, style: {} },
            reducibleOpts: REDUCIBLE_OPTS,
            reduceDD: { open: false, rowId: null, splitIdx: null, style: {} },
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
                { key: 'branch', label: '비용분기', type: 'text', filter: false, cls: 'col-branch' },
                { key: 'saving', label: '절감금액(E)', type: 'text', filter: false, cls: 'col-saving' },
                { key: 'saving_month', label: '절감시기~', type: 'text', filter: false, cls: 'col-saving-month' },
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

            // 서버에서 편집값 로드 (최초 1회는 localStorage 마이그레이션도 처리됨)
            const serverEdits = await window.GS.ensureExpenseEdits(true);
            this.offline = !!window.GS._editsOffline;

            for (const col in STORES) {
                this.edits[col] = this.mergeServerEdits(items, serverEdits[col] || {}, STORES[col].init);
            }
            // 담당부서: 구버전 문자열 데이터를 배열로 정규화
            for (const id in this.edits.dept) {
                const v = this.edits.dept[id];
                this.edits.dept[id] = Array.isArray(v)
                    ? v
                    : (typeof v === 'string' && DEPT_OPTIONS.includes(v) ? [v] : []);
            }
            // 비용분기: 구버전 split 항목을 전체 편집 필드를 가진 형태로 정규화
            for (const id in this.edits.splits) {
                const arr = this.edits.splits[id];
                this.edits.splits[id] = Array.isArray(arr)
                    ? arr.map((s) => this.normSplit(s))
                    : [];
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

        // 전체 분기 행 건수 (모든 행의 splits 배열 길이 합)
        totalSplitCount() {
            let n = 0;
            for (const id in this.edits.splits) {
                const arr = this.edits.splits[id];
                if (Array.isArray(arr)) n += arr.length;
            }
            return n;
        },

        // 1~4월 비용 합계 (필터된 행)
        q1Sum() {
            return window.GS.sum(this.filtered.map((r) =>
                (r.months[0] || 0) + (r.months[1] || 0) + (r.months[2] || 0) + (r.months[3] || 0)
            ));
        },

        // 1~4월 월평균 = q1Sum / 4
        q1MonthlyAvg() {
            return this.q1Sum / 4;
        },

        // 절감비율 = 절감금액(E) 합계 / 1~4월 월평균
        savingRatio() {
            const avg = this.q1MonthlyAvg;
            if (!avg) return 0;
            return window.GS.sum(this.filtered.map((r) => this.savingNum(r._id))) / avg;
        },

        // 현재 열린 컬럼의 고유값 목록 (엑셀식 연동 + 드롭다운 검색어 반영)
        visibleValues() {
            if (!this.openCol) return [];
            // 다른 컬럼 필터가 적용된 결과에 존재하는 값만 표시
            const all = this.distinctFrom(this.openCol, this.rowsExcept(this.openCol));
            const q = this.valSearch.trim().toLowerCase();
            return q ? all.filter((v) => v.label.toLowerCase().includes(q)) : all;
        },

        // 담당부서 드롭다운이 가리키는 현재 부서 배열 (부모행 또는 분기행)
        ddDeptArr() {
            const { rowId, splitIdx } = this.deptDD;
            if (rowId == null) return [];
            if (splitIdx != null) {
                const s = (this.edits.splits[rowId] || [])[splitIdx];
                return (s && Array.isArray(s.dept)) ? s.dept : [];
            }
            return this.edits.dept[rowId] || [];
        },

        // 절감가능여부 드롭다운이 가리키는 현재 값 (부모행 또는 분기행)
        ddReducible() {
            const { rowId, splitIdx } = this.reduceDD;
            if (rowId == null) return '';
            if (splitIdx != null) {
                const s = (this.edits.splits[rowId] || [])[splitIdx];
                return (s && s.reducible) || '';
            }
            return this.edits.reducible[rowId] || '';
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

        // 서버 편집값을 items 와 머지 — 서버에 키가 있으면 그 값, 없으면 initFn 기본값
        mergeServerEdits(items, saved, initFn) {
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
                const f = this.colFilters[key];
                // 담당부서: 개별 부서 단위 매칭 (배열에 하나라도 포함되면 통과)
                if (key === 'dept') {
                    const arr = this.edits.dept[row._id] || [];
                    if (!arr.length) {
                        if (!f.includes('')) return false;
                    } else if (!arr.some((d) => f.includes(d))) {
                        return false;
                    }
                    continue;
                }
                if (!f.includes(String(this.raw(row, key)))) return false;
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
            // 담당부서: 개별 부서 단위 노출 + DEPT_OPTIONS 전체 항상 포함 (미사용 부서도 필터 가능)
            if (key === 'dept') {
                const set = new Set(DEPT_OPTIONS);
                let hasEmpty = false;
                for (const row of rows) {
                    const arr = this.edits.dept[row._id] || [];
                    if (!arr.length) hasEmpty = true;
                    else for (const d of arr) set.add(d);
                }
                const list = [...set].sort((a, b) => String(a).localeCompare(String(b), 'ko'))
                    .map((r) => ({ raw: r, label: r }));
                if (hasEmpty) list.unshift({ raw: '', label: '(비어 있음)' });
                return list;
            }

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

        // 절감 방안 상세 팝업 (부모행 또는 분기행)
        openMemo(id, splitIdx) {
            let text = '';
            if (splitIdx != null) {
                const s = (this.edits.splits[id] || [])[splitIdx];
                text = (s && s.memo) || '';
            } else {
                text = this.edits.memo[id] || '';
            }
            this.memoModal = { open: true, rowId: id, splitIdx: splitIdx == null ? null : splitIdx, text };
        },

        closeMemo() {
            this.memoModal.open = false;
        },

        saveMemoModal() {
            const { rowId, splitIdx, text } = this.memoModal;
            if (rowId == null) { this.memoModal.open = false; return; }
            if (splitIdx != null) {
                const arr = (this.edits.splits[rowId] || []).slice();
                if (arr[splitIdx]) {
                    arr[splitIdx] = { ...arr[splitIdx], memo: text };
                    this.edits.splits[rowId] = arr;
                    this.saveEdit('splits');
                }
            } else {
                this.edits.memo[rowId] = text;
                this.saveEdit('memo');
            }
            this.memoModal.open = false;
        },

        // 담당부서 복수 선택 드롭다운 (부모행 또는 분기행)
        deptArr(id) {
            return this.edits.dept[id] || [];
        },

        openDeptDD(id, splitIdx, ev) {
            if (this.deptDD.open && this.deptDD.rowId === id && this.deptDD.splitIdx === (splitIdx == null ? null : splitIdx)) {
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
                splitIdx: splitIdx == null ? null : splitIdx,
                style: { position: 'fixed', top: (rect.bottom + 4) + 'px', left: left + 'px' },
            };
        },

        toggleDept(opt) {
            const { rowId, splitIdx } = this.deptDD;
            if (rowId == null) return;
            if (splitIdx != null) {
                const arr = (this.edits.splits[rowId] || []).slice();
                if (!arr[splitIdx]) return;
                const dept = Array.isArray(arr[splitIdx].dept) ? arr[splitIdx].dept.slice() : [];
                const i = dept.indexOf(opt);
                if (i >= 0) dept.splice(i, 1);
                else dept.push(opt);
                arr[splitIdx] = { ...arr[splitIdx], dept };
                this.edits.splits[rowId] = arr;
                this.saveEdit('splits');
            } else {
                const arr = (this.edits.dept[rowId] || []).slice();
                const i = arr.indexOf(opt);
                if (i >= 0) arr.splice(i, 1);
                else arr.push(opt);
                this.edits.dept[rowId] = arr;
                this.saveEdit('dept');
            }
        },

        clearDept() {
            const { rowId, splitIdx } = this.deptDD;
            if (rowId == null) return;
            if (splitIdx != null) {
                const arr = (this.edits.splits[rowId] || []).slice();
                if (!arr[splitIdx]) return;
                arr[splitIdx] = { ...arr[splitIdx], dept: [] };
                this.edits.splits[rowId] = arr;
                this.saveEdit('splits');
            } else {
                this.edits.dept[rowId] = [];
                this.saveEdit('dept');
            }
        },

        closeDeptDD() {
            this.deptDD.open = false;
        },

        // 절감가능여부 아이콘 드롭다운 (부모행 또는 분기행)
        reduceIcon(value) {
            const o = REDUCIBLE_OPTS.find((x) => x.value === (value || '')) || REDUCIBLE_OPTS[0];
            return ['bi', o.icon, o.cls];
        },

        openReduceDD(id, splitIdx, ev) {
            if (this.reduceDD.open && this.reduceDD.rowId === id && this.reduceDD.splitIdx === (splitIdx == null ? null : splitIdx)) {
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
                splitIdx: splitIdx == null ? null : splitIdx,
                style: { position: 'fixed', top: (rect.bottom + 4) + 'px', left: left + 'px' },
            };
        },

        pickReduce(value) {
            const { rowId, splitIdx } = this.reduceDD;
            if (rowId == null) { this.reduceDD.open = false; return; }
            if (splitIdx != null) {
                const arr = (this.edits.splits[rowId] || []).slice();
                if (arr[splitIdx]) {
                    arr[splitIdx] = { ...arr[splitIdx], reducible: value };
                    this.edits.splits[rowId] = arr;
                    this.saveEdit('splits');
                }
            } else {
                this.edits.reducible[rowId] = value;
                this.saveEdit('reducible');
            }
            this.reduceDD.open = false;
        },

        // 인라인 편집값 변경 시 디바운스 후 서버에 자동 저장 (col 은 호환용, 사용 안 함)
        saveEdit(_col) {
            clearTimeout(this._saveTimer);
            this._saveTimer = setTimeout(() => { this.pushToServer(false); }, SAVE_DEBOUNCE_MS);
        },

        // 현재 편집값 전체를 서버에 PUSH
        async pushToServer(showToast) {
            this.saving = true;
            try {
                const payload = {};
                for (const col in STORES) payload[col] = this.edits[col];
                await window.GS.saveExpenseEdits(payload);
                this.offline = false;
                if (showToast) {
                    this.updateMsg = '저장 완료 — 대시보드·월비용 순위·절감 전략 방안에 반영됩니다';
                    clearTimeout(this._toastTimer);
                    this._toastTimer = setTimeout(() => { this.updateMsg = ''; }, 2400);
                }
                window.dispatchEvent(new CustomEvent('gs-expense-edits-applied'));
            } catch (e) {
                this.offline = true;
                this.updateMsg = '서버 저장 실패 — 임시로 브라우저에만 저장되었습니다';
                clearTimeout(this._toastTimer);
                this._toastTimer = setTimeout(() => { this.updateMsg = ''; }, 3500);
            } finally {
                this.saving = false;
            }
        },

        // 저장하기 버튼: 디바운스 대기 중인 변경까지 즉시 flush
        async saveAll() {
            clearTimeout(this._saveTimer);
            await this.pushToServer(true);
        },

        // ── 비용분기 ────────────────────────────────────────────────
        // 행을 팀별 %로 쪼개 아래에 하위 행 추가, 분기 행도 부모 행과 동일한 항목 편집 가능
        // 분기 행 삭제 시 부모 행 데이터는 절대 영향받지 않음

        // 분기 항목 정규화 (구버전 데이터 호환)
        normSplit(s) {
            const obj = (s && typeof s === 'object') ? s : {};
            let dept;
            if (Array.isArray(obj.dept)) dept = obj.dept.filter((d) => DEPT_OPTIONS.includes(d));
            else if (typeof obj.dept === 'string' && DEPT_OPTIONS.includes(obj.dept)) dept = [obj.dept];
            else dept = [];
            const r = obj.reducible;
            return {
                percent: Math.max(0, Math.min(100, Number(obj.percent) || 0)),
                dept,
                lever: typeof obj.lever === 'string' ? obj.lever : '',
                reducible: (r === 'O' || r === 'X' || r === '세모') ? r : '',
                memo: typeof obj.memo === 'string' ? obj.memo : '',
                saving: typeof obj.saving === 'string' ? obj.saving
                    : (typeof obj.saving === 'number' && obj.saving ? window.GS.comma(obj.saving) : ''),
                saving_month: typeof obj.saving_month === 'string' ? obj.saving_month : '',
            };
        },

        splitArr(id) {
            return this.edits.splits[id] || [];
        },

        // 현재 행의 분기 비율 총합 (%)
        splitPercentSum(id) {
            return (this.edits.splits[id] || []).reduce((s, x) => s + (Number(x.percent) || 0), 0);
        },

        // 원행의 비율 — 100% 에서 분기된 행들의 합을 뺀 잔여분 (원행 + 분기 합 = 100%)
        parentBranchPercent(id) {
            return Math.max(0, 100 - this.splitPercentSum(id));
        },

        // 새 분기 행 추가 — 부모 행의 값을 복사하여 채움, 기본 10% 로 추가 후 사용자가 조정
        addSplit(id) {
            const arr = (this.edits.splits[id] || []).slice();
            const used = arr.reduce((s, x) => s + (Number(x.percent) || 0), 0);
            const remain = Math.max(0, 100 - used);
            if (remain <= 0) {
                this.updateMsg = '비율 합이 100%에 도달했습니다';
                clearTimeout(this._toastTimer);
                this._toastTimer = setTimeout(() => { this.updateMsg = ''; }, 1800);
                return;
            }
            // 기본 10% 로 추가 (잔여가 적으면 잔여만큼) — 여러 번 클릭해 여러 분기 행 생성 가능
            const newPct = Math.min(remain, 10);
            const parentSavingN = Number(String(this.edits.saving[id] || '').replace(/[^\d.-]/g, '')) || 0;
            const splitSavingN = Math.round(parentSavingN * newPct / 100);
            arr.push(this.normSplit({
                percent: newPct,
                dept: (this.edits.dept[id] || []).slice(),
                lever: this.edits.lever[id] || '',
                reducible: this.edits.reducible[id] || '',
                memo: this.edits.memo[id] || '',
                saving: splitSavingN ? window.GS.comma(splitSavingN) : '',
                saving_month: this.edits.saving_month[id] || '',
            }));
            this.edits.splits[id] = arr;
            this.saveEdit('splits');
        },

        // 분기 행 삭제 — 부모 행은 그대로 유지 (원본 데이터는 손대지 않음)
        removeSplit(id, idx) {
            const arr = (this.edits.splits[id] || []).slice();
            arr.splice(idx, 1);
            this.edits.splits[id] = arr;
            this.saveEdit('splits');
        },

        // 분기 비율 입력 — 0~100 클램프 + 다른 분기들과의 합이 100을 넘지 않도록 제한
        onSplitPercent(id, idx, ev) {
            const arr = (this.edits.splits[id] || []).slice();
            if (!arr[idx]) return;
            let v = Number(ev.target.value);
            if (!isFinite(v) || v < 0) v = 0;
            if (v > 100) v = 100;
            const otherSum = arr.reduce((s, x, i) => i === idx ? s : s + (Number(x.percent) || 0), 0);
            if (otherSum + v > 100) v = Math.max(0, 100 - otherSum);
            arr[idx] = { ...arr[idx], percent: v };
            this.edits.splits[id] = arr;
            ev.target.value = v;
            this.saveEdit('splits');
        },

        // 분기 행 - 절감금액 입력값을 천단위 콤마로 정리 후 저장
        formatSplitSaving(id, idx) {
            const arr = (this.edits.splits[id] || []).slice();
            if (!arr[idx]) return;
            const n = Number(String(arr[idx].saving || '').replace(/[^\d.-]/g, '')) || 0;
            arr[idx] = { ...arr[idx], saving: n ? window.GS.comma(n) : '' };
            this.edits.splits[id] = arr;
            this.saveEdit('splits');
        },

        // 분기 행 - 절감레버/메모 등 v-model 직접 변경 시 호출
        saveSplits() {
            this.saveEdit('splits');
        },

        // 분기 행에서 월 셀 값 (parent.months[idx] * percent / 100)
        splitMonth(parentRow, percent, mIdx) {
            const base = (parentRow.months || [])[mIdx] || 0;
            return Math.round(base * (Number(percent) || 0) / 100);
        },

        // 분기 행에서 합계 값 (parent.total * percent / 100)
        splitTotal(parentRow, percent) {
            return Math.round((parentRow.total || 0) * (Number(percent) || 0) / 100);
        },
    },
};
