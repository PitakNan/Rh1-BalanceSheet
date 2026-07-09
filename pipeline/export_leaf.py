# -*- coding: utf-8 -*-
"""
Phase 2 — บัญชีย่อยที่สุด (leaf, รวมเลขหลังจุด) แยกรายหน่วยบริการ
เหตุผลที่แยกรายหน่วยบริการ ไม่รวมทั้งเขต: เลขหลังจุดส่วนใหญ่เป็นเลขที่แต่ละ รพ. ตั้งเอง
(42% ของบัญชีย่อยที่สุดใช้แค่ รพ.เดียว) รวมข้ามหน่วยบริการจะสับสน
- docs/data/leaf_list.json : { "<org5>": [[fullkey, gfId], ...], ... } (สำหรับค้นหาในหน้า Explorer)
- docs/data/leaf/<org5>.json : { "<fullkey>": [[t,bs,inc,dec,endDr,endCr], ...] }
gfId ใช้ตัวเลขเดียวกับ meta.json (export_json.py) — group ด้วยชุดคอลัมน์เดียวกัน เรียงลำดับเดียวกัน
"""
import sys, json, os
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

REPO = r"D:\Github\Rh1-BalanceSheet"
DATA = os.path.join(REPO, "docs", "data")
LEAF_DIR = os.path.join(DATA, "leaf")
os.makedirs(LEAF_DIR, exist_ok=True)

m = pd.read_parquet(os.path.join(REPO, "master.parquet"))

# gfId — ต้องสร้างเหมือน export_json.py เป๊ะ (ลำดับ sort เดียวกัน)
gdef = (
    m.groupby(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name", "Budget_Name", "GF_Name"])
    .size().reset_index().drop(columns=0)
    .sort_values(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name", "Budget_Name", "GF_Name"])
    .reset_index(drop=True)
)
gdef["gfId"] = gdef.index
gf_key = dict(zip(gdef["GF_Name"] + "|" + gdef["Budget_Name"], gdef["gfId"]))
m["gfId"] = (m["GF_Name"] + "|" + m["Budget_Name"]).map(gf_key)

# ---------- leaf_list.json ----------
ll = m[["org5", "acc", "gfId"]].drop_duplicates().sort_values(["org5", "acc"])
out = {}
for org5, sub in ll.groupby("org5"):
    out[org5] = [[r.acc, int(r.gfId)] for r in sub.itertuples()]
p = os.path.join(DATA, "leaf_list.json")
with open(p, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"leaf_list.json: {len(ll):,} รายการ (org5×acc) | {os.path.getsize(p)/1024:.0f} KB")

# ---------- leaf/<org5>.json ----------
g = m.groupby(["org5", "acc", "t"], as_index=False)[["bs", "inc", "dec", "EndDr", "EndCr"]].sum()
for c in ["bs", "inc", "dec", "EndDr", "EndCr"]:
    g[c] = g[c].round(0).astype("int64")

total = 0
for org5, sub in g.groupby("org5"):
    obj = {}
    for acc, ss in sub.groupby("acc"):
        obj[acc] = [[int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)]
                    for x in ss.sort_values("t").itertuples()]
    fp = os.path.join(LEAF_DIR, f"{org5}.json")
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    total += os.path.getsize(fp)
print(f"leaf/: {g['org5'].nunique()} ไฟล์ | รวม {total/1024/1024:.1f} MB")
