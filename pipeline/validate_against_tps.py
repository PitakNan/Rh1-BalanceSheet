# -*- coding: utf-8 -*-
"""
validate_against_tps.py — เทียบ CR/QR/Cash/ACP(UC/CSMBS/SSS)/InvDays ของ risk_drill.html
กับข้อมูล TPS (Total Performance Score, สำนักปลัด สธ.) เพื่อตรวจสอบว่าสูตรที่คำนวณเอง
(export_risk_link.py) ใกล้เคียงกับแหล่งอ้างอิงอิสระแค่ไหน — ไม่ใช่แหล่งข้อมูลหลัก
(TPS อัพเดตรายไตรมาส รอไม่ได้สำหรับ dashboard รายเดือน) ใช้เป็นเครื่องมือ QA เท่านั้น

วิธีใช้:
  1. ดาวน์โหลด/อัพเดต TPS export ใหม่ทับไฟล์เดิมที่ TPS_PATH (หรือแก้ path ด้วย --tps <path>)
  2. รันสคริปต์นี้หลัง export_risk_link.py ทุกครั้งที่แก้สูตร 7 Plus Efficiency Score
     หรือเมื่อได้ไฟล์ TPS export ใหม่ — ไม่ต้องรอ/พึ่ง TPS เป็น dependency ของ pipeline หลัก
  3. อ่านผลสรุป median/mean/ratio ต่อกองทุน + รายชื่อ รพ. ที่ต่างเกินเกณฑ์ (|ratio-1|>0.5) ไปตรวจมือ

output: พิมพ์สรุปออก stdout เท่านั้น ไม่เขียนไฟล์ (เป็นเครื่องมือ diagnostic ไม่ใช่ pipeline step)
"""
import sys
import json
import glob
import os
import argparse
import statistics

REPO = r"D:\Github\Rh1-BalanceSheet"
H_DIR = os.path.join(REPO, "docs", "data", "risk", "h")
TPS_PATH_DEFAULT = r"D:\Github\Rh1-TPS-V.3.1\public\data\financial_ratios.json"

FUNDS = [
    ("acpUc", "ratio_acp_uc", "ACP UC (บัตรทอง)"),
    ("acpCs", "ratio_acp_cs", "ACP CSMBS (กรมบัญชีกลาง)"),
    ("acpSs", "ratio_acp_sss", "ACP SSS (ประกันสังคม)"),
]
RATIO_FIELDS = [("cr", "ratio_cr", "Current Ratio"), ("qr", "ratio_qr", "Quick Ratio"), ("cash", "ratio_cash", "Cash Ratio")]


def sfloat(v):
    try:
        v = float(v)
        return v if v == v else None  # กัน NaN
    except (TypeError, ValueError):
        return None


def quarter_to_t(period_id):
    """'2569Q2' -> 256906 (ไตรมาสสิ้นสุดที่เดือนงบ Q*3: Q1=ม.ค.3, Q2=มี.ค.6, Q3=มิ.ย.9, Q4=ก.ย.12)"""
    year, q = period_id.split("Q")
    return int(year) * 100 + int(q) * 3


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tps", default=TPS_PATH_DEFAULT, help="path ไปยัง TPS financial_ratios.json")
    ap.add_argument("--period", default=None, help="TPS period_id เจาะจง เช่น 2569Q2 (ค่าเริ่มต้น = ล่าสุดที่มีข้อมูล)")
    ap.add_argument("--threshold", type=float, default=0.5, help="แจ้งเตือนถ้า |ratio-1| เกินค่านี้ (ค่าเริ่มต้น 0.5)")
    args = ap.parse_args()

    if not os.path.exists(args.tps):
        print(f"ไม่พบไฟล์ TPS ที่ {args.tps} — ดาวน์โหลด/วางไฟล์ก่อน หรือระบุ --tps <path>")
        sys.exit(1)

    with open(args.tps, encoding="utf-8") as f:
        tps = json.load(f)

    period = args.period or sorted({r["period_id"] for r in tps})[-1]
    t_target = quarter_to_t(period)
    print(f"เทียบกับ TPS period={period} (ของเราคืองวด t={t_target})\n")

    tps_by_hcode = {r["hospital_code"]: r for r in tps if r["period_id"] == period}

    files = sorted(glob.glob(os.path.join(H_DIR, "*.json")))
    ratios = {k: [] for k, _, _ in FUNDS + RATIO_FIELDS}
    outliers = {k: [] for k, _, _ in FUNDS + RATIO_FIELDS}

    for fp in files:
        hcode = os.path.splitext(os.path.basename(fp))[0]
        tp = tps_by_hcode.get(hcode)
        if not tp:
            continue
        with open(fp, encoding="utf-8") as f:
            d = json.load(f)
        row = next((r for r in d["trend"] if r["t"] == t_target), None)
        if not row:
            continue
        for key, tps_key, _ in FUNDS + RATIO_FIELDS:
            ours = row.get(key)
            theirs = sfloat(tp.get(tps_key))
            if ours is None or theirs is None or theirs == 0:
                continue
            r = ours / theirs
            ratios[key].append(r)
            if abs(r - 1) > args.threshold:
                outliers[key].append((hcode, d.get("name", ""), ours, theirs, r))

    print(f"{'ตัวชี้วัด':<28s} {'n':>4s} {'median':>8s} {'mean':>8s} {'std':>8s}")
    for key, _, label in FUNDS + RATIO_FIELDS:
        arr = ratios[key]
        if not arr:
            print(f"{label:<28s}  (ไม่มีข้อมูลเทียบได้)")
            continue
        print(f"{label:<28s} {len(arr):>4d} {statistics.median(arr):>8.2f} "
              f"{statistics.mean(arr):>8.2f} {(statistics.stdev(arr) if len(arr)>1 else 0):>8.2f}")

    print(f"\n=== รพ. ที่ต่างจาก TPS เกิน {args.threshold*100:.0f}% (ควรตรวจมือ) ===")
    for key, _, label in FUNDS + RATIO_FIELDS:
        rows = sorted(outliers[key], key=lambda x: -abs(x[4] - 1))[:10]
        if not rows:
            continue
        print(f"\n-- {label} --")
        for hcode, name, ours, theirs, r in rows:
            print(f"  {hcode} {name[:20]:<20s} เรา={ours:.1f} TPS={theirs:.1f} ratio={r:.2f}")


if __name__ == "__main__":
    main()
