export default {
    layout: 'default',

    data() {
        return {
            loaded: false,
            items: [],

            // 비용절감 목표 (총비용 대비)
            goal: { m3: 0.05, m6: 0.10 },

            // 진행 막대 눈금 최대값 (목표 10%보다 여유 있게)
            scaleMax: 0.12,

            // 절감 실행 과제 — 비용통합 시트(지급수수료·광고선전비·외주비) 분석 기반
            // monthly: 월 예상 절감액(원)
            initiatives: [
                // ── Phase 1 · 단기 즉시 절감 (실행 1~3개월) ─────────────
                {
                    phase: 1, area: '지급수수료', level: '낮음', owner: '경영지원팀',
                    title: 'AI·SaaS 구독 통합',
                    desc: '개인 카드로 분산 결제 중인 Claude·ChatGPT·Cursor·Genspark 등 AI 구독 10여 건을 엔터프라이즈 단일 계약으로 통합하고 중복분 해지',
                    monthly: 1800000,
                },
                {
                    phase: 1, area: '지급수수료', level: '낮음', owner: '경영지원팀',
                    title: '유휴 라이선스·계정 회수',
                    desc: 'Jira(영업·임원 계정), Google Workspace 등 비활성 계정을 회수해 좌석 수 기준 요금 절감',
                    monthly: 1200000,
                },
                {
                    phase: 1, area: '공통', level: '낮음', owner: '경영지원팀',
                    title: '소액·일회성 지출 사전승인제',
                    desc: '서류발급·주차·출력 등 소액 일회성 지출에 사전승인 한도를 적용해 비계획 지출 억제',
                    monthly: 1500000,
                },
                {
                    phase: 1, area: '외주비', level: '중간', owner: '인프라팀',
                    title: '클라우드 유휴 리소스 즉시 정리',
                    desc: 'AWS·NHN·Naver Cloud의 미사용 인스턴스·미연결 볼륨·과대 사양 리소스를 점검해 즉시 축소',
                    monthly: 3500000,
                },
                {
                    phase: 1, area: '광고선전비', level: '낮음', owner: '마케팅팀',
                    title: '비효율 광고 채널 즉시 축소',
                    desc: '구글·네이버 광고를 캠페인별 ROAS로 평가해 효율 낮은 캠페인·블로그 운영대행·언론보도 비용을 축소',
                    monthly: 4200000,
                },

                // ── Phase 2 · 구조 재편 (실행 2~6개월) ──────────────────
                {
                    phase: 2, area: '외주비', level: '중간', owner: '인프라팀',
                    title: 'CDN 벤더 통합·단가 재협상',
                    desc: '씨디네트웍스·다날·스피디·CJ ONS 등 4개 CDN 벤더를 1~2개로 통합하고 트래픽 단가 재협상',
                    monthly: 2600000,
                },
                {
                    phase: 2, area: '외주비', level: '중간', owner: '인프라팀',
                    title: 'AWS Savings Plan 약정 전환',
                    desc: '온디맨드로 쓰던 AWS(시냅스엠 외) 워크로드를 1년 약정 Savings Plan·예약 인스턴스로 전환',
                    monthly: 4000000,
                },
                {
                    phase: 2, area: '외주비', level: '높음', owner: '인프라팀',
                    title: '카테노이드 KLS 리셀링 재협상',
                    desc: '외주비 단일 최대 항목(월 약 3,700만)인 동영상 리셀링 계약의 단가·마진 구조를 재협상',
                    monthly: 2800000,
                },
                {
                    phase: 2, area: '외주비', level: '중간', owner: '인프라팀',
                    title: 'IDC 호스팅 계약 재협상·통합',
                    desc: '씨디네트웍스 Rack·애드포시스·비아웹 등으로 분산된 IDC 호스팅 계약을 재협상하고 사양을 적정화',
                    monthly: 2500000,
                },
                {
                    phase: 2, area: '외주비', level: '높음', owner: '사업본부',
                    title: '외주 개발·운영 계약 성과형 재편',
                    desc: '고정형 개발·운영대행 외주 계약을 산출물·성과 연동형으로 재편하고 영업대행 수수료율을 조정',
                    monthly: 1500000,
                },
            ],

            // 3가지 절감안 비교 (절감률은 총비용 대비 추정)
            plans: [
                {
                    id: '1안',
                    name: '즉시 절감 집중형',
                    tag: 'Quick Win',
                    summary: '계약 변경 없이 당장 실행 가능한 단기 과제(Phase 1)에만 집중하는 안',
                    m3: 0.052, m6: 0.056,
                    pros: ['1개월 내 착수 가능', '계약 해지·협상 리스크 없음', '현업 저항이 적음'],
                    cons: ['인프라 등 구조적 고정비를 손대지 못함', '6개월 10% 목표 미달', '절감 효과가 초기에 정체'],
                    pass3: true, pass6: false, recommended: false,
                },
                {
                    id: '2안',
                    name: '구조 재협상 집중형',
                    tag: '고정비 구조개선',
                    summary: '대형 인프라·외주 계약 재협상(Phase 2) 중심으로 고정비 구조 자체를 바꾸는 안',
                    m3: 0.021, m6: 0.110,
                    pros: ['절감 잠재력이 가장 큼', '고정비 구조를 근본 개선', '재발 없는 지속적 절감'],
                    cons: ['계약 만기·협상 리드타임으로 초기 효과 지연', '3개월 5% 목표 미달', '협상 결렬 리스크 존재'],
                    pass3: false, pass6: true, recommended: false,
                },
                {
                    id: '3안',
                    name: '단계적 통합형 (하이브리드)',
                    tag: '추천',
                    summary: 'Phase 1을 즉시 실행해 조기 성과를 내고, Phase 2 재협상을 병행 착수하는 안',
                    m3: 0.052, m6: 0.108,
                    pros: ['3개월·6개월 목표를 모두 달성', '초기 성과로 조직 추진력 확보', '단기·구조 과제 동시 진행으로 리스크 분산'],
                    cons: ['동시 실행으로 초기 관리 부담', '전담 TF·진척 관리 체계 필요'],
                    pass3: true, pass6: true, recommended: true,
                },
            ],

            // 추천안(3안) 실행 로드맵
            roadmap: [
                { month: '1개월', label: '착수', items: ['절감 TF 구성·KPI 확정', 'AI·SaaS 구독 전수조사', '유휴 라이선스 회수', '소액 지출 사전승인제 시행'] },
                { month: '2~3개월', label: '5% 달성', items: ['클라우드 유휴 리소스 정리 완료', '광고 채널 ROAS 재배분', 'CDN·AWS 재협상 착수', '✅ 3개월 5% 절감 점검'] },
                { month: '4~5개월', label: '구조 재편', items: ['CDN 벤더 통합 완료', 'AWS Savings Plan 전환', 'IDC 호스팅 계약 재협상'] },
                { month: '6개월', label: '10% 달성', items: ['카테노이드 리셀링 재협상 타결', '외주 계약 성과형 재편', '✅ 6개월 10% 절감 점검·정착'] },
            ],
        };
    },

    async mounted() {
        try {
            this.items = await fetch('/data/cost-items.json').then((r) => r.json());
        } catch (e) {
            console.error('절감 전략 데이터 로딩 실패:', e);
        }
        this.loaded = true;
    },

    computed: {
        // 분석 대상 총비용 (1~5월 누적)
        totalCost() {
            return window.GS.sum(this.items.map((i) => i.total));
        },

        // 월평균 총비용 (5개월 기준) — 절감률 산정 기준
        monthlyBase() {
            return this.totalCost / 5;
        },

        // 목표 절감액 (월 기준)
        target3() { return this.monthlyBase * this.goal.m3; },
        target6() { return this.monthlyBase * this.goal.m6; },

        phase1() { return this.initiatives.filter((i) => i.phase === 1); },
        phase2() { return this.initiatives.filter((i) => i.phase === 2); },

        // 단계별 월 절감액 합계
        phase1Saving() { return window.GS.sum(this.phase1.map((i) => i.monthly)); },
        phase2Saving() { return window.GS.sum(this.phase2.map((i) => i.monthly)); },
        totalSaving() { return this.phase1Saving + this.phase2Saving; },

        // 절감률
        phase1Rate() { return this.phase1Saving / this.monthlyBase; },
        totalRate() { return this.totalSaving / this.monthlyBase; },

        // 효과 영역별 절감액 (지급수수료 / 광고선전비 / 외주비 / 공통)
        byArea() {
            return window.GS.groupSum(this.initiatives, (i) => i.area, (i) => i.monthly);
        },
    },

    methods: {
        comma(n) { return window.GS.comma(n); },
        short(n) { return window.GS.short(n); },

        // 비율 → 백분율 문자열
        rate(v) { return (v * 100).toFixed(1) + '%'; },

        // 진행 막대 위치 — 절감률을 눈금(scaleMax) 기준 너비로 환산
        scalePos(v) {
            return Math.min(100, (v / this.scaleMax) * 100) + '%';
        },

        // 가로 막대 너비 (영역별 차트)
        areaWidth(value) {
            const max = Math.max(1, ...this.byArea.map((r) => r.total));
            return Math.max(3, (value / max) * 100) + '%';
        },

        // 난이도 배지 색상
        levelClass(level) {
            if (level === '낮음') return 'bg-success-subtle text-success-emphasis';
            if (level === '높음') return 'bg-danger-subtle text-danger-emphasis';
            return 'bg-warning-subtle text-warning-emphasis';
        },

        goExpenses() {
            if (typeof this.navigateTo === 'function') this.navigateTo('expenses');
            else window.location.hash = '#/expenses';
        },
    },
};
