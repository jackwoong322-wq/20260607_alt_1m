# Project Agent Guide

This file is the **primary source of truth** for all coding agents in this repository.
Tool-specific files (`.cursorrules`, `CLAUDE.md`, etc.) should stay thin and defer to this file.

---

## Tech Stack

- **Frontend**: React 18, Vite 5
  - `03_frontend/`: TypeScript + TSX
  - `04_frontend_0222fb/`: JavaScript + JSX
- **Backend**: Python 3.13, FastAPI, Uvicorn
- **Database/Auth**: Supabase Postgres, Supabase Auth, Edge Functions with Deno
- **Infra**: Vercel (frontend), Render (backend), GitHub Actions (automation)

---

## Project Structure

- `03_frontend/`: React 18 + Vite 5 (TypeScript) — Vercel 배포
- `04_frontend_0222fb/`: React 18 + Vite 5 (JavaScript) — Vercel 배포
- `02_backend/`: FastAPI + Uvicorn — Render 배포 (`https://two0260317-alt.onrender.com`)
- `01_pairUSDT/`: Python scripts — Binance OHLCV 수집, 사이클 분석, 예측
- `supabase/functions/`: Supabase Edge Functions (Deno)
- `reports/`: 작업 보고서
- `temp/`: 임시 작업 파일 (이슈번호별 폴더)

---

## Frontend Rules

Applies to `03_frontend/` and `04_frontend_0222fb/`.

- Use functional components and hooks only.
- Use `fetch` for API calls.
- Read the backend base URL from `VITE_API_URL` environment variable.
- Use `lightweight-charts` for chart rendering.
- Use ESM imports only. Do not use CommonJS `require()`.
- Frontend environment variables must use the `VITE_` prefix.
- Legacy analyzer assets live under `public/legacy/` and should be treated as production assets.
- `03_frontend/` specific: keep aligned with legacy analyzer UI (`01_pairUSDT/033_visualizer_html.py`).

---

## Backend Rules

Applies to `02_backend/`.

- Use FastAPI with type hints on all endpoints.
- Use Pydantic models for all request and response schemas.
- Use the Supabase Python client for database operations. Do not write raw SQL unless explicitly asked.
- Load environment variables with `python-dotenv`.
- Keep CORS aligned with the deployed Vercel frontend origin.
- Organize routers by domain (e.g. `routers/ohlcv.py`).
- Return structured JSON responses consistently.

---

## Supabase Rules

- Use Supabase client libraries instead of direct PostgreSQL connections.
- Enable RLS on every table.
- Use Supabase Auth for authentication.
- In Edge Functions, use the Deno runtime and import from `supabase-js`.

---

## OHLCV Script Rules

Applies to `01_pairUSDT/`.

- Use pandas for data processing.
- Fetch market data through the Binance REST API.
- Store and process timestamps in UTC only.
- Keep scripts runnable both standalone and through GitHub Actions.

---

## GitHub Actions Rules

- Workflows live in `.github/workflows/`.
- `pipeline-analyze.yml`: 012, 021, 031 실행 (매일 00:00 UTC)
- `pipeline-predict.yml`: 032 실행 (매일 01:00 UTC — analyze 1시간 후)
- Never hardcode secrets. Use repository or environment secrets.

---

## Source Modification & QA Routine (필수 수정 루틴)

소스 코드 수정 시 반드시 다음 루틴을 순차적으로 수행한다:
1. **유닛 테스트 작성/보강**: 변경 사항 및 에지 케이스를 검증하는 단위 테스트를 반드시 추가/체크
2. **테스트 실행 및 검증**: 관련 단위 테스트 및 빌드를 실행하여 100% 통과 확인
3. **자체 코드 리뷰**: 예외 처리, 보안(Cross-origin 등), 쿼리 페이징(1,000건 제한 방지), 에지 케이스 자체 리뷰 및 선제 수정
4. **사용자 판단 필요 시 질문**: 정책적 결정이나 사용자 확인이 필요한 사항은 임의 판단하지 않고 즉시 질문
5. **하네스 문서 동기화**: 수정 내용과 규칙을 하네스(`AGENTS.md`, `workflow_rules.md`)에 상시 기록

---

## General Coding Rules

- Never hardcode API keys, URLs, or secrets.
- Prefer descriptive variable names: `is_loading`, `has_error`, `is_active`.
- Keep functions focused and small.
- Handle errors explicitly with `try/catch` or `try/except`.
- Add comments only for non-obvious logic.
- 단위 테스트(QA) 환경이 없다면 작업을 시작하기 전에 반드시 사용자에게 테스트 환경 구축 여부를 먼저 묻고 대기할 것. 명시적으로 "테스트 생략"이라는 지시가 없는 한 임의로 테스트 단계를 건너뛰는 것을 엄격히 금지함.
- GitHub 커밋 및 푸시(`git commit`, `git push`)는 반드시 사전에 사용자에게 명시적 허락을 구한 뒤 진행할 것.

---

## Error Handling Rules

- Identify the root cause before fixing.
- After a fix, verify both the failure path and the happy path.
- If the same error repeats more than twice, stop patching symptoms and address the root cause.
- For import errors: check module paths before changing code broadly.
- For FastAPI `422` errors: inspect the Pydantic schema and request shape first.
- For CORS issues: verify backend config before changing frontend calls.

---

## Python Test Rules

Applies to `01_pairUSDT/` and `02_backend/`.

- Framework: `unittest` + `unittest.mock` (pytest는 보조 실행기로만 사용)
- 실행: `python -m pytest <파일>` 또는 `python -m unittest <파일>`
- 외부 API(`requests`, Supabase 클라이언트) 직접 호출 금지 → mock 처리 필수
- `01_pairUSDT/` 스크립트: `requests.get/post/delete` mock (`unittest.mock.patch`)
- `02_backend/` 스크립트: Supabase 클라이언트 mock (`FakeSupabase` 패턴)
- Mock 선언 위치: 파일 상단 또는 `setUp` (테스트 케이스 내부 선언 금지)
- `setUp`/`tearDown`에서 patch 시작/종료 관리
- 커버리지 80% 이상 달성 필수

---

## Working Agreement

- AGENTS.md is the single source of truth. Keep tool-specific files lightweight.
- Claude Code workflow rules are in `CLAUDE.md`.
- Test rules are in `test_rules.md`.
- Design rules & specs are in `design_rules.md` and `DESIGN.md`.
- Workflow rules are in `workflow_rules.md`.

---

## Response Format Rules

- 답변 첫 줄에 반드시 `[규정 검토 완료: O]` 형태의 확인 문구를 명시할 것. (작업 전 AGENTS.md 및 workflow_rules.md 필수 확인)
- 답변은 항상 300자 이하로 간결하게 작성할 것.
- 핵심 내용 및 메인 설명은 표, 그래프, 그림 등 시각적 요소를 적극 활용하여 전달할 것.
