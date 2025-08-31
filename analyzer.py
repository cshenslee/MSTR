#!/usr/bin/env python3
import json, datetime, math, os
from pathlib import Path

DATA_PATH = Path("data.json")

def usd(n):
    try:
        return f"${int(round(n,0)):,}"
    except:
        return str(n)

def pct(n):
    try:
        return f"{n:.0f}%"
    except:
        return str(n)

def load_json():
    if not DATA_PATH.exists():
        raise SystemExit("data.json not found")
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(obj):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")

def safe_get(d, *keys, default=None):
    cur = d
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur

def decide_trade_rec(d):
    now_pt = datetime.datetime.utcnow()  # timestamp stored as UTC; UI shows PT
    # --- Pull key signals with fallbacks
    btc = float(safe_get(d, "raw_data", "current_btc_price", default=0) or 0)
    mstr = float(safe_get(d, "raw_data", "current_mstr_price", default=0) or 0)

    # Supports / resistances (defaults from your dashboard text)
    btc_s1_lo = float(safe_get(d, "technical", "btc_support_near_lo", default=108000) or 108000)
    btc_s1_hi = float(safe_get(d, "technical", "btc_support_near_hi", default=110000) or 110000)
    btc_s2_lo = float(safe_get(d, "technical", "btc_support_mid_lo", default=104000) or 104000)
    btc_r1_lo = float(safe_get(d, "technical", "btc_resist_near_lo", default=112000) or 112000)

    mstr_s1_lo = float(safe_get(d, "technical", "mstr_support_near_lo", default=330) or 330)
    mstr_s1_hi = float(safe_get(d, "technical", "mstr_support_near_hi", default=340) or 340)
    mstr_r1_lo = float(safe_get(d, "technical", "mstr_resist_near_lo", default=350) or 350)
    mstr_r1_hi = float(safe_get(d, "technical", "mstr_resist_near_hi", default=365) or 365)

    # Flows, DXY, funding (boolean-ish reads)
    etf_flow = (safe_get(d, "market", "etf_flows", default="") or "").lower()  # e.g., "4-day inflow"
    flows_green = ("inflow" in etf_flow) or ("+" in etf_flow)

    dxy = float((safe_get(d, "market", "dxy", default=98.2) or 98.2))
    dxy_supportive = dxy < 100

    funding_txt = (safe_get(d, "leverage", "funding", default="slightly positive") or "").lower()
    funding_hot = "0.1" in funding_txt or "0.10" in funding_txt or "elevated" in funding_txt

    # Options skew (look for call ladders / >$400 lanes)
    options_bullish = False
    options = safe_get(d, "options", default=[])
    if isinstance(options, list):
        for row in options:
            call_zone = (row or {}).get("call_oi_zones","")
            if any(k in str(call_zone) for k in ["$400", "420", "450"]):
                options_bullish = True
                break

    # Catalyst window (Sep 5–19 style); if a near/mid catalyst within 21d -> bias bullish
    catalyst_bias = False
    cat_rows = safe_get(d, "catalysts", "timeline", default=[])
    if isinstance(cat_rows, list):
        for r in cat_rows:
            prob = (r.get("prob","") or "").lower()
            if any(p in prob for p in ["high","65","70","80","90"]):
                catalyst_bias = True
                break

    # --- Decision rules
    core_position = "Hold"
    tacticals = "Balanced: let levels drive adds/reductions."
    add_on_strength = ""
    add_on_support = ""
    btc_strategy = ""
    options_line = ""
    risk = ""
    targets = ""

    # Strength condition
    strength = (btc >= btc_s1_hi and mstr >= mstr_s1_lo)
    # Weak condition
    weak = (btc < btc_s1_lo or mstr < mstr_s1_lo)

    if strength and (flows_green or dxy_supportive or options_bullish or catalyst_bias):
        core_position = "Hold / Add (small)"
        tacticals = f"No chase into resistance; prefer adds on reclaim + hold above {usd(btc_s1_hi)} (BTC) and {usd(mstr_s1_lo)} (MSTR)."
        add_on_strength = f"Add if BTC holds > {usd(btc_s1_hi)} and MSTR holds {usd(mstr_s1_lo)}–{usd(mstr_r1_lo)}."
        btc_strategy = f"Stage toward {usd(btc_r1_lo)} then {usd(btc_r1_lo+6000)} if momentum persists."
    elif weak:
        core_position = "Hold (reduced tacticals)"
        tacticals = f"Avoid chasing; reduce adds while BTC < {usd(btc_s1_lo)} or MSTR < {usd(mstr_s1_lo)}."
        add_on_support = f"Look for stabilization near {usd(mstr_s1_lo)}–{usd(mstr_s1_hi)} / BTC {usd(btc_s1_lo)}–{usd(btc_s1_hi)} before adding."
        btc_strategy = f"Ladder buys closer to {usd(btc_s2_lo)} only if flows improve."
    else:
        core_position = "Hold"
        tacticals = "No chase; wait for clean reclaim of strength thresholds."
        add_on_strength = f"BTC > {usd(btc_s1_hi)} + MSTR > {usd(mstr_s1_lo)}."
        add_on_support = f"Add on stabilization at {usd(mstr_s1_lo)}–{usd(mstr_s1_hi)}."

    # Options
    if options_bullish and not funding_hot:
        options_line = f"Calls post-reclaim of {usd(btc_r1_lo)} (BTC) / {usd(mstr_r1_lo)} (MSTR)."
    elif funding_hot:
        options_line = "Avoid leverage until funding cools."

    # Risk
    risk = f"Risk-off if BTC < {usd(btc_s1_lo)} daily close or MSTR < {usd(mstr_s1_lo)} daily close."

    # Targets (simple banding)
    btc_t1 = max(btc_r1_lo, btc_s1_hi + 4000)
    btc_t2 = btc_t1 + 4000
    m_t1 = (mstr_r1_lo + mstr_r1_hi)//2 if mstr_r1_hi>0 else mstr_r1_lo+10
    m_t2 = m_t1 + 30
    targets = f"BTC: {usd(btc_r1_lo)} → {usd(btc_t1)}–{usd(btc_t2)}; MSTR: {usd(mstr_r1_lo)}–{usd(mstr_r1_hi)} → {usd(m_t1)}–{usd(m_t2)}."

    return {
        "generated_at_utc": now_pt.strftime("%Y-%m-%d %H:%M:%S"),
        "core_position": core_position,
        "tacticals": tacticals,
        "add_on_strength": add_on_strength,
        "add_on_support": add_on_support,
        "btc_strategy": btc_strategy,
        "options": options_line,
        "risk_management": risk,
        "targets": targets
    }

def main():
    data = load_json()
    data.setdefault("trade_recommendation", {})
    data["trade_recommendation"] = decide_trade_rec(data)
    # Touch summary for UI if you want to show timestamp
    data.setdefault("meta", {})
    data["meta"]["trade_rec_last_generated"] = data["trade_recommendation"]["generated_at_utc"]
    save_json(data)
    print("Updated trade_recommendation ✔")

if __name__ == "__main__":
    main()
