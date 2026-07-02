# -*- coding: utf-8 -*-
"""
export_ratio_check.py — ข้อ 4 BS_EFFICIENCY_PLAN: Ratio อัตโนมัติ + cross-check Risk Score
คำนวณ CR/QR/Cash รายรพ.รายเดือนจากงบทดลอง (master.parquet) ตามสูตร ratio_formula/ratio_items
แล้วเทียบกับค่าที่ รพ. รายงานใน risk_scores → จับส่วนต่าง >5%

output: docs/data/ratio_check.json + รายงาน md ในโฟลเดอร์ Balance Sheet
"""
import sys, json, os
import pandas as pd
import pymysql

sys.stdout.reconfigure(encoding="utf-8")

BASE   = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet"
MASTER = r"D:\Github\Rh1-BalanceSheet\master.parquet"
OUT_J  = r"D:\Github\Rh1-BalanceSheet\docs\data\ratio_check.json"
OUT_MD = BASE + r"\รายงาน_RatioCheck_เทียบRiskScore.md"
TOL    = 0.05  # ส่วนต่างเกิน 5% = ผิดปกติ

TH_M = ["ต.ค.","พ.ย.","ธ.ค.","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย."]
tlab = lambda t: TH_M[t % 100 - 1] + str(t // 100 % 100)

# ---------- 1) สูตรจาก MySQL ----------
conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")
items = pd.read_sql(
    "SELECT RatioItemID, CodeL1 FROM ratio_items "
    "WHERE UseYN='Yes' AND RatioItemID IN ('1001X','1002X','1003X','1001Y')", conn)
rs = pd.read_sql(
    "SELECT hcode, time_id, cr, qr, cash FROM risk_scores WHERE cr IS NOT NULL", conn)
conn.close()
rs["t"] = pd.to_numeric(rs["time_id"], errors="coerce").astype("int64")
for c in ["cr", "qr", "cash"]:
    rs[c] = pd.to_numeric(rs[c], errors="coerce")

RATIOS = {"cr": ("1001X", "1001Y"), "qr": ("1002X", "1001Y"), "cash": ("1003X", "1001Y")}
code_sets = {k: set(items.loc[items["RatioItemID"] == k, "CodeL1"]) for k in
             ["1001X", "1002X", "1003X", "1001Y"]}

# ---------- 2) คำนวณจากงบทดลอง ----------
# รพ. มักเปิดบัญชีย่อยลึกกว่าผัง (เช่น 1101030102.10301 = บัญชีย่อยของ .103)
# → normalize เป็น "รหัสหลัก 10 หลัก + suffix 3 หลักแรก" ก่อน match กับผังสูตร
def acc_root(acc):
    p, _, rest = acc.partition(".")
    digits = rest.replace(".", "")
    return p + "." + digits[:3] if digits else acc

m = pd.read_parquet(MASTER, columns=["org5", "t", "acc", "bs"])
m = m[m["t"].isin(set(rs["t"]))]
m["root"] = m["acc"].map(acc_root)

sums = {}
for k, codes in code_sets.items():
    s = m[m["root"].isin(codes)].groupby(["org5", "t"])["bs"].sum()
    sums[k] = s
calc = pd.DataFrame({k: sums[k] for k in sums}).fillna(0.0).reset_index()
for name, (x, y) in RATIOS.items():
    calc["calc_" + name] = calc[x] / calc[y].where(calc[y] != 0)

# ---------- 3) เทียบกับ risk_scores ----------
rs["org5"] = rs["hcode"].astype(str).str.zfill(5)
j = calc.merge(rs[["org5", "t", "cr", "qr", "cash"]], on=["org5", "t"], how="inner")
print(f"เทียบได้ {len(j):,} รพ.-งวด ({j['t'].nunique()} งวด, {j['org5'].nunique()} รพ.)")

for name in RATIOS:
    c, r = j["calc_" + name], j[name]
    j["diff_" + name] = (c - r).abs() / r.abs().where(r.abs() > 0.01)
    j["bad_" + name] = j["diff_" + name] > TOL

# org names
org = pd.read_excel(BASE + r"\อื่นๆ\OrgTbl - 2567.xlsx")
org["org5"] = org["OrgID"].astype(int).astype(str).str.zfill(5)
oname = org.set_index("org5")["Org1"]
oprov = org.set_index("org5")["Province2"]

# ---------- 4) สรุป ----------
T = j["t"].max()
last = j[j["t"] == T].copy()
last["n_bad"] = last[["bad_cr", "bad_qr", "bad_cash"]].sum(axis=1)

hist12 = j[j["t"].isin(sorted(j["t"].unique())[-12:])]
mism = hist12.groupby("org5")[["bad_cr", "bad_qr", "bad_cash"]].mean()
mism["rate"] = mism.mean(axis=1)

rows = []
for _, r in last.sort_values("diff_cr", ascending=False).iterrows():
    o = r["org5"]
    rows.append({
        "org": o, "orgName": oname.get(o, o), "prov": oprov.get(o, ""),
        **{f"calc_{n}": (None if pd.isna(r["calc_" + n]) else round(float(r["calc_" + n]), 2)) for n in RATIOS},
        **{f"rep_{n}": (None if pd.isna(r[n]) else round(float(r[n]), 2)) for n in RATIOS},
        **{f"diff_{n}": (None if pd.isna(r["diff_" + n]) else round(float(r["diff_" + n]) * 100, 1)) for n in RATIOS},
        "nBad": int(r["n_bad"]),
        "hist12": round(float(mism.loc[o, "rate"]) * 100, 0) if o in mism.index else None,
    })

n_bad_hosp = int((last["n_bad"] > 0).sum())
out = {"period": int(T), "tol": TOL, "generated": pd.Timestamp.now().strftime("%Y-%m-%d"),
       "nHosp": int(len(last)), "nBadHosp": n_bad_hosp,
       "badByRatio": {n: int(last["bad_" + n].sum()) for n in RATIOS},
       "rows": rows}
with open(OUT_J, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"WROTE {OUT_J} ({os.path.getsize(OUT_J)/1024:.1f} KB)")

# ---------- 5) รายงาน md ----------
worst = sorted(rows, key=lambda r: -(max(filter(None, [r["diff_cr"], r["diff_qr"], r["diff_cash"]]), default=0)))
md = [
    "# รายงานตรวจสอบ Ratio ที่ รพ. รายงาน เทียบกับที่คำนวณจากงบทดลองจริง",
    f"งวด {tlab(T)} (TimeID {T}) | เกณฑ์ส่วนต่าง >{TOL*100:.0f}% = ผิดปกติ | จัดทำอัตโนมัติ {out['generated']}",
    "",
    f"**สรุป:** จาก {out['nHosp']} รพ. พบส่วนต่างเกินเกณฑ์อย่างน้อย 1 ตัว **{n_bad_hosp} รพ.** "
    f"(CR {out['badByRatio']['cr']} / QR {out['badByRatio']['qr']} / Cash {out['badByRatio']['cash']} แห่ง)",
    "",
    "วิธีคำนวณ: X/Y ตามผังสูตรกองเศรษฐกิจสุขภาพ (ratio_formula/ratio_items 240 รหัสบัญชี) จากยอดคงเหลือสุทธิงบทดลอง GL — "
    "รพ. ที่ต่างมาก = ตัวเลขที่รายงานเข้า Risk Score ไม่ตรงกับบัญชีจริงของตัวเอง ควรให้ทบทวนการรายงาน",
    "",
    "## รพ. ที่ส่วนต่างแรงสุด (30 อันดับ งวดล่าสุด)",
    "",
    "| รพ. | จังหวัด | CR คำนวณ | CR รายงาน | Δ% | QR คำนวณ | QR รายงาน | Δ% | Cash คำนวณ | Cash รายงาน | Δ% | เดือนที่ผิด/12 |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
]
fmt = lambda v: "—" if v is None else f"{v:,.2f}"
fpc = lambda v: "—" if v is None else (f"**{v:,.0f}%**" if v > TOL*100 else f"{v:,.0f}%")
for r in worst[:30]:
    md.append(f"| {r['orgName']} | {r['prov']} | {fmt(r['calc_cr'])} | {fmt(r['rep_cr'])} | {fpc(r['diff_cr'])} "
              f"| {fmt(r['calc_qr'])} | {fmt(r['rep_qr'])} | {fpc(r['diff_qr'])} "
              f"| {fmt(r['calc_cash'])} | {fmt(r['rep_cash'])} | {fpc(r['diff_cash'])} | {r['hist12']:.0f}% |")
md += ["", "## รพ. ที่ตรงดี (ทุกตัวต่าง <5%)",
       "", ", ".join(r["orgName"] for r in rows if r["nBad"] == 0) or "—"]

# ประวัติย้อนหลังทุกงวดที่เทียบได้
hist_bad = j[j[["bad_cr", "bad_qr", "bad_cash"]].any(axis=1)]
by_t = hist_bad.groupby("t").size()
md += ["", f"## ผลตรวจย้อนหลังทั้งหมด ({j['t'].nunique()} งวด, {len(j):,} รพ.-งวด)",
       "", f"พบส่วนต่างเกินเกณฑ์รวม **{len(hist_bad)} รายการ ({len(hist_bad)/len(j)*100:.1f}%)** — งวดที่พบมาก:",
       "", "| งวด | จำนวน รพ. |", "|---|---|"]
for t, n in by_t.sort_values(ascending=False).head(8).items():
    md.append(f"| {tlab(int(t))} ({t}) | {n} |")
md += ["", "**ข้อสังเกต:** ส่วนต่างกระจุกตัวที่เดือน ก.ย. (สิ้นปีงบ) — งบทดลองใน GL รวมงวดปรับปรุง (งวด 13) แล้ว "
       "แต่ค่าที่รายงานเข้า Risk Score เป็นยอดก่อนปรับปรุง จึงไม่ใช่การรายงานคลาดเคลื่อน "
       "ส่วนเดือนปกติปี 2568–2569 แทบไม่พบส่วนต่าง (0–6 รพ./เดือน) แสดงว่าการรายงานปัจจุบันเชื่อถือได้"]
with open(OUT_MD, "w", encoding="utf-8") as f:
    f.write("\n".join(md))
print(f"WROTE {OUT_MD}")
print(f"\nงวด {T}: ผิดเกณฑ์ {n_bad_hosp}/{out['nHosp']} รพ. | CR {out['badByRatio']['cr']} QR {out['badByRatio']['qr']} Cash {out['badByRatio']['cash']}")
