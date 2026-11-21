// UI interactions: coin list, buttons, search, toggles
import { chartState } from './chart-logic.js';
import { CYCLE_COLORS } from './chart-logic.js';
import { drawChart } from './chart-draw.js';
import {
  ensureCycleLoaded,
  findManifestCycle,
  getDashboardManifest,
  getCycleDisplayName,
  getCycleStatus,
  getManifestCoins,
  isCycleAvailable,
} from './chart-lazy-load.js';

declare const ALL_DATA: any;

/** 매니페스트 + 이미 로드된 ALL_DATA에서 사이클 번호만 모음 (가짜 1~5 폴백 없음) */
function collectCycleNumbersForCoin(coinId: string): Set<number> {
  const nums = new Set<number>();
  const manifestCoin = getManifestCoins().find((c: any) => c.coin_id === coinId);
  for (const c of manifestCoin?.cycles || []) {
    const n = Number(c.cycle_number);
    if (Number.isFinite(n) && n > 0) nums.add(n);
  }
  const coinData = ALL_DATA?.[coinId];
  for (const c of coinData?.cycles || []) {
    const n = Number(c.cycle_number);
    if (Number.isFinite(n) && n > 0) nums.add(n);
  }
  return nums;
}

// ── Coin List UI ──────────────────────────────────────
export function buildCoinList(filter: string = ''): void {
  const el = document.getElementById('coinList');
  if (!el) return;
  el.innerHTML = '';
  const coins = getManifestCoins().filter((d: any) => {
    return (
      (d.symbol || '').toLowerCase().includes(filter.toLowerCase()) ||
      (d.name || '').toLowerCase().includes(filter.toLowerCase())
    );
  });

  coins.forEach((d: any) => {
    const id = d.coin_id;
    const sel = chartState.selectedCoins.includes(id);
    const div = document.createElement('div');
    div.className = 'coin-item' + (sel ? ' checked active' : '');
    (div as any).dataset.id = id;
    div.innerHTML = `
      <div class="coin-check">
        <svg width="8" height="8" viewBox="0 0 8 8">
          <polyline points="1,4 3,6 7,2" fill="none" stroke="#080c14" stroke-width="1.5"/>
        </svg>
      </div>
      <span class="coin-rank">#${d.rank || '?'}</span>
      <span class="coin-symbol">${d.symbol}</span>
      <span class="coin-name">${d.name}</span>
    `;
    div.onclick = () => {
      void toggleCoin(id, div);
    };
    el.appendChild(div);
  });
}

async function loadActiveCyclesForSelection(): Promise<void> {
  const tasks: Promise<void>[] = [];
  chartState.selectedCoins.forEach((coinId: string) => {
    chartState.activeCycles.forEach((cycleNumber: number) => {
      if (isCycleAvailable(coinId, cycleNumber)) {
        tasks.push(ensureCycleLoaded(coinId, cycleNumber, true, false));
      }
    });
  });

  buildCycleToggles();
  await Promise.allSettled(tasks);
  buildCycleToggles();
  drawChart();
}

async function toggleCoin(id: string, el: HTMLElement): Promise<void> {
  const idx = chartState.selectedCoins.indexOf(id);
  if (idx >= 0) {
    // 최소 1개 코인은 항상 선택 상태 유지 (마지막 코인은 해제 불가)
    if (chartState.selectedCoins.length === 1) {
      return;
    }
    chartState.selectedCoins.splice(idx, 1);
    el.classList.remove('checked', 'active');
  } else {
    chartState.selectedCoins.push(id);
    el.classList.add('checked', 'active');
  }
  await loadActiveCyclesForSelection();
}

function clearAll(): void {
  chartState.selectedCoins = [];
  const input = document.getElementById('searchInput') as HTMLInputElement | null;
  buildCoinList(input?.value ?? '');
  drawChart();
}

