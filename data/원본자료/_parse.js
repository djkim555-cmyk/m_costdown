// CSV -> JSON 변환 스크립트 (1회성). 결과: data/cost-items.json, data/pnl.json
const fs = require('fs');
const path = require('path');

const dir = __dirname;            // data/원본자료
const dataDir = path.join(dir, '..');

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const num = (s) => {
  if (s == null) return 0;
  const v = String(s).replace(/[",\s]/g, '');
  if (v === '' || v === '-') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

// ---- 비용절감 항목 ----
const costRaw = fs.readFileSync(path.join(dir, '전사 비용절감 전략 프로젝트(CSV).csv'), 'utf8');
const costRows = parseCSV(costRaw);
const items = [];
for (const r of costRows) {
  const item = (r[1] || '').trim();
  if (!item || item === '항목') continue;          // 헤더/빈줄 skip
  const months = [];
  for (let m = 11; m <= 22; m++) months.push(num(r[m]));   // 1~12월 (11..22)
  const total = months.reduce((a, b) => a + b, 0);
  if (total === 0) continue;                                // 금액 없는 행 skip
  items.push({
    item,                                  // 항목 (지급수수료/광고선전비/외주비)
    nature: (r[2] || '').trim(),            // 비용성격
    category: (r[3] || '').trim(),          // 분류
    detail: (r[4] || '').trim(),            // 내용
    vendor: (r[5] || '').trim(),            // 거래처
    dept: (r[6] || '').trim(),              // 부서
    reducible: (r[7] || '').trim(),         // 절감가능여부
    date: (r[10] || '').trim(),             // 날짜
    months,                                 // [1월..5월]
    total
  });
}
fs.writeFileSync(path.join(dataDir, 'cost-items.json'), JSON.stringify(items, null, 2), 'utf8');
console.log('cost-items.json:', items.length, '건');

// ---- 손익계산서 ----
const pnlRaw = fs.readFileSync(path.join(dir, '맑은소프트 월별 손익계산서_예상.csv'), 'utf8');
const pnlRows = parseCSV(pnlRaw);
const pnl = { months: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], rows: {} };
const want = {
  '1. 매출액': 'revenue',
  '2. 판매비와 관리비': 'sga',
  'Ⅴ. 영업이익(손실)': 'operatingProfit',
  '영업이익률(%)': 'operatingMargin',
  'Ⅷ. 법인세차감전손익': 'preTaxProfit'
};
const sgaItems = [];
let inSga = false;
for (const r of pnlRows) {
  const label = (r[0] || '').trim();
  if (!label) continue;
  const vals = [];
  for (let m = 1; m <= 12; m++) vals.push(num(r[m]));
  if (want[label]) pnl.rows[want[label]] = label === '영업이익률(%)'
    ? r.slice(1, 13).map(s => (s || '').trim())
    : vals;
  if (label === '2. 판매비와 관리비') { inSga = true; continue; }
  if (label.startsWith('Ⅴ.')) inSga = false;
  if (inSga && label) {
    sgaItems.push({ name: label, months: vals, total: vals.reduce((a, b) => a + b, 0) });
  }
}
pnl.sgaItems = sgaItems;
fs.writeFileSync(path.join(dataDir, 'pnl.json'), JSON.stringify(pnl, null, 2), 'utf8');
console.log('pnl.json: SGA', sgaItems.length, '항목');
