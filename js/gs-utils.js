/* ============================================================
 * gs-utils.js — 맑은 비용절감 공통 유틸 (window.GS)
 * 빌드 없이 모든 logic 파일에서 window.GS 로 사용합니다.
 * ============================================================ */
(function (window) {
    'use strict';

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
    };

    window.GS = GS;
})(window);
