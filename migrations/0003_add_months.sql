-- 월별 실제 비용 입력값 컬럼 추가 (JSON: { "월index(4~11)": "콤마문자열" })
-- 비용 상세 목록의 5~12월 input box 에 입력된 실제 비용을 저장
-- 주의: 이미 적용된 경우 "duplicate column" 에러가 나므로 1회만 실행
ALTER TABLE expense_edits ADD COLUMN months TEXT;
