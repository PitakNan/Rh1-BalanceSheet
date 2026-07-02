# -*- coding: utf-8 -*-
"""
export_anomaly.py — สแกนหาความผิดปกติในงบทดลองงวดล่าสุด → docs/data/anomaly.json
รันต่อจาก export_json.py ใน update.bat (ข้อ 2 ของ BS_EFFICIENCY_PLAN.md)

กติกา 3 ชุด:
  A) SPIKE  — Budget Group × รพ.: |เคลื่อนไหวสุทธิ (inc+dec) งวดล่าสุด| > mean+3SD ของตัวเอง
              ย้อนหลัง 24 งวด และ |net| > 1 ลบ.
  B) NEGATIVE — GF × รพ.: ยอดคงเหลือ (bs) ติดลบในหมวดที่ไม่ควรติดลบ
              (สินทรัพย์/หนี้สิน) และ |bs| > 100,000 บาท
  C) OUTLIER — Budget Group × รพ.: bs งวดล่าสุด เป็น outlier เทียบ รพ. ประเภทเดียวกัน
              (|z| > 3 ภายในกลุ่มประเภท และมูลค่า > 5 ลบ.)
"""
import sys, io, json
import pandas as pd
import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet"
MASTER = r"D:\Github\Rh1-BalanceSheet\master.parquet"
OUT = r"D:\Github\Rh1-BalanceSheet\docs\data\anomaly.json"

m = pd.read_parquet(MASTER, columns=[
    "org5", "t", "bs", "inc", "dec",
    "GF_Name", "Budget_Name", "AccGroup_Name"])

org = pd.read_excel(BASE + r"\อื่นๆ\OrgTbl - 2567.xlsx")
org["org5"] = org["OrgID"].astype(int).astype(str).str.zfill(5)
name_col = "Org1"
type_col = "OrgT" if "OrgT" in org.columns else name_col
prov_col = "Province2"
org_map = org.set_index("org5")[[name_col, type_col, prov_col]]
org_map.columns = ["name", "otype", "prov"]

periods = sorted(m["t"].unique())
T = periods[-1]
hist_ts = [t for t in periods if t < T][-24:]
print(f"งวดล่าสุด: {T} | ฐานเปรียบเทียบ {len(hist_ts)} งวด [{hist_ts[0]}..{hist_ts[-1]}]")

items = []

# ---------- A) SPIKE: Budget × org ----------
bg = m.groupby(["Budget_Name", "org5", "t"], as_index=False).agg(
    net=("inc", "sum"), dec=("dec", "sum"), bs=("bs", "sum"))
bg["net"] = bg["net"] + bg["dec"]  # inc + dec = เคลื่อนไหวสุทธิ
cur = bg[bg["t"] == T].set_index(["Budget_Name", "org5"])
hist = bg[bg["t"].isin(hist_ts)]
stat = hist.groupby(["Budget_Name", "org5"])["net"].agg(["mean", "std", "count"])
stat = stat[stat["count"] >= 12]  # ต้องมีประวัติพอ
j = cur.join(stat, how="inner")
j["dev"] = (j["net"] - j["mean"]).abs()
j["thr"] = 3 * j["std"].replace(0, np.nan)
spikes = j[(j["dev"] > j["thr"]) & (j["net"].abs() > 1_000_000)].reset_index()
spikes["sev"] = (spikes["dev"] / spikes["thr"]).round(1)
spikes = spikes.sort_values("sev", ascending=False).head(40)
for _, r in spikes.iterrows():
    o = org_map.loc[r["org5"]] if r["org5"] in org_map.index else None
    items.append({
        "type": "spike", "grp": r["Budget_Name"], "org": r["org5"],
        "orgName": (o["name"] if o is not None else r["org5"]),
        "prov": (o["prov"] if o is not None else ""),
        "val": round(r["net"]), "base": round(r["mean"]), "sev": float(r["sev"]),
        "msg": f"เคลื่อนไหวงวดนี้ {r['net']/1e6:,.1f} ลบ. เทียบค่าปกติ {r['mean']/1e6:,.1f} ลบ. (แรงกว่าเกณฑ์ {r['sev']:.1f} เท่า)"})
print(f"A) SPIKE: {len(spikes)} รายการ")

# ---------- B) NEGATIVE: GF × org (สินทรัพย์/หนี้สิน ติดลบ) ----------
gf = m[(m["t"] == T) & (m["AccGroup_Name"].isin(["สินทรัพย์", "หนี้สิน"]))]
gf = gf.groupby(["AccGroup_Name", "GF_Name", "org5"], as_index=False)["bs"].sum()
neg = gf[(gf["bs"] < -100_000)].copy()
neg["sev"] = (neg["bs"].abs() / 1e6).round(1)
neg = neg.sort_values("bs").head(40)
for _, r in neg.iterrows():
    o = org_map.loc[r["org5"]] if r["org5"] in org_map.index else None
    items.append({
        "type": "negative", "grp": r["GF_Name"], "org": r["org5"],
        "orgName": (o["name"] if o is not None else r["org5"]),
        "prov": (o["prov"] if o is not None else ""),
        "val": round(r["bs"]), "base": 0, "sev": float(r["sev"]),
        "msg": f"{r['AccGroup_Name']}คงเหลือติดลบ {r['bs']/1e6:,.2f} ลบ. — ผิดธรรมชาติบัญชี ควรตรวจการบันทึก"})
print(f"B) NEGATIVE: {len(neg)} รายการ")

# ---------- C) OUTLIER: bs เทียบ รพ. ประเภทเดียวกัน ----------
cur_bs = bg[bg["t"] == T].merge(org_map.reset_index(), on="org5", how="left")
outs = []
for (grp, ot), sub in cur_bs.groupby(["Budget_Name", "otype"]):
    if len(sub) < 8:
        continue
    mu, sd = sub["bs"].mean(), sub["bs"].std()
    if not sd or sd == 0:
        continue
    z = (sub["bs"] - mu) / sd
    pick = sub[(z.abs() > 3) & (sub["bs"].abs() > 5_000_000)]
    for i, r in pick.iterrows():
        outs.append({
            "type": "outlier", "grp": grp, "org": r["org5"],
            "orgName": r["name"], "prov": r["prov"] or "",
            "val": round(r["bs"]), "base": round(mu), "sev": round(abs(float(z[i])), 1),
            "msg": f"ยอดคงเหลือ {r['bs']/1e6:,.1f} ลบ. ห่างค่าเฉลี่ยกลุ่ม {ot} ({mu/1e6:,.1f} ลบ.) {abs(z[i]):.1f} SD"})
outs = sorted(outs, key=lambda x: -x["sev"])[:40]
items.extend(outs)
print(f"C) OUTLIER: {len(outs)} รายการ")

out = {"period": int(T), "generated": pd.Timestamp.now().strftime("%Y-%m-%d"),
       "counts": {"spike": len(spikes), "negative": len(neg), "outlier": len(outs)},
       "items": items}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
import os
print(f"\nWROTE {OUT} ({os.path.getsize(OUT)/1024:.1f} KB) รวม {len(items)} รายการ")
