---
name: design-verify
description: Verify frontend implementation against DESIGN.md and design_rules.md. Evaluates design tokens, dark theme contrast, chart styling, and responsive layout. Use during STEP 3 / GATE 3 design verification.
version: 1.0.0
user-invocable: true
argument-hint: "[component, page, or css file]"
---

# Design Verification Harness Skill

Verify UI/UX code against the project's official `DESIGN.md` and `design_rules.md`.

## 1. Context Loading
1. Read `DESIGN.md` for active design tokens (colors, typography, spacing).
2. Read `design_rules.md` for gate requirements.

## 2. Evaluation Dimensions

### A. Design Token Compliance (Pass / Fail)
- Scan target files for raw HEX/RGB colors.
- Ensure all colors map to official tokens (`--bg-main`, `--color-bull`, `--color-bear`, etc.).
- Flag any hard-coded colors.

### B. Dark Theme & Accessibility (Contrast)
- Verify text-to-background contrast ratio >= 4.5:1.
- Ensure muted text (`--text-secondary`) remains readable on `--bg-surface`.

### C. Chart & Layout Integrity
- Verify `lightweight-charts` container and tooltip align with `--bg-surface` and border tokens.
- Ensure responsive layout without horizontal overflow on mobile viewports.

## 3. Output Format

Produce a structured pass/fail verdict:
```markdown
### Design Verification Result: [PASS / FAIL]
- [x] Design Tokens: All colors use DESIGN.md tokens
- [x] Theme & Contrast: WCAG AA contrast satisfied
- [x] Layout: Responsive without viewport overflow
```
