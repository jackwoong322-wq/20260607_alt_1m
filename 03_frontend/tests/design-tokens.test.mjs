import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const chartV2Css = fs.readFileSync(path.join(rootDir, '03_frontend/public/legacy/chart-v2.css'), 'utf-8');
const templateChartCss = fs.readFileSync(path.join(rootDir, '01_pairUSDT/templates/chart.css'), 'utf-8');
const legacyAppTsx = fs.readFileSync(path.join(rootDir, '03_frontend/src/LegacyAnalyzerApp.tsx'), 'utf-8');
const designMd = fs.readFileSync(path.join(rootDir, 'DESIGN.md'), 'utf-8');

// 1~8. DESIGN.md 토큰이 chart-v2.css :root에 정의되어 있는지 검증
test('1. chart-v2.css should define --bg-main token with #0b0e14', () => {
  assert.match(chartV2Css, /--bg-main:\s*#0b0e14;/);
});

test('2. chart-v2.css should define --bg-surface token with #151922', () => {
  assert.match(chartV2Css, /--bg-surface:\s*#151922;/);
});

test('3. chart-v2.css should define --border-subtle token with #232936', () => {
  assert.match(chartV2Css, /--border-subtle:\s*#232936;/);
});

test('4. chart-v2.css should define --text-primary token with #f1f5f9', () => {
  assert.match(chartV2Css, /--text-primary:\s*#f1f5f9;/);
});

test('5. chart-v2.css should define --text-secondary token with #94a3b8', () => {
  assert.match(chartV2Css, /--text-secondary:\s*#94a3b8;/);
});

test('6. chart-v2.css should define --color-bull token with #0ecb81', () => {
  assert.match(chartV2Css, /--color-bull:\s*#0ecb81;/);
});

test('7. chart-v2.css should define --color-bear token with #f6465d', () => {
  assert.match(chartV2Css, /--color-bear:\s*#f6465d;/);
});

test('8. chart-v2.css should define --color-accent token with #38bdf8', () => {
  assert.match(chartV2Css, /--color-accent:\s*#38bdf8;/);
});

// 9~12. chart-v2.css 폰트 사이즈 리스케일링 검증
test('9. chart-v2.css body should have scaled font-size: 13px', () => {
  assert.match(chartV2Css, /body\s*\{[^}]*font-size:\s*13px;/);
});

test('10. chart-v2.css .header-title should have scaled font-size: 1.15rem', () => {
  assert.match(chartV2Css, /\.header-title\s*\{[^}]*font-size:\s*1\.15rem;/);
});

test('11. chart-v2.css .header-subtitle should have scaled font-size: 0.85rem', () => {
  assert.match(chartV2Css, /\.header-subtitle\s*\{[^}]*font-size:\s*0\.85rem;/);
});

test('12. chart-v2.css .header-info should have scaled font-size: 0.75rem', () => {
  assert.match(chartV2Css, /\.header-info\s*\{[^}]*font-size:\s*0\.75rem;/);
});

// 13~14. 01_pairUSDT/templates/chart.css 동기화 검증
test('13. templates/chart.css body should have scaled font-size: 13px', () => {
  assert.match(templateChartCss, /body\s*\{[^}]*font-size:\s*13px;/);
});

test('14. templates/chart.css header-title should have scaled font-size: 16px', () => {
  assert.match(templateChartCss, /\.header-title\s*\{[^}]*font-size:\s*16px;/);
});

// 15~18. LegacyAnalyzerApp.tsx 폰트 및 토큰 검증
test('15. LegacyAnalyzerApp.tsx statusTitle should have scaled fontSize 1.15rem', () => {
  assert.match(legacyAppTsx, /statusTitle:\s*\{[^}]*fontSize:\s*'1\.15rem'/);
});

test('16. LegacyAnalyzerApp.tsx statusText should have scaled fontSize 0.84rem', () => {
  assert.match(legacyAppTsx, /statusText:\s*\{[^}]*fontSize:\s*'0\.84rem'/);
});

test('17. LegacyAnalyzerApp.tsx statusEyebrow should have scaled fontSize 0.72rem', () => {
  assert.match(legacyAppTsx, /statusEyebrow:\s*\{[^}]*fontSize:\s*'0\.72rem'/);
});

test('18. LegacyAnalyzerApp.tsx statusCard should use DESIGN.md radius (8px)', () => {
  assert.match(legacyAppTsx, /statusCard:\s*\{[^}]*borderRadius:\s*8/);
});

// 19~20. 금지 규칙 및 디자인 DNA 무결성 검증
test('19. chart-v2.css body should NOT contain obsolete 18px font-size', () => {
  assert.doesNotMatch(chartV2Css, /body\s*\{[^}]*font-size:\s*18px;/);
});

test('20. LegacyAnalyzerApp.tsx error state should use DESIGN.md --color-bear (#f6465d)', () => {
  assert.match(legacyAppTsx, /color:\s*'#f6465d'/);
});
