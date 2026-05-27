-- 절감시기 컬럼 추가 (YYYY-MM 형식, 비용 절감 시작 년월)
-- 주의: 이미 적용된 경우 "duplicate column" 에러가 나므로 1회만 실행
ALTER TABLE expense_edits ADD COLUMN saving_month TEXT;