// ── Cycle Toggles UI ──────────────────────────────────
export function buildCycleToggles(): void {
  const el = document.getElementById('cycleToggles');
  if (!el) return;
  el.innerHTML = '';
  const cycleNums = new Set<number>();
  chartState.selectedCoins.forEach((id: string) => {
    collectCycleNumbersForCoin(id).forEach((n) => cycleNums.add(n));
  });
  // activeCycles 에 현재 표시 가능한 사이클이 하나도 없으면
  // 가장 최신 사이클(최대 cycle 번호)을 기본 선택으로 설정
  const hasActiveInView = Array.from(cycleNums).some((n) =>
    chartState.activeCycles.has(n),
  );
  if (cycleNums.size > 0 && !hasActiveInView) {
    const maxCycle = Math.max(...Array.from(cycleNums));
    chartState.activeCycles = new Set([maxCycle]);
  }
  [...cycleNums].sort().forEach((n: number) => {
    const col = (CYCLE_COLORS as any)[n] || (CYCLE_COLORS as any)[1];
    let name = `CYCLE ${n}`;
    for (const id of chartState.selectedCoins) {
      const found = findManifestCycle(id, n);
      if (found) {
        name = getCycleDisplayName(id, n).toUpperCase();
        break;
      }
    }
    const btn = document.createElement('button');
    btn.className = 'cycle-btn';
    const active = chartState.activeCycles.has(n);
    const statuses = chartState.selectedCoins.map((coinId: string) => ({
      available: isCycleAvailable(coinId, n),
      status: getCycleStatus(coinId, n),
    }));
    const hasUnavailable = statuses.some((item) => !item.available);
    const hasLoading = statuses.some((item) => item.status === 'loading');
    const hasError = statuses.some((item) => item.status === 'error');
    const allEmpty =
      statuses.length > 0 &&
      statuses.every((item) => !item.available || item.status === 'empty');
    const allLoaded =
      statuses.length > 0 &&
      statuses.every(
        (item) =>
          !item.available ||
          item.status === 'loaded' ||
          item.status === 'empty',
      );
    (btn as HTMLButtonElement).style.cssText = active
      ? `border-color:${col.main};color:${col.main};background:${col.band}`
      : 'border-color:#1e2d45;color:#4a6080;background:transparent';
    if (hasUnavailable) {
      btn.style.opacity = '0.45';
    }
    if (hasError) {
      btn.style.borderColor = '#ff4466';
      btn.style.color = '#ff92aa';
    } else if (hasLoading) {
      btn.style.borderColor = '#FFB800';
      btn.style.color = '#FFB800';
    } else if (allEmpty) {
      btn.style.borderColor = '#4a6080';
      btn.style.color = '#6882a7';
    } else if (allLoaded && !active) {
      btn.style.borderColor = '#2d4a68';
    }
    btn.textContent = hasLoading
      ? `${name} LOADING`
      : hasError
        ? `${name} ERROR`
        : allEmpty
          ? `${name} EMPTY`
          : name;
    btn.onclick = () => {
      if (chartState.activeCycles.has(n)) chartState.activeCycles.delete(n);
      else chartState.activeCycles.add(n);
      void loadActiveCyclesForSelection();
    };
    el.appendChild(btn);
  });
}

(window as any).buildCycleToggles = buildCycleToggles;

export function toggleShowDropdown(): void {
  const menu = document.getElementById('showDropdownMenu');
  if (menu) {
    menu.classList.toggle('show');
  }
}

function syncCheckboxStates(): void {
  const chkRange = document.getElementById('chkRange') as HTMLInputElement | null;
  if (chkRange) chkRange.checked = Boolean(chartState.showHighLow);

  const chkBox = document.getElementById('chkBox') as HTMLInputElement | null;
  if (chkBox) chkBox.checked = Boolean(chartState.showBoxZone);

  const chkBearBull = document.getElementById('chkBearBull') as HTMLInputElement | null;
  if (chkBearBull) chkBearBull.checked = Boolean(chartState.showPrediction);

  const chkExtended = document.getElementById('chkExtendedForecast') as HTMLInputElement | null;
  if (chkExtended) {
    chkExtended.checked = Boolean(chartState.showExtendedForecast);
    chkExtended.disabled = !chartState.showPrediction;
  }

  const chkSubBox = document.getElementById('chkSubBox') as HTMLInputElement | null;
  if (chkSubBox) chkSubBox.checked = Boolean(chartState.showSubBox);

  const chkBB = document.getElementById('chkBB') as HTMLInputElement | null;
  if (chkBB) chkBB.checked = Boolean(chartState.showBB);

  // 하위 호환: 기존 버튼 스타일도 있으면 동기화
  const rangeBtn = document.getElementById('toggleRange');
  if (rangeBtn) {
    rangeBtn.style.cssText = chartState.showHighLow
      ? 'border-color:#00d4ff;color:#00d4ff;background:rgba(0,212,255,0.1)'
      : 'border-color:#4a6080;color:#4a6080;';
  }
  const boxBtn = document.getElementById('toggleBox');
  if (boxBtn) {
    boxBtn.style.cssText = chartState.showBoxZone
      ? 'border-color:#FFB800;color:#FFB800;background:rgba(255,184,0,0.1)'
      : 'border-color:#4a6080;color:#4a6080;';
  }
  const predBtn = document.getElementById('toggleBearBull');
  if (predBtn) {
    predBtn.style.cssText = chartState.showPrediction
      ? 'border-color:#ff6bb5;color:#ff6bb5;background:rgba(255,107,181,0.1)'
      : 'border-color:#4a6080;color:#4a6080;';
  }
  const subBoxBtn = document.getElementById('toggleSubBox');
  if (subBoxBtn) {
    subBoxBtn.style.cssText = chartState.showSubBox
      ? 'border-color:#00d4ff;color:#00d4ff;background:rgba(0,212,255,0.10)'
      : 'border-color:#4a6080;color:#4a6080;';
  }
  const bbBtn = document.getElementById('toggleBB');
  if (bbBtn) {
    bbBtn.style.cssText = chartState.showBB
      ? 'border-color:#a78bfa;color:#d8ccff;background:rgba(167,139,250,0.12)'
      : 'border-color:#4a6080;color:#4a6080;';
  }
  updateExtendedForecastButton();
}

