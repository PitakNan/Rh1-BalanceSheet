# -*- coding: utf-8 -*-
"""ทดสอบ: ตัวเลขใน JSON ตรงกับ master.parquet และตรงกับตรรกะที่ Dashboard ใช้"""
import json
import sys
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")
REPO = r"D:\Github\Rh1-BalanceSheet"
m = pd.read_parquet(REPO + r"\master.parquet")
meta = json.load(open(REPO + r"\docs\data\meta.json", encoding="utf-8"))
region = json.load(open(REPO + r"\docs\data\region_gf.json", encoding="utf-8"))
prov = json.load(open(REPO + r"\docs\data\prov_gf.json", encoding="utf-8"))

groups = meta["groups"]
ok = True

def check(name, a, b):
    global ok
    d = abs(a - b)
    good = d <= max(1, abs(b) * 1e-9) * len(groups)  # ปัดเศษจำนวนเต็มสะสม
    print(f"{'✅' if good else '❌'} {name}: JSON={a:,.0f} | parquet={b:,.0f} | Δ={d:,.0f}")
    ok = ok and good

# 1) เจ้าหนี้การค้า+อื่นๆ ในหมวดหนี้สิน ณ งวดล่าสุด — เทียบ region_gf vs parquet
t_last = max(meta["periods"])
liab_gf = {g["gfId"] for g in groups if g["accg"] == "หนี้สิน"}
js = sum(r[2] for r in region if r[0] in liab_gf and r[1] == t_last)
pq = m[(m["AccGroup_Name"] == "หนี้สิน") & (m["t"] == t_last)]["bs"].sum()
check(f"หนี้สินรวมเขต งวด {t_last}", js, pq)

# 2) สินทรัพย์รวมเขต งวดเก่าสุด
t0 = min(meta["periods"])
ast_gf = {g["gfId"] for g in groups if g["accg"] == "สินทรัพย์"}
js = sum(r[2] for r in region if r[0] in ast_gf and r[1] == t0)
pq = m[(m["AccGroup_Name"] == "สินทรัพย์") & (m["t"] == t0)]["bs"].sum()
check(f"สินทรัพย์รวมเขต งวด {t0}", js, pq)

# 3) จังหวัดเชียงใหม่ หนี้สิน งวดล่าสุด
js = sum(r[2] for r in prov.get("เชียงใหม่", []) if r[0] in liab_gf and r[1] == t_last)
pq = m[(m["AccGroup_Name"] == "หนี้สิน") & (m["t"] == t_last) & (
    m["org5"].isin([o["id"] for o in meta["orgs"] if o["prov"] == "เชียงใหม่"]))]["bs"].sum()
check(f"หนี้สิน เชียงใหม่ งวด {t_last}", js, pq)

# 4) inc/dec รวมเขต หมวดหนี้สิน 12 งวดล่าสุด
ts = sorted(meta["periods"])[-12:]
js_inc = sum(r[3] for r in region if r[0] in liab_gf and r[1] in ts)
pq_inc = m[(m["AccGroup_Name"] == "หนี้สิน") & (m["t"].isin(ts))]["inc"].sum()
check("inc หนี้สิน 12 งวดล่าสุด", js_inc, pq_inc)

# 5) งวดทั้งหมด + ธง
print(f"\nงวด: {len(meta['periods'])} ({min(meta['periods'])}–{max(meta['periods'])})")
print(f"ธง ⚠ งวดข้อมูลอาจไม่ครบ: {len(meta['flagged'])} งวด: {meta['flagged'][:5]}...{meta['flagged'][-3:]}")
print(f"กลุ่ม GF: {len(groups)} | รพ.: {len(meta['orgs'])}")
print("\n" + ("🎉 ผ่านทุกข้อ" if ok else "❌ มีข้อไม่ผ่าน — ห้าม deploy"))
sys.exit(0 if ok else 1)
