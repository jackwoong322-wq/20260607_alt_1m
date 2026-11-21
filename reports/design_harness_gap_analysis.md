# 현재 화면 분석 및 디자인 하네스 간극(Gap) 분석 보고서

## 1. 분석 개요
- **분석 대상**:
  1. React 진입 쉘: [`03_frontend/src/LegacyAnalyzerApp.tsx`](file:///d:/MW/souce/20260607_alt_1m/03_frontend/src/LegacyAnalyzerApp.tsx)
  2. 실제 렌더링 스타일: [`03_frontend/public/legacy/chart-v2.css`](file:///d:/MW/souce/20260607_alt_1m/03_frontend/public/legacy/chart-v2.css)
  3. 레거시 템플릿: [`01_pairUSDT/templates/chart.css`](file:///d:/MW/souce/20260607_alt_1m/01_pairUSDT/templates/chart.css)
- **비교 기준**: 하네스 명세서 ([`DESIGN.md`](file:///d:/MW/souce/20260607_alt_1m/DESIGN.md), [`design_rules.md`](file:///d:/MW/souce/20260607_alt_1m/design_rules.md))

---

## 2. 하네스와 불일치하는 주요 항목 비교

| 분석 영역 | 하네스 기준 (`DESIGN.md`) | 현재 화면 구현 상태 | 간극 및 영향도 |
|---|---|---|---|
| **토큰 네이밍** | `--bg-main`, `--bg-surface`, `--color-bull`, `--color-bear` | `--bg`, `--panel`, `--green`, `--red` | **높음**: 토큰 명칭 불일치로 신규 UI 개발 시 스타일 파편화 |
| **배경/패널 색상** | `#0b0e14`, `#151922` (Slate/Zinc) | `#070c14`, `#0d1420` (Navy/Blue Tint) | **중간**: 미세한 틴트 차이 (하네스가 좀 더 짙은 슬레이트 톤) |
| **상승/하락 색상** | 상승 `#0ecb81`, 하락 `#f6465d` | 상승 `#1bf0a2`, 하락 `#ff5f86` | **중간**: 네온/형광 톤이 강해 장시간 분석 시 눈 피로도 유발 가능 |
| **타이포그래피** | 시스템 폰트 + Monospace | 구글 웹폰트 4종 로드 (`Oxanium`, `Syne` 등) | **높음**: 외부 CDN 의존으로 인한 초기 렌더링 지연(FOUC) 가능성 |
| **폰트 크기 (Scale)** | 본문 13~14px, 헤더 16~18px | 본문 18px, 헤더 2.1rem (~38px) | **심각**: 핀테크 차트 기준 과대 폰트로 정보 밀도 저하 및 시각 피로 |
| **곡률 (Radius)** | 패널 `8px`, 버튼 `6px`, 뱃지 `4px` | 패널 `16px`, 카드 `10~16px` | **낮음**: 하네스보다 둥근 라운딩 사용 |
| **인라인 하드코딩** | 토큰화된 변수 사용 강제 | `LegacyAnalyzerApp.tsx` 내 HEX 하드코딩 (`#20344f`, `#ff92aa` 등) | **높음**: 에러/로딩 화면이 테마 토큰과 단절됨 |
| **렌더링 구조** | 순수 React 컴포넌트 렌더링 | `iframe` + `chart-shell-v2.html` 주입 방식 | **구조적**: React와 내부 쉘 간 스타일 이원화 상태 |

---

## 3. 세부 상세 분석

### 1) 디자인 토큰 불일치
- 현재 화면의 CSS(`chart-v2.css`)는 레거시 변수명(`--panel`, `--border`, `--green` 등)을 직접 사용하고 있습니다.
- `DESIGN.md`에서 규정한 표준 토큰 시스템(`--bg-surface`, `--border-subtle`, `--color-bull` 등)과 매핑 레이어가 부재합니다.

### 2) React 쉘 인라인 스타일링
- `LegacyAnalyzerApp.tsx`의 로딩/에러 화면(`styles` 객체)에 토큰 대신 임의의 HEX 코드(`#080c14`, `#20344f`, `#0d1725`, `#ff92aa`, `#ffcad5`)가 직접 삽입되어 있어 하네스 검증 규칙 위반 상태입니다.

### 3) 반응형 및 모바일 지원
- 사이드바 폭이 `320px` 고정이며, 메인 컨테이너가 `overflow: hidden`과 고정 높이 위주로 구성되어 있어 모바일 뷰포트에서 차트 왜곡 또는 잘림 현상이 발생합니다.

### 4) 폰트 크기 과대화 (정보 밀도 저하)
- `chart-v2.css`의 `body` 기본 폰트가 `18px`, 헤더 타이틀이 `2.1rem (약 38px)`로 과도하게 크게 설정되어 있습니다.
- 암호화폐/차트 분석 도구의 특성상 다수의 지표와 수치를 한눈에 파악해야 함에도, 거대한 폰트로 인해 UI 컴포넌트가 비대해지고 가독성이 저해됩니다.

---

## 4. 권장 조치 사항
1. **폰트 사이즈 리스케일링**: `body`를 `13~14px`, 헤더 타이틀을 `16~18px`로 전면 축소.
2. **토큰 브릿지 적용**: `chart-v2.css`의 `:root`에 `DESIGN.md` 토큰을 별칭(Alias)으로 선언하여 일치화.
3. **React 인라인 스타일 제거**: `LegacyAnalyzerApp.tsx`의 스타일을 토큰 기반 CSS 클래스로 리팩터링.
4. **웹폰트 로딩 최적화**: 필수 폰트 외 불필요한 CDN 폰트 정리 및 시스템 폰트 fallback 강화.
