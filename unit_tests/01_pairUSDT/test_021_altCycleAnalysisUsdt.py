import importlib.util
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace

import pandas as pd


PAIRUSDT_ROOT = Path(__file__).resolve().parents[2] / "01_pairUSDT"


def load_script_module(script_name: str):
    module_name = f"test_{script_name.replace('.', '_')}_{uuid.uuid4().hex}"
    script_path = PAIRUSDT_ROOT / script_name
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class MockResponse:
    def __init__(self, data=None, status_code=200):
        self._data = data if data is not None else {}
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._data


def test_021_make_cycle_name():
    module = load_script_module("021_altCycleAnalysisUsdt.py")

    # Current cycle: 2025-01-01 UTC (1735689600000)
    assert (
        module.make_cycle_name(1735689600000, is_current=True)
        == "Current Cycle (2025)"
    )
    # Historic cycle: 2017-12-17 UTC (1513468800000)
    assert module.make_cycle_name(1513468800000, is_current=False) == "Cycle 2017"


def test_021_find_btc_coin_id():
    module = load_script_module("021_altCycleAnalysisUsdt.py")

    coins = [("ethereum", "ETH"), ("bitcoin", "BTC"), ("solana", "SOL")]
    assert module.find_btc_coin_id(coins) == "bitcoin"
    assert module.find_btc_coin_id([("ethereum", "ETH")]) is None


def test_021_build_btc_cycle_templates(monkeypatch):
    module = load_script_module("021_altCycleAnalysisUsdt.py")

    # 1. No peaks found
    monkeypatch.setattr(module, "find_all_peaks", lambda _df, _sym: [])
    empty_df = pd.DataFrame()
    assert module.build_btc_cycle_templates(empty_df) == []

    # 2. Historical peak + current cycle search
    peak1_ts = 1513468800000  # 2017-12-17
    peak1_high = 20000.0
    monkeypatch.setattr(
        module, "find_all_peaks", lambda _df, _sym: [(peak1_ts, peak1_high)]
    )

    current_ts = peak1_ts + module.NEXT_SEARCH_MS + module.ONE_DAY_MS
    btc_df = pd.DataFrame(
        [
            {"timestamp": peak1_ts, "high": 20000.0, "low": 18000.0, "close": 19000.0},
            {
                "timestamp": current_ts,
                "high": 99000.0,
                "low": 95000.0,
                "close": 98000.0,
            },
        ]
    )

    templates = module.build_btc_cycle_templates(btc_df)
    assert len(templates) == 2

    # Cycle 1 (historical)
    assert templates[0]["cycle_number"] == 1
    assert templates[0]["cycle_name"] == "Cycle 2017"
    assert templates[0]["peak_ts"] == peak1_ts
    assert templates[0]["peak_high"] == peak1_high
    assert templates[0]["next_peak_ts"] == current_ts
    assert templates[0]["is_current"] is False

    # Cycle 2 (current)
    assert templates[1]["cycle_number"] == 2
    assert templates[1]["is_current"] is True
    assert templates[1]["next_peak_ts"] is None
    assert templates[1]["peak_high"] == 99000.0


