export default {
    layout: 'default',

    data() {
        return {
            loaded: false,
            items: [],

            // 비용절감 목표 (총비용 대비)
            goal: { m3: 0.05, m6: 0.10 },

            // 진행 막대 눈금 최대값
            scaleMax: 0.12,

            // ── B안 실행 과제 ──────────────────────────────────────────
            //   A안과의 핵심 차이:
            //   · 인프라는 3년 약정 → 단가 협상 X, "사용량/운영 방식" 변경으로 풀어냄
            //   · 외주는 "재협상" 대신 "단계적 내재화 + 매출연동 RS"
            //   · 광고는 "채널 축소" 대신 "ROAS·LP·자동입찰 튜닝"
            //   · SaaS는 "통합" 대신 "활용도 측정 후 좌석 풀 운영"
            initiatives: [
                // ── Phase 1 · 사용량·운영 즉시 최적화 (1~3개월) ───────────
                {
                    phase: 1, area: '외주비(인프라)', lever: '사용량 최적화', level: '중간', owner: '인프라팀',
                    title: 'AWS·NHN·ONS 비프로덕션 자동 스케줄링',
                    desc: '개발·스테이징·QA 환경을 야간(22~08시)·주말 자동 OFF, 평일 업무시간만 ON. 단가는 그대로 두고 가동시간을 60% 축소',
                    monthly: 3200000,
                },
                {
                    phase: 1, area: '외주비(CDN)', lever: '사용량 최적화', level: '중간', owner: '인프라팀',
                    title: 'CDN 캐시 정책·이미지 최적화로 Cache Hit Rate ↑',
                    desc: '카테노이드·씨디네트웍스·스피디·CJ ONS의 캐시 TTL·헤더 정책을 재설정하고 WebP/AVIF 변환·이미지 리사이즈로 Origin 트래픽 절감',
                    monthly: 2500000,
                },
                {
                    phase: 1, area: '광고선전비', lever: '효율 극대화', level: '낮음', owner: '마케팅팀',
                    title: '광고 LP·자동입찰·CVR 튜닝 (ROAS +20%)',
                    desc: '구글·네이버 광고를 채널·캠페인별로 자동입찰 전략 재설정하고 LP A/B 테스트로 전환율 개선. 예산 유지·매출 증대',
                    monthly: 2800000,
                },
                {
                    phase: 1, area: '지급수수료(SaaS)', lever: '자원 재활용', level: '낮음', owner: '경영지원팀',
                    title: 'SaaS·AI 좌석 풀(Pool) 운영 + 활용도 측정',
                    desc: 'Adobe·MIRICANVAS·Zendesk·사람인·Cursor·ChatGPT·Claude 등을 좌석 풀로 운영. 30일 미활용 계정 자동 회수, 사용량 기반 배정',
                    monthly: 2200000,
                },
                {
                    phase: 1, area: '공통', lever: '자원 재활용', level: '낮음', owner: '경영지원팀',
                    title: '사내 보유 자원·일회성 지출 사전점검',
                    desc: '연간 결제분(미리캔버스 2,844만 등) 활용도 점검·재배정, 일회성·소액 구매(도서·인쇄·주차·서류) 사전 승인제',
                    monthly: 1200000,
                },

                // ── Phase 2 · 구조: 사용량·내재화 재편 (2~6개월) ──────────
                {
                    phase: 2, area: '외주비(인프라)', lever: '사용량 최적화', level: '중간', owner: '인프라팀',
                    title: 'AWS 인스턴스 라이트사이징 + Savings Plan 약정',
                    desc: 'CloudWatch·Cost Explorer로 CPU/메모리 사용률 ≤30%인 인스턴스 다운사이징, 안정화 워크로드는 1년 약정으로 전환',
                    monthly: 3500000,
                },
                {
                    phase: 2, area: '외주비(영상)', lever: '사용량 최적화', level: '높음', owner: '인프라팀',
                    title: '동영상 사전 인코딩·해상도 정책 변경',
                    desc: '카테노이드 KLS 라이브 트랜스코딩 비중 축소. 인기 강좌는 사전 인코딩, 모바일 트래픽은 적응형 비트레이트로 자동 저화질 전환',
                    monthly: 3000000,
                },
                {
                    phase: 2, area: '외주비(운영)', lever: '내재화', level: '높음', owner: '사업본부',
                    title: '운영·유지보수 외주 단계적 인소싱',
                    desc: '동양생명 LMS 유지보수·필더필 오아라이브·플로즈 디자인 등 고정 외주 일부를 사내 인력으로 이관. AI 도구로 1인 생산성 보강',
                    monthly: 2500000,
                },
                {
                    phase: 2, area: '외주비(영업)', lever: '매출 연동(RS)', level: '높음', owner: '사업본부',
                    title: '콘텐츠·영업대행 매출연동(RS) 재설계',
                    desc: '에듀콘 콘텐츠 정산, 한스앤잔 영업대행 등을 고정형 → 매출 비례형(RS)으로 재설계해 매출 감소 시 비용도 자동 감소',
                    monthly: 1800000,
                },
                {
                    phase: 2, area: '외주비(IDC)', lever: '사용량 최적화', level: '중간', owner: '인프라팀',
                    title: 'IDC 호스팅 사양 다이어트 + 콜드 스토리지 이관',
                    desc: '애드포시스·비아웹 호스팅의 실측 사용률 기반 사양 축소(단가 X, 사양 ↓). 비활성 사용자 데이터·로그를 S3 Glacier 등 저비용 스토리지로 이관',
                    monthly: 2300000,
                },
            ],

            // B안 내부 3가지 안 비교 (절감률은 총비용 대비 추정)
            plans: [
                {
                    id: 'B-1안',
                    name: '사용량 최적화 집중형',
                    tag: 'FinOps',
                    summary: '인프라(클라우드·CDN·IDC) 사용량 최적화와 SaaS 활용도 점검만 즉시 실행하는 안',
                    m3: 0.051, m6: 0.055,
                    pros: ['계약 변경 없이 즉시 착수 가능', '인프라팀 단독 추진 가능', '운영 효율 가시화 → 지속 효과'],
                    cons: ['인프라 외 구조적 비용 손대지 못함', '6개월 10% 목표 미달', '외주비 고정 구조 그대로 유지'],
                    pass3: true, pass6: false, recommended: false,
                },
                {
                    id: 'B-2안',
                    name: '운영 내재화·매출연동 집중형',
                    tag: '구조 재편',
                    summary: '대형 외주 계약을 인소싱·매출연동(RS)으로 재편해 고정비를 변동비화하는 안',
                    m3: 0.020, m6: 0.108,
                    pros: ['고정비 → 변동비 전환으로 매출 감소 시 비용 자동 절감', '사내 역량 내재화', '6개월 10% 달성'],
                    cons: ['인력 충원·이관 기간 필요', '초기 3개월 효과 미미', '품질 저하 리스크'],
                    pass3: false, pass6: true, recommended: false,
                },
                {
                    id: 'B-3안',
                    name: '운영 효율 통합형 (FinOps + 인소싱)',
                    tag: '추천',
                    summary: 'Phase 1 사용량 최적화로 즉시 5% 확보, Phase 2 인소싱·RS 병행 착수로 누적 10% 달성',
                    m3: 0.051, m6: 0.107,
                    pros: ['3·6개월 목표 모두 달성', '단가 협상 없이 사용량·운영 변경만으로 풀어냄', '인프라 3년 약정 제약을 우회'],
                    cons: ['FinOps 모니터링·태깅 도구 도입 필요', '인소싱 인력·툴 투자 선행'],
                    pass3: true, pass6: true, recommended: true,
                },
            ],

            // 추천안(B-3안) 실행 로드맵
            roadmap: [
                {
                    month: '1개월', label: '착수',
                    items: [
                        'FinOps TF 구성 + 비용 태깅·대시보드 구축(Cost Explorer/CloudWatch)',
                        '비프로덕션 환경 자동 스케줄링 적용',
                        'SaaS·AI 좌석 풀 정책 수립 + 30일 미활용 회수',
                        'LP/광고 자동입찰 A/B 테스트 착수',
                    ],
                },
                {
                    month: '2~3개월', label: '5% 달성',
                    items: [
                        'CDN 캐시 정책·이미지 포맷 전환 완료 (Cache Hit Rate +15%p)',
                        '광고 ROAS 개선치 확정 → 예산 재배분',
                        '인소싱 대상 외주 식별 + 인력·툴 충원 계획',
                        '✅ 3개월 5% 절감 점검',
                    ],
                },
                {
                    month: '4~5개월', label: '구조 재편',
                    items: [
                        'AWS 라이트사이징·Savings Plan 전환 완료',
                        '동영상 사전 인코딩·적응형 비트레이트 적용',
                        '운영 외주 1차 인소싱 (LMS 유지보수 일부)',
                        'IDC 사양 다이어트 + 콜드 스토리지 이관',
                    ],
                },
                {
                    month: '6개월', label: '10% 달성',
                    items: [
                        '콘텐츠·영업대행 매출연동(RS) 계약 전환',
                        '인소싱 2차 (디자인·운영대행)',
                        'FinOps 정착·자동화 — 절감 효과 지속화',
                        '✅ 6개월 10% 절감 점검·정착',
                    ],
                },
            ],

            // A안 vs B안 핵심 차별점 비교
            abCompare: [
                { dim: '핵심 레버', a: '단가 협상·계약 재편', b: '사용량 최적화·운영 방식 변경' },
                { dim: '인프라(3년 약정)', a: 'CDN 벤더 통합·KLS 단가 재협상', b: '캐시·인코딩·스케줄링·라이트사이징 (사용량 ↓)' },
                { dim: '광고선전비', a: '비효율 채널 축소', b: 'ROAS·LP·자동입찰 튜닝 (예산 유지·효율 ↑)' },
                { dim: 'SaaS·AI 구독', a: '엔터프라이즈 단일 계약으로 통합', b: '좌석 풀 운영 + 활용도 측정 기반 회수' },
                { dim: '외주비', a: '성과형 계약으로 재편', b: '단계적 인소싱 + 매출연동(RS) 전환' },
                { dim: '주요 리스크', a: '협상 결렬·리드타임', b: '인소싱 인력 확보·품질 관리' },
                { dim: '적합 조건', a: '벤더 협상 카드·재계약 시점 보유', b: '사용량 가시성 확보 + 사내 운영 역량 강화 의지' },
            ],
        };
    },

    async mounted() {
        try {
            this.items = await fetch('/data/cost-items.json').then((r) => r.json());
        } catch (e) {
            console.error('B안 데이터 로딩 실패:', e);
        }
        this.loaded = true;
    },

    computed: {
        totalCost() { return window.GS.sum(this.items.map((i) => i.total)); },
        monthlyBase() { return this.totalCost / 5; },

        target3() { return this.monthlyBase * this.goal.m3; },
        target6() { return this.monthlyBase * this.goal.m6; },

        phase1() { return this.initiatives.filter((i) => i.phase === 1); },
        phase2() { return this.initiatives.filter((i) => i.phase === 2); },

        phase1Saving() { return window.GS.sum(this.phase1.map((i) => i.monthly)); },
        phase2Saving() { return window.GS.sum(this.phase2.map((i) => i.monthly)); },
        totalSaving() { return this.phase1Saving + this.phase2Saving; },

        phase1Rate() { return this.phase1Saving / this.monthlyBase; },
        totalRate() { return this.totalSaving / this.monthlyBase; },

        // 절감 레버별 합계 (B안만의 차별 분류)
        byLever() {
            return window.GS.groupSum(this.initiatives, (i) => i.lever, (i) => i.monthly);
        },
    },

    methods: {
        comma(n) { return window.GS.comma(n); },
        short(n) { return window.GS.short(n); },
        rate(v) { return (v * 100).toFixed(1) + '%'; },

        scalePos(v) {
            return Math.min(100, (v / this.scaleMax) * 100) + '%';
        },

        leverWidth(value) {
            const max = Math.max(1, ...this.byLever.map((r) => r.total));
            return Math.max(3, (value / max) * 100) + '%';
        },

        levelClass(level) {
            if (level === '낮음') return 'bg-success-subtle text-success-emphasis';
            if (level === '높음') return 'bg-danger-subtle text-danger-emphasis';
            return 'bg-warning-subtle text-warning-emphasis';
        },

        leverBadgeClass(lever) {
            if (lever === '사용량 최적화') return 'bg-primary-subtle text-primary-emphasis';
            if (lever === '내재화') return 'bg-danger-subtle text-danger-emphasis';
            if (lever === '매출 연동(RS)') return 'bg-warning-subtle text-warning-emphasis';
            if (lever === '효율 극대화') return 'bg-success-subtle text-success-emphasis';
            return 'bg-secondary-subtle text-secondary-emphasis';
        },

        goExpenses() {
            if (typeof this.navigateTo === 'function') this.navigateTo('expenses');
            else window.location.hash = '#/expenses';
        },
        goStrategyA() {
            if (typeof this.navigateTo === 'function') this.navigateTo('strategy');
            else window.location.hash = '#/strategy';
        },
    },
};
