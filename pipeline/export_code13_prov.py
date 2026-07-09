# -*- coding: utf-8 -*-
"""
export_code13_prov.py — บัญชี 13 หลัก + 10 หลัก ระดับ "ทั้งจังหวัด" (รวมทุก รพ. ในจังหวัดเดียวกัน)
เติมชั้นระหว่างเขต (code13_region/acc_region) กับรายหน่วยบริการ (leaf/) — ให้เลือก "หน่วยงาน" ได้ 3 ระดับ:
ทั้งเขต / ทั้งจังหวัด / เฉพาะ รพ.
- docs/data/code13_list_prov.json      : { "<prov>": [[code13, gfId], ...], ... }
- docs/data/code13_prov/<prov>/b<bId>.json : { "<code13>": [[t,bs,inc,dec,endDr,endCr], ...] }
- docs/data/acc_prov/<prov>/b<bId>.json    : { "<prefix10>": [[t,bs,inc,dec,endDr,endCr], ...] }  (รวม 10 หลัก ระดับจังหวัด)
"""
import sys, json, os
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

REPO = r"D:\Github\Rh1-BalanceSheet"
BASE = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet"
DATA = os.path.join(REPO, "docs", "data")
C13_DIR = os.path.join(DATA, "code13_prov")
ACC_DIR = os.path.join(DATA, "acc_prov")

m = pd.read_parquet(os.path.join(REPO, "master.parquet"))

# org5 -> จังหวัด
org = pd.read_excel(BASE + r"\อื่นๆ\OrgTbl - 2567.xlsx")
org["org5"] = org["OrgID"].astype(int).astype(str).str.zfill(5)
org = org.rename(columns={"Province2": "prov"})[["org5", "prov"]]
m = m.merge(org, on="org5", how="left")
print(f"org5 ที่ map จังหวัดไม่ได้: {m['prov'].isna().sum():,} แถว")
m = m.dropna(subset=["prov"])

# กรองเฉพาะรหัส 13 หลัก: 10 หลัก.3 หลัก (ใช้กับทั้ง code13 และ acc 10 หลักที่รวมจาก 13 หลักนี้)
full = pd.read_parquet(os.path.join(REPO, "master.parquet"))
m13 = m[m["acc"].str.match(r"^\d{10}\.\d{3}$", na=False)].copy()

# gfId/bId — ต้องสร้างเหมือน export_json.py/export_acc.py เป๊ะ (ลำดับ sort เดียวกัน)
gdef = (
    full.groupby(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name", "Budget_Name", "GF_Name"])
    .size().reset_index().drop(columns=0)
    .sort_values(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name", "Budget_Name", "GF_Name"])
    .reset_index(drop=True)
)
gdef["gfId"] = gdef.index
gdef["bId"] = gdef.groupby(["Budget_Name"], sort=False).ngroup()
gf_key = dict(zip(gdef["GF_Name"] + "|" + gdef["Budget_Name"], gdef["gfId"]))
m13["gfId"] = (m13["GF_Name"] + "|" + m13["Budget_Name"]).map(gf_key)
m13 = m13.merge(gdef[["gfId", "bId"]], on="gfId")

os.makedirs(C13_DIR, exist_ok=True)
os.makedirs(ACC_DIR, exist_ok=True)

# ---------- code13_list_prov.json ----------
cl = m13[["prov", "acc", "gfId"]].drop_duplicates().sort_values(["prov", "acc", "gfId"])
out_list = {}
for prov, sub in cl.groupby("prov"):
    out_list[prov] = [[r.acc, int(r.gfId)] for r in sub.itertuples()]
p = os.path.join(DATA, "code13_list_prov.json")
with open(p, "w", encoding="utf-8") as f:
    json.dump(out_list, f, ensure_ascii=False, separators=(",", ":"))
print(f"code13_list_prov.json: {len(cl):,} รายการ (จังหวัด×code13) | {os.path.getsize(p)/1024:.0f} KB")

# ---------- code13_prov/<prov>/b<bId>.json ----------
g13 = m13.groupby(["prov", "bId", "acc", "t"], as_index=False)[["bs", "inc", "dec", "EndDr", "EndCr"]].sum()
for c in ["bs", "inc", "dec", "EndDr", "EndCr"]:
    g13[c] = g13[c].round(0).astype("int64")

total13 = 0
for prov, subp in g13.groupby("prov"):
    prov_dir = os.path.join(C13_DIR, prov)
    os.makedirs(prov_dir, exist_ok=True)
    for bid, sub in subp.groupby("bId"):
        obj = {}
        for code, ss in sub.groupby("acc"):
            obj[code] = [[int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)]
                         for x in ss.sort_values("t").itertuples()]
        fp = os.path.join(prov_dir, f"b{int(bid)}.json")
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        total13 += os.path.getsize(fp)
print(f"code13_prov/: {g13['prov'].nunique()} จังหวัด | รวม {total13/1024/1024:.1f} MB")

# ---------- acc_prov/<prov>/b<bId>.json (รวม 10 หลัก ระดับจังหวัด) ----------
m13["prefix"] = m13["acc"].str.split(".").str[0]
gacc = m13.groupby(["prov", "bId", "prefix", "t"], as_index=False)[["bs", "inc", "dec", "EndDr", "EndCr"]].sum()
for c in ["bs", "inc", "dec", "EndDr", "EndCr"]:
    gacc[c] = gacc[c].round(0).astype("int64")

total_acc = 0
for prov, subp in gacc.groupby("prov"):
    prov_dir = os.path.join(ACC_DIR, prov)
    os.makedirs(prov_dir, exist_ok=True)
    for bid, sub in subp.groupby("bId"):
        obj = {}
        for prefix, ss in sub.groupby("prefix"):
            obj[prefix] = [[int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)]
                           for x in ss.sort_values("t").itertuples()]
        fp = os.path.join(prov_dir, f"b{int(bid)}.json")
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        total_acc += os.path.getsize(fp)
print(f"acc_prov/: {gacc['prov'].nunique()} จังหวัด | รวม {total_acc/1024/1024:.1f} MB")
