# -*- coding: utf-8 -*-
"""
export_leaf13.py — บัญชี 13 หลัก (10 หลักหน้าจุด + 3 หลักหลังจุด) รวมทั้งเขต
ต่างจาก export_leaf.py (แยกรายหน่วยบริการ, ทุกความยาวเลขหลังจุด):
ที่นี่กรองเฉพาะรหัสที่มีเลขหลังจุด "ตรง 3 หลัก" เท่านั้น (~90% ของบัญชีย่อยทั้งหมด)
แล้วรวมยอดข้ามหน่วยบริการทั้งเขต เพราะรหัส 13 หลักระดับนี้ใช้ pattern เดียวกันพอสมควรระหว่าง รพ.
- docs/data/code13_list.json : [[code13, gfId], ...] (สำหรับค้นหาในหน้า Explorer)
- docs/data/code13_region/b<bId>.json : { "<code13>": [[t,bs,inc,dec,endDr,endCr], ...] }
gfId/bId ใช้ตัวเลขเดียวกับ meta.json/export_acc.py — group ด้วยชุดคอลัมน์เดียวกัน เรียงลำดับเดียวกัน
"""
import sys, json, os, re
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

REPO = r"D:\Github\Rh1-BalanceSheet"
DATA = os.path.join(REPO, "docs", "data")
OUT_DIR = os.path.join(DATA, "code13_region")
os.makedirs(OUT_DIR, exist_ok=True)

m = pd.read_parquet(os.path.join(REPO, "master.parquet"))

# กรองเฉพาะรหัส 13 หลัก: 10 หลัก.3 หลัก
m = m[m["acc"].str.match(r"^\d{10}\.\d{3}$", na=False)].copy()

# gfId/bId — ต้องสร้างเหมือน export_json.py/export_acc.py เป๊ะ (ลำดับ sort เดียวกัน)
full = pd.read_parquet(os.path.join(REPO, "master.parquet"))
gdef = (
    full.groupby(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name", "Budget_Name", "GF_Name"])
    .size().reset_index().drop(columns=0)
    .sort_values(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name", "Budget_Name", "GF_Name"])
    .reset_index(drop=True)
)
gdef["gfId"] = gdef.index
gdef["bId"] = gdef.groupby(["Budget_Name"], sort=False).ngroup()
gf_key = dict(zip(gdef["GF_Name"] + "|" + gdef["Budget_Name"], gdef["gfId"]))
m["gfId"] = (m["GF_Name"] + "|" + m["Budget_Name"]).map(gf_key)
m = m.merge(gdef[["gfId", "bId"]], on="gfId")

# ---------- code13_list.json ----------
cl = m[["acc", "gfId"]].drop_duplicates().sort_values(["acc", "gfId"])
rows = [[r.acc, int(r.gfId)] for r in cl.itertuples()]
p = os.path.join(DATA, "code13_list.json")
with open(p, "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
print(f"code13_list.json: {len(rows):,} รายการ (code13×gf) | {os.path.getsize(p)/1024:.0f} KB")

# ---------- code13_region/b<bId>.json ----------
g = m.groupby(["bId", "acc", "t"], as_index=False)[["bs", "inc", "dec", "EndDr", "EndCr"]].sum()
for c in ["bs", "inc", "dec", "EndDr", "EndCr"]:
    g[c] = g[c].round(0).astype("int64")

total = 0
for bid, sub in g.groupby("bId"):
    obj = {}
    for code, ss in sub.groupby("acc"):
        obj[code] = [[int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)]
                     for x in ss.sort_values("t").itertuples()]
    fp = os.path.join(OUT_DIR, f"b{int(bid)}.json")
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    total += os.path.getsize(fp)
print(f"code13_region/: {g['bId'].nunique()} ไฟล์ | code13 {g['acc'].nunique():,} รหัส | รวม {total/1024/1024:.1f} MB")