def test_021_calculate_cycle_by_btc_template():
    module = load_script_module("021_altCycleAnalysisUsdt.py")

    peak_ts = 1513468800000  # 2017-12-17
    template = {
        "cycle_number": 1,
        "cycle_name": "Cycle 2017",
        "peak_ts": peak_ts,
        "peak_date": "2017/12/17",
        "peak_high": 20000.0,
        "next_peak_ts": peak_ts + 2 * module.ONE_DAY_MS,
        "is_current": False,
    }

    # Case 1: Alt missing row on peak date -> returns empty
    df_missing = pd.DataFrame(
        [
            {
                "timestamp": peak_ts + module.ONE_DAY_MS,
                "close": 10.0,
                "high": 12.0,
                "low": 9.0,
            }
        ]
    )
    assert module.calculate_cycle_by_btc_template(df_missing, template) == []

    # Case 2: Alt has valid row on peak date and subsequent days
    df_valid = pd.DataFrame(
        [
            {
                "timestamp": peak_ts,
                "close": 100.0,
                "high": 110.0,
                "low": 90.0,
            },
            {
                "timestamp": peak_ts + module.ONE_DAY_MS,
                "close": 150.0,
                "high": 160.0,
                "low": 140.0,
            },
            {
                "timestamp": peak_ts + 2 * module.ONE_DAY_MS,  # next_peak_ts (excluded)
                "close": 200.0,
                "high": 210.0,
                "low": 190.0,
            },
        ]
    )
    records = module.calculate_cycle_by_btc_template(df_valid, template)
    assert len(records) == 2

    assert records[0]["days_since_peak"] == 0
    assert records[0]["close_rate"] == 100.0
    assert records[0]["peak_price"] == 100.0
    assert records[0]["cycle_name"] == "Cycle 2017"

    assert records[1]["days_since_peak"] == 1
    assert records[1]["close_rate"] == 150.0
    assert records[1]["high_rate"] == 160.0
    assert records[1]["low_rate"] == 140.0


def test_021_build_summary_by_btc_templates():
    module = load_script_module("021_altCycleAnalysisUsdt.py")

    peak1_ts = 1513468800000
    peak2_ts = 1636502400000
    templates = [
        {
            "cycle_number": 1,
            "cycle_name": "Cycle 2017",
            "peak_ts": peak1_ts,
            "peak_date": "2017/12/17",
            "next_peak_ts": peak2_ts,
            "is_current": False,
        },
        {
            "cycle_number": 2,
            "cycle_name": "Current Cycle (2021)",
            "peak_ts": peak2_ts,
            "peak_date": "2021/11/10",
            "next_peak_ts": None,
            "is_current": True,
        },
    ]

    df = pd.DataFrame(
        [
            {"timestamp": peak1_ts, "close": 100.0, "high": 100.0, "low": 100.0},
            {
                "timestamp": peak1_ts + module.ONE_DAY_MS,
                "close": 50.0,
                "high": 60.0,
                "low": 40.0,
            },
            {"timestamp": peak2_ts, "close": 200.0, "high": 200.0, "low": 200.0},
        ]
    )

    summaries = module.build_summary_by_btc_templates(df, templates)
    assert len(summaries) == 2

    # Cycle 1 summary
    assert summaries[0]["cycle_number"] == 1
    assert summaries[0]["peak_price"] == 100.0
    assert summaries[0]["low_price"] == 40.0
    assert summaries[0]["low_pct_from_peak"] == -60.0

    # Cycle 2 summary (current)
    assert summaries[1]["cycle_number"] == 2
    assert summaries[1]["peak_price"] == 200.0
    assert summaries[1]["prev_low_price"] == 40.0
    # (200 - 40) / 40 * 100 = 400.0%
    assert summaries[1]["peak_pct_from_low"] == 400.0
    assert summaries[1]["low_price"] is None  # is_current is True


def test_021_post_rows_supabase(monkeypatch):
    module = load_script_module("021_altCycleAnalysisUsdt.py")
    monkeypatch.setattr(
        module,
        "get_supabase_headers",
        lambda: {"apikey": "test-key", "Authorization": "Bearer test-key"},
    )

    calls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
        return MockResponse({})

    monkeypatch.setattr(module.requests, "post", fake_post)
    monkeypatch.setattr(module, "SUPABASE_PAGE_SIZE", 2)

    rows = [{"id": 1}, {"id": 2}, {"id": 3}]
    module.post_rows_supabase("alt_cycle_data", rows)

    assert len(calls) == 2
    assert calls[0]["url"] == f"{module.SUPABASE_URL}/rest/v1/alt_cycle_data"
    assert calls[0]["headers"]["Prefer"] == "return=minimal"
    assert calls[0]["headers"]["Content-Type"] == "application/json"
    assert calls[0]["json"] == [{"id": 1}, {"id": 2}]
    assert calls[1]["json"] == [{"id": 3}]


