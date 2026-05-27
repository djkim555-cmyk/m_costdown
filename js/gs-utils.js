/* ============================================================
 * gs-utils.js — 맑은 비용절감 공통 유틸 (window.GS)
 * 빌드 없이 모든 logic 파일에서 window.GS 로 사용합니다.
 * ============================================================ */
(function (window) {
    'use strict';

    // ── API 베이스 ───────────────────────────────────────────────
    //   · Cloudflare Pages 배포 / wrangler pages dev / node server.js
    //     → 정적 + Functions(또는 Express) 가 동일 출처에서 함께 서빙되므로 빈 문자열
    //   · Live Server(5500/5501)·python http.server(8000) 등 정적 전용 dev 서버
    //     → 별도로 띄운 localhost:3001 (node server.js) 의 API 로 호출
    const STATIC_ONLY_PORTS = new Set(['5500', '5501', '8000']);
    const API_BASE = STATIC_ONLY_PORTS.has(location.port) ? 'http://localhost:3001' : '';

    // 비용 편집값 필드 목록 (서버 스키마와 1:1)
    const EDIT_FIELDS = ['category', 'lever', 'dept', 'reducible', 'memo', 'saving', 'splits'];

    // 구버전 localStorage 키 (마이그레이션 + 오프라인 폴백용)
    const LEGACY_KEYS = {
        category: 'gs-expense-cats',
        lever: 'gs-expense-lever',
        dept: 'gs-expense-depts',
        reducible: 'gs-expense-reducible',
        memo: 'gs-expense-memos',
        saving: 'gs-expense-saving',
        splits: 'gs-expense-splits',
    };

    function emptyEdits() {
        const o = {};
        for (const f of EDIT_FIELDS) o[f] = {};
        return o;
    }

    function loadFromLocalStorage() {
        const out = emptyEdits();
        for (const f of EDIT_FIELDS) {
            try {
                out[f] = JSON.parse(localStorage.getItem(LEGACY_KEYS[f]) || '{}') || {};
            } catch (e) {
                out[f] = {};
            }
        }
        return out;
    }

    function hasAnyData(edits) {
        if (!edits) return false;
        for (const f of EDIT_FIELDS) {
            if (edits[f] && Object.keys(edits[f]).length > 0) return true;
        }
        return false;
    }

    async function fetchEditsFromServer() {
        const res = await fetch(API_BASE + '/api/edits');
        if (!res.ok) throw new Error('GET /api/edits ' + res.status);
        return await res.json();
    }

    async function postEditsToServer(edits) {
        const res = await fetch(API_BASE + '/api/edits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edits),
        });
        if (!res.ok) throw new Error('POST /api/edits ' + res.status);
        return await res.json();
    }

    const GS = {
        /** 숫자에 천단위 콤마 (예: 1234567 -> "1,234,567") */
        comma(n) {
            const v = Number(n) || 0;
            return v.toLocaleString('ko-KR');
        },

        /** 원화 표기 (예: 1234567 -> "1,234,567원") */
        won(n) {
            return GS.comma(n) + '원';
        },

        /** 금액을 만/억 단위로 축약 (예: 123456789 -> "1.2억") */
        short(n) {
            const v = Number(n) || 0;
            const abs = Math.abs(v);
            const sign = v < 0 ? '-' : '';
            if (abs >= 1e8) return sign + (abs / 1e8).toFixed(1) + '억';
            if (abs >= 1e4) return sign + Math.round(abs / 1e4).toLocaleString('ko-KR') + '만';
            return sign + GS.comma(abs);
        },

        /** 백분율 표기 (분자/분모 -> "12.3%") */
        percent(part, total, digits) {
            const t = Number(total) || 0;
            if (t === 0) return '0%';
            return ((Number(part) || 0) / t * 100).toFixed(digits == null ? 1 : digits) + '%';
        },

        /** 배열 합계 */
        sum(arr) {
            return (arr || []).reduce((a, b) => a + (Number(b) || 0), 0);
        },

        /** key 기준으로 항목 합계를 그룹핑 -> [{ key, total }] 내림차순 */
        groupSum(list, keyFn, valFn) {
            const map = new Map();
            for (const row of list || []) {
                const k = keyFn(row) || '(미분류)';
                map.set(k, (map.get(k) || 0) + (Number(valFn(row)) || 0));
            }
            return [...map.entries()]
                .map(([key, total]) => ({ key, total }))
                .sort((a, b) => b.total - a.total);
        },

        /** API 베이스 URL (다른 logic 파일에서 직접 호출용) */
        API_BASE,

        /** 편집 가능한 필드 목록 */
        EDIT_FIELDS,

        /** 서버에서 비용 편집값을 받아오고 메모리에 캐시.
         *  최초 1회: 서버가 비어있고 localStorage 에 데이터가 있으면 자동 마이그레이션 */
        async ensureExpenseEdits(force) {
            if (!force && GS._editsLoaded) return GS._editsCache;
            if (!force && GS._editsLoading) return GS._editsLoading;

            GS._editsLoading = (async () => {
                let serverEdits;
                try {
                    serverEdits = await fetchEditsFromServer();
                } catch (e) {
                    console.warn('서버 연결 실패 — localStorage 폴백:', e);
                    GS._editsCache = loadFromLocalStorage();
                    GS._editsLoaded = true;
                    GS._editsOffline = true;
                    return GS._editsCache;
                }

                // 서버가 비어있고 localStorage 에 기존 데이터가 있으면 일회성 마이그레이션
                if (!hasAnyData(serverEdits)) {
                    const local = loadFromLocalStorage();
                    if (hasAnyData(local)) {
                        try {
                            await postEditsToServer(local);
                            serverEdits = local;
                            console.log('[gs-utils] localStorage → 서버 마이그레이션 완료');
                        } catch (e) {
                            console.error('마이그레이션 실패:', e);
                        }
                    }
                }

                GS._editsCache = serverEdits;
                GS._editsLoaded = true;
                GS._editsOffline = false;
                return GS._editsCache;
            })();

            try { return await GS._editsLoading; }
            finally { GS._editsLoading = null; }
        },

        /** 현재 캐시된 편집값 (없으면 빈 객체).
         *  비동기 로드 전에 호출하면 빈 값을 반환하므로 mount 시 ensureExpenseEdits() 선행 필요 */
        getExpenseEdits() {
            return GS._editsCache || emptyEdits();
        },

        /** 편집값 전체를 서버에 저장 + 메모리 캐시 갱신.
         *  서버 실패 시 localStorage 폴백으로 저장 (오프라인 모드) */
        async saveExpenseEdits(edits) {
            GS._editsCache = edits;
            try {
                await postEditsToServer(edits);
                GS._editsOffline = false;
            } catch (e) {
                console.error('서버 저장 실패, localStorage 폴백:', e);
                GS._editsOffline = true;
                for (const f of EDIT_FIELDS) {
                    try { localStorage.setItem(LEGACY_KEYS[f], JSON.stringify(edits[f] || {})); }
                    catch (_) { /* ignore */ }
                }
                throw e;
            }
        },

        /** 현재 캐시된 편집값을 items 배열에 병합 (대시보드·월비용 순위 등에서 사용)
         *  주의: 호출 전 ensureExpenseEdits() 가 완료되어야 정확한 값이 반영됨 */
        applyExpenseEdits(items) {
            const e = GS.getExpenseEdits();
            (items || []).forEach((it, idx) => {
                if (it._id == null) it._id = idx;
                const id = it._id;
                const cat = (e.category[id] || '').toString().trim();
                if (cat) it.category = cat;
                const dept = e.dept[id];
                it.deptList = Array.isArray(dept) ? dept.slice() : [];
                it.lever = (e.lever[id] || '').toString();
                const r = (e.reducible[id] || '').toString();
                if (r) it.reducible = r;
                it.memo = (e.memo[id] || '').toString();
                const savRaw = (e.saving[id] || '').toString();
                it.saving = Number(savRaw.replace(/[^\d.-]/g, '')) || 0;
                it.splits = Array.isArray(e.splits[id]) ? e.splits[id] : [];
            });
            return items;
        },
    };

    window.GS = GS;
})(window);
