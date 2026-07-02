# -*- coding: utf-8 -*-
"""
export_acc.py — ข้อ 5 BS_EFFICIENCY_PLAN (Explorer แนวทาง A: static)
สร้างข้อมูลชั้น 6 (รหัสบัญชี 10 หลัก) ระดับเขต แยกไฟล์ตาม Budget Group:
  docs/data/acc_region/b<bId>.json = { "<prefix10>": [[t,bs,inc,dec,endDr,endCr], ...] }
พร้อม acc_list.json (prefix เป็น string สำหรับ search): [[prefix, gfId], ...]
แทน Supabase ของ prototype เดิม — รันต่อจาก export_json.py ใน update.bat
"""
import sys, json, os
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

REPO = r"D:\Github\Rh1-BalanceSheet"
DATA = os.path.join(REPO, "docs", "data")
ACC_DIR = os.path.join(DATA, "acc_region")
os.makedirs(ACC_DIR, exist_ok=True)

m = pd.read_parquet(os.path.join(REPO, "master.parquet"))

# gfId/bId — ต้องสร้างเหมือน export_json.py เป๊ะ (ลำดับ sort เดียวกัน)
gdef = (
    m.groupby(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name", "Budget_Name", "GF_Name"])
    .size().reset_index().drop(columns=0)
    .sort_values(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name", "Budget_Name", "GF_Name"])
    .reset_index(drop=True)
)
gdef["gfId"] = gdef.index
gdef["bId"] = gdef.groupby(["Budget_Name"], sort=False).ngroup()
gf_key = dict(zip(gdef["GF_Name"] + "|" + gdef["Budget_Name"], gdef["gfId"]))
m["gfId"] = (m["GF_Name"] + "|" + m["Budget_Name"]).map(gf_key)
m = m.merge(gdef[["gfId", "bId"]], on="gfId")

# ---------- acc_list.json ----------
al = m[["prefix", "gfId"]].drop_duplicates().sort_values(["prefix", "gfId"])
rows = [[str(int(r.prefix)), int(r.gfId)] for r in al.itertuples()]
p = os.path.join(DATA, "acc_list.json")
with open(p, "w") as f:
    json.dump(rows, f, separators=(",", ":"))
print(f"acc_list.json: {len(rows):,} รายการ (prefix×gf) | {os.path.getsize(p)/1024:.0f} KB")

# ---------- acc_region/b<bId>.json ----------
g = m.groupby(["bId", "prefix", "t"], as_index=False)[["bs", "inc", "dec", "EndDr", "EndCr"]].sum()
for c in ["bs", "inc", "dec", "EndDr", "EndCr"]:
    g[c] = g[c].round(0).astype("int64")

total = 0
for bid, sub in g.groupby("bId"):
    obj = {}
    for pfx, ss in sub.groupby("prefix"):
        obj[str(int(pfx))] = [[int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)]
                              for x in ss.sort_values("t").itertuples()]
    fp = os.path.join(ACC_DIR, f"b{int(bid)}.json")
    with open(fp, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    total += os.path.getsize(fp)
print(f"acc_region/: {g['bId'].nunique()} ไฟล์ | prefix {g['prefix'].nunique():,} รหัส | รวม {total/1024/1024:.1f} MB")