function toggleHighLow() {
  const chk = document.getElementById('chkRange') as HTMLInputElement | null;
  chartState.showHighLow = chk ? chk.checked : !chartState.showHighLow;
  syncCheckboxStates();
  drawChart();
}

function toggleBoxZone() {
  const chk = document.getElementById('chkBox') as HTMLInputElement | null;
  chartState.showBoxZone = chk ? chk.checked : !chartState.showBoxZone;
  syncCheckboxStates();
  drawChart();
}

function toggleBearBull() {
  const chk = document.getElementById('chkBearBull') as HTMLInputElement | null;
  chartState.showPrediction = chk ? chk.checked : !chartState.showPrediction;
  if (!chartState.showPrediction) {
    chartState.showExtendedForecast = false;
  }
  syncCheckboxStates();
  drawChart();
}

function updateExtendedForecastButton(): void {
  const btn = document.getElementById('toggleExtendedForecast') as HTMLButtonElement | null;
  if (!btn) return;
  btn.disabled = !chartState.showPrediction;
  btn.style.cssText =
    chartState.showPrediction && chartState.showExtendedForecast
      ? 'border-color:#a78bfa;color:#d8ccff;background:rgba(167,139,250,0.12)'
      : chartState.showPrediction
      ? 'border-color:#4a6080;color:#4a6080;'
      : 'border-color:#26364f;color:#344966;opacity:0.55;';
}

function toggleExtendedForecast() {
  if (!chartState.showPrediction) return;
  const chk = document.getElementById('chkExtendedForecast') as HTMLInputElement | null;
  chartState.showExtendedForecast = chk ? chk.checked : !chartState.showExtendedForecast;
  syncCheckboxStates();
  drawChart();
}

function toggleSubBox() {
  const chk = document.getElementById('chkSubBox') as HTMLInputElement | null;
  chartState.showSubBox = chk ? chk.checked : !chartState.showSubBox;
  syncCheckboxStates();
  drawChart();
}

function toggleBB() {
  const chk = document.getElementById('chkBB') as HTMLInputElement | null;
  chartState.showBB = chk ? chk.checked : !chartState.showBB;
  syncCheckboxStates();
  drawChart();
}

// ── Defaults & Bottom Override UI ─────────────────────
export function initDefaults() {
  const manifest = getDashboardManifest() || {};
  if (
    typeof manifest.default_coin_id === 'string' &&
    getManifestCoins().some((coin: any) => coin.coin_id === manifest.default_coin_id)
  ) {
    chartState.selectedCoins = [manifest.default_coin_id];
  }
  if (Number.isFinite(Number(manifest.default_cycle_number))) {
    chartState.activeCycles = new Set([Number(manifest.default_cycle_number)]);
  } else {
  // 기본 코인: BTC 자동 선택 (이미 selectedCoins 에 세팅되어 있음)
  // 기본 사이클: CURRENT / 최신 사이클을 포함해 존재하는 사이클 중 최대 번호를 활성화
  const allCycleNums = new Set<number>();
  getManifestCoins().forEach((coin: any) => {
    (coin.cycles || []).forEach((c: any) =>
      allCycleNums.add(Number(c.cycle_number)),
    );
  });
  if (allCycleNums.size > 0) {
    const maxCycle = Math.max(...Array.from(allCycleNums.values()));
    chartState.activeCycles = new Set([maxCycle]);
  }
  }
  // Checkbox 및 버튼 UI 상태 동기화
  syncCheckboxStates();
}

// ── Wire DOM events & expose toggles for onclick ───────
const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | null;
    buildCoinList(target?.value ?? '');
  });
}

// Close dropdown on outside click
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e: MouseEvent) => {
    const container = document.getElementById('showDropdownContainer');
    if (container && !container.contains(e.target as Node)) {
      const menu = document.getElementById('showDropdownMenu');
      if (menu && menu.classList.contains('show')) {
        menu.classList.remove('show');
      }
    }
  });
}

(window as any).toggleShowDropdown = toggleShowDropdown;
(window as any).syncCheckboxStates = syncCheckboxStates;
(window as any).toggleHighLow = toggleHighLow;
(window as any).toggleBoxZone = toggleBoxZone;
(window as any).toggleBearBull = toggleBearBull;
(window as any).toggleExtendedForecast = toggleExtendedForecast;
(window as any).toggleSubBox = toggleSubBox;
(window as any).toggleBB = toggleBB;

