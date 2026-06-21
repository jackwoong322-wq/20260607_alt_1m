"""042_backtest_subbox_strategy.py

하락장 서브박스 데이터를 활용하여 숏(Short) 돌파 매매 전략을 백테스트합니다.
전략: 현재 서브박스의 하단(lower)이 깨질 때 숏 진입.
청산: 다음 서브박스의 하단(lower)에서 익절/손절.

Usage: python 042_backtest_subbox_strategy.py
"""

import logging
from collections import defaultdict
import requests

from lib.common.config import SUPABASE_ANON_KEY, SUPABASE_URL

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

SUPABASE_PAGE_SIZE = 1000

# Trading Parameters
FEE_RATE = 0.0004  # 0.04% limit/market average per trade
SLIPPAGE = 0.0010  # 0.1% slippage per trade
TOTAL_COST = (FEE_RATE + SLIPPAGE) * 2  # Entry + Exit cost

def get_supabase_headers() -> dict:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("SUPABASE_URL/SUPABASE_ANON_KEY가 설정되지 않았습니다.")
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    return headers

def fetch_all_supabase(table: str, select_cols: str, extra_params: dict | None = None) -> list[dict]:
    rows = []
    offset = 0
    headers = get_supabase_headers()

    while True:
        params = {"select": select_cols}
        if extra_params:
            params.update(extra_params)

        page_headers = {
            **headers,
            "Range-Unit": "items",
            "Range": f"{offset}-{offset + SUPABASE_PAGE_SIZE - 1}",
        }
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            params=params,
            headers=page_headers,
            timeout=60,
        )
        res.raise_for_status()

        batch = res.json()
        rows.extend(batch)
        if len(batch) < SUPABASE_PAGE_SIZE:
            break
        offset += SUPABASE_PAGE_SIZE

    return rows

import matplotlib.pyplot as plt
import numpy as np

def run_backtest():
    log.info("Fetching BEAR phase subboxes for backtest...")
    subboxes = fetch_all_supabase(
        "coin_sub_boxes",
        "coin_id,cycle_number,parent_box_index,sub_box_index,lower,duration",
        {"parent_phase": "eq.BEAR", "order": "coin_id.asc,cycle_number.asc,parent_box_index.asc,sub_box_index.asc"}
    )
    
    bear_sections = defaultdict(list)
    for sb in subboxes:
        key = (sb["coin_id"], sb["cycle_number"], sb["parent_box_index"])
        bear_sections[key].append(sb)

    total_trades = 0
    winning_trades = 0
    losing_trades = 0
    
    cumulative_pnl_pct = 0.0
    all_pnls = []
    cumulative_pnl_history = [0.0]

    for key, sbs in bear_sections.items():
        if len(sbs) < 2:
            continue
            
        for i in range(len(sbs) - 1):
            entry_price = sbs[i]["lower"]
            exit_price = sbs[i+1]["lower"]
            
            if entry_price <= 0:
                continue
                
            gross_pnl_pct = (entry_price - exit_price) / entry_price
            net_pnl_pct = gross_pnl_pct - TOTAL_COST
            
            all_pnls.append(net_pnl_pct * 100)
            cumulative_pnl_pct += net_pnl_pct
            cumulative_pnl_history.append(cumulative_pnl_pct * 100)
            
            total_trades += 1
            if net_pnl_pct > 0:
                winning_trades += 1
            else:
                losing_trades += 1

    if total_trades == 0:
        log.warning("No trades executed.")
        return

    win_rate = (winning_trades / total_trades) * 100.0
    avg_pnl = (cumulative_pnl_pct / total_trades) * 100.0
    total_pnl_pct = cumulative_pnl_pct * 100.0
    
    # Generate Plot
    plt.figure(figsize=(10, 6))
    plt.plot(cumulative_pnl_history, color='red', linewidth=1.5, label='Cumulative PnL (%)')
    plt.axhline(y=0, color='gray', linestyle='--')
    plt.fill_between(range(len(cumulative_pnl_history)), cumulative_pnl_history, 0, where=(np.array(cumulative_pnl_history) >= 0), facecolor='green', alpha=0.3)
    plt.fill_between(range(len(cumulative_pnl_history)), cumulative_pnl_history, 0, where=(np.array(cumulative_pnl_history) < 0), facecolor='red', alpha=0.3)
    plt.title('Backtest: Short Breakdown Strategy in Bear Market')
    plt.xlabel('Trade Number')
    plt.ylabel('Cumulative PnL (%)')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    import os
    os.makedirs('reports', exist_ok=True)
    plt.savefig('reports/backtest_pnl.png', dpi=150)
    log.info("Plot saved to reports/backtest_pnl.png")
    
    log.info("="*50)
    log.info("🚀 하락장 서브박스 하단 붕괴 숏(Short) 백테스트 결과")
    log.info("="*50)
    log.info("전략: 현재 서브박스 하단 붕괴 시 숏 진입, 다음 서브박스 하단 형성 시 청산")
    log.info(f"거래 수수료 및 슬리피지: 왕복 {(TOTAL_COST * 100):.2f}% 차감 적용\n")
    log.info(f"총 매매 횟수: {total_trades}회")
    log.info(f"승리 횟수: {winning_trades}회")
    log.info(f"패배 횟수: {losing_trades}회")
    log.info(f"승률(Win Rate): {win_rate:.2f}%\n")
    log.info(f"1회 매매 당 평균 순수익률: {avg_pnl:.2f}%")
    log.info(f"단리 누적 순수익률: {total_pnl_pct:.2f}%")
    log.info("="*50)

if __name__ == "__main__":
    run_backtest()
