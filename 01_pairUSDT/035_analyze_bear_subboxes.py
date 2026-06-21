"""035_analyze_bear_subboxes.py

하락장(BEAR Phase) 내에서 발생하는 서브박스들의 통계적 패턴을 분석합니다.
Supabase의 coin_sub_boxes 테이블을 조회하여 분석 지표를 계산하고 출력합니다.

Usage: python 035_analyze_bear_subboxes.py
"""

import logging
from collections import defaultdict
import numpy as np
import requests

from lib.common.config import SUPABASE_ANON_KEY, SUPABASE_URL

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

SUPABASE_PAGE_SIZE = 1000

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

def analyze_bear_patterns():
    log.info("Supabase에서 하락장(BEAR) 서브박스 데이터를 가져옵니다...")
    # Fetch subboxes specifically belonging to BEAR phase
    subboxes = fetch_all_supabase(
        "coin_sub_boxes",
        "coin_id,cycle_number,parent_box_index,sub_box_index,duration,range_pct,lower",
        {"parent_phase": "eq.BEAR", "order": "coin_id.asc,cycle_number.asc,parent_box_index.asc,sub_box_index.asc"}
    )
    
    if not subboxes:
        log.warning("하락장 서브박스 데이터가 없습니다.")
        return

    # Group by parent macro-box (each parent box represents a contiguous BEAR section)
    bear_sections = defaultdict(list)
    for sb in subboxes:
        key = (sb["coin_id"], sb["cycle_number"], sb["parent_box_index"])
        bear_sections[key].append(sb)

    # Metrics collections
    total_bear_sections = len(bear_sections)
    subbox_counts = []
    durations = []
    range_pcts = []
    breakdown_drops = [] # Percentage drop from one subbox to the next

    for key, sbs in bear_sections.items():
        subbox_counts.append(len(sbs))
        for i, sb in enumerate(sbs):
            durations.append(sb["duration"])
            range_pcts.append(sb["range_pct"])
            
            # If not the last subbox, calculate drop to the next subbox
            if i < len(sbs) - 1:
                current_lower = sb["lower"]
                next_lower = sbs[i+1]["lower"]
                if current_lower > 0:
                    drop_pct = (current_lower - next_lower) / current_lower * 100.0
                    breakdown_drops.append(drop_pct)

    log.info("\n" + "="*50)
    log.info("📊 하락장(BEAR Phase) 서브박스 통계 분석 결과")
    log.info("="*50)
    log.info(f"분석된 총 하락장 구간(Macro Box) 수: {total_bear_sections}개")
    log.info(f"분석된 총 서브박스 수: {len(subboxes)}개\n")

    # 1. 발생 빈도
    avg_count = np.mean(subbox_counts)
    median_count = np.median(subbox_counts)
    max_count = np.max(subbox_counts)
    log.info(f"📉 1. 발생 빈도 (1개 하락장 구간 당 서브박스 개수)")
    log.info(f"   - 평균 개수: {avg_count:.2f}개")
    log.info(f"   - 중앙값: {median_count:.0f}개")
    log.info(f"   - 최대 개수: {max_count:.0f}개\n")

    # 2. 지속 기간
    avg_dur = np.mean(durations)
    median_dur = np.median(durations)
    log.info(f"⏳ 2. 지속 기간 (서브박스 1개가 유지되는 일수)")
    log.info(f"   - 평균: {avg_dur:.1f}일")
    log.info(f"   - 중앙값: {median_dur:.1f}일\n")

    # 3. 변동폭
    avg_range = np.mean(range_pcts)
    median_range = np.median(range_pcts)
    log.info(f"📏 3. 상/하단 변동폭 (Range Pct)")
    log.info(f"   - 평균 진폭: {avg_range:.2f}%")
    log.info(f"   - 중앙값: {median_range:.2f}%\n")

    # 4. 계단식 하락폭
    if breakdown_drops:
        avg_drop = np.mean(breakdown_drops)
        median_drop = np.median(breakdown_drops)
        log.info(f"🔻 4. 계단식 하락폭 (이전 서브박스 하단 붕괴 시, 다음 서브박스 하단까지의 추가 하락폭)")
        log.info(f"   - 평균 하락폭: {avg_drop:.2f}%")
        log.info(f"   - 중앙값 하락폭: {median_drop:.2f}%\n")
    else:
        log.info(f"🔻 4. 계단식 하락폭")
        log.info("   - 여러 개의 서브박스가 연속된 구간이 충분하지 않아 계산할 수 없습니다.\n")
        
    log.info("💡 인사이트 예시:")
    if breakdown_drops:
        log.info(f"  하락장에서는 평균적으로 {avg_count:.1f}번의 계단식 횡보장(서브박스)이 형성되며, "
                 f"한번 박스권이 만들어지면 약 {avg_dur:.1f}일간 유지됩니다.")
        log.info(f"  또한, 지지선이 깨질 때마다 다음 바닥까지 평균 {np.mean(breakdown_drops):.1f}%의 추가 하락이 발생합니다.")

if __name__ == "__main__":
    analyze_bear_patterns()
