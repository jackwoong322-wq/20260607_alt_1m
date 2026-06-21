"""034_generate_subboxes.py

DB에 저장된 메인 박스(coin_analysis_results)를 기반으로 서브박스를 계산하고,
coin_sub_boxes 테이블에 일괄 저장합니다.

Usage: python 034_generate_subboxes.py
"""

import logging
from collections import defaultdict
import numpy as np
import requests

from lib.common.config import SUPABASE_ANON_KEY, SUPABASE_URL
from lib.subbox.detect import detect_sub_boxes

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SUPABASE_PAGE_SIZE = 1000

def get_supabase_headers(include_json: bool = False) -> dict:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("SUPABASE_URL/SUPABASE_ANON_KEY가 설정되지 않았습니다.")
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    if include_json:
        headers["Content-Type"] = "application/json"
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

def load_data():
    log.info("Loading cycle data from Supabase...")
    cycle_rows = fetch_all_supabase(
        "alt_cycle_data",
        "coin_id,cycle_number,days_since_peak,close_rate,high_rate,low_rate",
        {"order": "coin_id.asc,cycle_number.asc,days_since_peak.asc"},
    )
    cycles_by_coin = defaultdict(lambda: defaultdict(list))
    for row in cycle_rows:
        cid = row.get("coin_id")
        cnum = row.get("cycle_number")
        if not cid or cnum is None:
            continue
        cycles_by_coin[cid][cnum].append({
            "x": int(row.get("days_since_peak", 0)),
            "close": float(row.get("close_rate", 0.0)),
            "high": float(row.get("high_rate", 0.0)),
            "low": float(row.get("low_rate", 0.0)),
        })

    log.info("Loading analysis results from Supabase...")
    box_rows = fetch_all_supabase(
        "coin_analysis_results",
        "coin_id,cycle_number,box_index,phase,result,start_x,end_x",
        {"is_prediction": "eq.0", "order": "coin_id.asc,cycle_number.asc,box_index.asc"}
    )
    
    return cycles_by_coin, box_rows

def _normalize_value(v):
    if isinstance(v, np.generic):
        return v.item()
    return v

def sync_subboxes_to_supabase(rows: list[dict]):
    headers = {**get_supabase_headers(include_json=True), "Prefer": "return=minimal"}

    # Clear old data
    log.info("Clearing old subbox data...")
    res = requests.delete(
        f"{SUPABASE_URL}/rest/v1/coin_sub_boxes",
        headers=headers,
        timeout=60,
    )
    if res.status_code != 204 and res.status_code != 200:
        log.error(f"Failed to clear old data: {res.text}")

    if not rows:
        log.info("Supabase coin_sub_boxes 동기화 완료: 0행")
        return

    log.info(f"Inserting {len(rows)} subboxes...")
    for i in range(0, len(rows), SUPABASE_PAGE_SIZE):
        chunk = rows[i : i + SUPABASE_PAGE_SIZE]
        payload = [{k: _normalize_value(v) for k, v in row.items()} for row in chunk]
        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/coin_sub_boxes",
            headers=headers,
            json=payload,
            timeout=60,
        )
        res.raise_for_status()

    log.info("Supabase coin_sub_boxes 동기화 완료: %d행", len(rows))

def main():
    cycles_by_coin, box_rows = load_data()
    
    all_subboxes = []
    
    log.info("Generating sub-boxes...")
    for parent_box in box_rows:
        cid = parent_box["coin_id"]
        cnum = parent_box["cycle_number"]
        data = cycles_by_coin.get(cid, {}).get(cnum, [])
        if not data:
            continue
            
        # We need to construct parent_box with enough fields for detect_sub_boxes
        # It needs 'result', 'start_x', 'end_x', 'box_index', 'phase'
        forced_parent = dict(parent_box)
        forced_parent["result"] = "ACTIVE" # Force active to bypass early returns (if any)
        
        # Detect subboxes
        subboxes = detect_sub_boxes(data, forced_parent, min_duration=5, breakout_buffer_pct=0.75)
        
        for sb in subboxes:
            row = {
                "coin_id": cid,
                "cycle_number": cnum,
                "parent_box_index": parent_box["box_index"],
                "parent_phase": parent_box["phase"],
                "parent_result": parent_box["result"],
                "sub_box_index": sb["sub_box_index"],
                "sub_box_label": sb["sub_box_label"],
                "start_x": sb["start_x"],
                "end_x": sb["end_x"],
                "upper": sb["upper"],
                "lower": sb["lower"],
                "duration": sb["duration"],
                "range_pct": sb["range_pct"],
                "is_completed": sb["is_completed"]
            }
            all_subboxes.append(row)
            
    log.info(f"Generated {len(all_subboxes)} sub-boxes in total.")
    sync_subboxes_to_supabase(all_subboxes)

if __name__ == "__main__":
    main()