def test_021_save_summary_supabase(monkeypatch):
    module = load_script_module("021_altCycleAnalysisUsdt.py")
    deleted = []
    posted = []

    monkeypatch.setattr(
        module, "delete_by_coin_supabase", lambda tbl, cid: deleted.append((tbl, cid))
    )
    monkeypatch.setattr(
        module, "post_rows_supabase", lambda tbl, rows: posted.append((tbl, rows))
    )

    # Empty summaries
    assert module.save_summary_supabase("bitcoin", []) == 0
    assert deleted == [("alt_cycle_summary", "bitcoin")]
    assert posted == []

    # Non-empty summaries
    deleted.clear()
    summaries = [
        {
            "cycle_number": 1,
            "cycle_name": "Cycle 2021",
            "peak_date": "2021/11/10",
            "peak_price": 69000.0,
            "peak_pct_from_low": 300.0,
            "low_date": "2022/11/21",
            "low_price": 15500.0,
            "low_pct_from_peak": -77.5,
            "prev_peak_date": "2017/12/17",
            "prev_peak_price": 20000.0,
            "prev_low_date": "2018/12/15",
            "prev_low_price": 3100.0,
        }
    ]
    saved_count = module.save_summary_supabase("bitcoin", summaries)
    assert saved_count == 1
    assert deleted == [("alt_cycle_summary", "bitcoin")]
    assert len(posted) == 1
    assert posted[0][0] == "alt_cycle_summary"
    payload_item = posted[0][1][0]
    assert payload_item["coin_id"] == "bitcoin"
    assert payload_item["peak_date"] == "2021-11-10"
    assert payload_item["low_date"] == "2022-11-21"
    assert payload_item["prev_peak_date"] == "2017-12-17"


def test_021_save_cycle_data_supabase(monkeypatch):
    module = load_script_module("021_altCycleAnalysisUsdt.py")
    deleted = []
    posted = []

    monkeypatch.setattr(
        module, "delete_by_coin_supabase", lambda tbl, cid: deleted.append((tbl, cid))
    )
    monkeypatch.setattr(
        module, "post_rows_supabase", lambda tbl, rows: posted.append((tbl, rows))
    )

    records = [
        {
            "cycle_number": 1,
            "cycle_name": "Cycle 2021",
            "days_since_peak": 0,
            "timestamp": "2021/11/10",
            "close_price": 69000.0,
            "low_price": 68000.0,
            "high_price": 70000.0,
            "close_rate": 100.0,
            "low_rate": 98.5,
            "high_rate": 101.4,
            "peak_date": "2021/11/10",
            "peak_price": 69000.0,
        }
    ]

    saved_count = module.save_cycle_data_supabase("bitcoin", records)
    assert saved_count == 1
    assert deleted == [("alt_cycle_data", "bitcoin")]
    assert len(posted) == 1
    assert posted[0][0] == "alt_cycle_data"
    assert posted[0][1][0]["timestamp"] == "2021-11-10T00:00:00+00:00"
    assert posted[0][1][0]["peak_date"] == "2021-11-10"


def test_021_main_skips_short_history_without_saving(monkeypatch):
    module = load_script_module("021_altCycleAnalysisUsdt.py")

    short_df = pd.DataFrame(
        {
            "date": ["2026-01-01", "2026-01-02"],
            "timestamp": [1, 2],
            "high": [10.0, 11.0],
            "low": [9.0, 10.0],
            "close": [9.5, 10.5],
        }
    )

    monkeypatch.setattr(module, "get_coins_supabase", lambda: [("bitcoin", "BTC")])
    monkeypatch.setattr(module, "load_ohlcv_supabase", lambda _coin_id: short_df)
    monkeypatch.setattr(
        module,
        "save_cycle_data_supabase",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("should not save cycles")
        ),
    )
    monkeypatch.setattr(
        module,
        "save_summary_supabase",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("should not save summary")
        ),
    )
    monkeypatch.setattr(module, "print_summary_supabase", lambda: None)

    module.main()
