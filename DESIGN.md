# DESIGN.md - Design System & DNA

암호화폐 차트 및 대시보드 인터페이스를 위한 디자인 시스템 명세입니다.

---

## 1. Design Principles
- **Data-First**: 데이터와 차트 가독성이 최우선입니다. 장식적 요소는 최소화합니다.
- **Dark Theme Priority**: 장시간 차트 분석을 위해 Slate/Zinc 계열의 다크 테마를 기본으로 합니다.
- **High Contrast & Clarity**: 차트 보조지표, 박스권, 예측 밴드의 색상이 배경과 명확히 구분되어야 합니다.

---

## 2. Color Palette (Design Tokens)

| 토큰명 | CSS / HEX | 용도 |
|---|---|---|
| `--bg-main` | `#0b0e14` | 앱 메인 캔버스 배경 |
| `--bg-surface` | `#151922` | 카드, 패널, 모달 배경 |
| `--border-subtle` | `#232936` | 컨테이너 경계선, 구분선 |
| `--text-primary` | `#f1f5f9` | 주요 텍스트, 헤더, 지표 수치 |
| `--text-secondary` | `#94a3b8` | 보조 설명, 라벨, 타임스탬프 |
| `--color-bull` | `#0ecb81` | 양봉, 상승 신호, 박스 상단 돌파 |
| `--color-bear` | `#f6465d` | 음봉, 하락 신호, 손절 라인 |
| `--color-accent` | `#38bdf8` | 포커스, 액티브 탭, 예측 밴드 |

---

## 3. Typography & Spacing
- **Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Monospace (숫자/지표)**: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`

### Typography Scale (금융/차트 대시보드 표준)
| 구분 | 권장 크기 | Line Height | 적용 대상 |
|---|---|---|---|
| **Header Title** | `16px ~ 18px` | 1.3 | 대시보드 메인 헤더, 모달 제목 |
| **Section Title** | `14px ~ 15px` | 1.4 | 사이드바 섹션명, 카드 타이틀 |
| **Body / Label** | `13px ~ 14px` | 1.5 | 일반 라벨, 메뉴 텍스트 (기존 18px 방지) |
| **Data / Numbers** | `12px ~ 13px` | 1.2 | 가격, 수치, OHLCV 지표값 |
| **Caption / Sub** | `11px ~ 12px` | 1.4 | 타임스탬프, 보조 설명, 배지 |

- **Base Grid**: 4px / 8px 배수 간격 (`gap-2`: 8px, `gap-4`: 16px, `p-4`: 16px)
- **Border Radius**: 패널 `8px`, 버튼 `6px`, 뱃지 `4px`
