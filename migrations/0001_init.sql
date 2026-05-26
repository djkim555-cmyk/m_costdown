-- 비용 편집값 저장 테이블 (한 행 = 한 비용 항목)
CREATE TABLE IF NOT EXISTS expense_edits (
    row_id     INTEGER PRIMARY KEY,
    category   TEXT,
    lever      TEXT,
    dept       TEXT,        -- JSON 배열: 담당부서 복수 선택
    reducible  TEXT,        -- 'O' | 'X' | '세모' | ''
    memo       TEXT,
    saving     TEXT,
    splits     TEXT,        -- JSON 배열: 비용분기 [{ percent, dept, lever, reducible, memo, saving }]
    updated_at INTEGER
);
