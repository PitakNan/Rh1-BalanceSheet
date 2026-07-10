# -*- coding: utf-8 -*-
"""
Phase 1.3 — master.parquet → docs/data/*.json สำหรับ Dashboard
- meta.json      : งวดทั้งหมด, Mapping tree (FinStatement→AccGroup→SubGroup→Budget→GF→รหัสบัญชี), รพ.+จังหวัด, ธงงวดข้อมูลไม่ครบ
- region_gf.json : ระดับเขต × งวด × GF (ละเอียดสุดที่โหลดทันที — client รวมขึ้นชั้นบนเอง)
- prov_gf.json   : ระดับจังหวัด × งวด × GF
- hosp/b<id>.json: รายโรงพยาบาล × งวด × GF แยกไฟล์ตาม Budget Group (lazy load)
- *_code.json    : ระดับรหัสบัญชี 10 หลัก (ลึกกว่า GF อีกชั้น) — lazy load เฉพาะเมื่อผู้ใช้ไล่ลึกถึงระดับนี้
ทุก record: [gfId/codeId, t, bs, inc, dec, endDr, endCr]  (array ประหยัดพื้นที่, ปัดเป็นจำนวนเต็มบาท)
"""
import sys
import json
import os
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

BASE = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet"
REPO = r"D:\Github\Rh1-BalanceSheet"
DATA = os.path.join(REPO, "docs", "data")
os.makedirs(os.path.join(DATA, "hosp"), exist_ok=True)

m = pd.read_parquet(os.path.join(REPO, "master.parquet"))

# ---------- โครงสร้างกลุ่ม (GF เป็นหน่วยเล็กสุดที่ serve) ----------
gdef = (
    m.groupby(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name", "Budget_Name", "GF_Name"])
    .size().reset_index().drop(columns=0)
    .sort_values(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name", "Budget_Name", "GF_Name"])
    .reset_index(drop=True)
)
gdef["gfId"] = gdef.index
gdef["bId"] = gdef.groupby(["Budget_Name"], sort=False).ngroup()
gdef["sId"] = gdef.groupby(["FinStatement_Name", "AccGroup_Name", "SubGroup_Name"], sort=False).ngroup()
gf_key = dict(zip(gdef["GF_Name"] + "|" + gdef["Budget_Name"], gdef["gfId"]))

m["gkey"] = m["GF_Name"] + "|" + m["Budget_Name"]
m["gfId"] = m["gkey"].map(gf_key)

# ---------- รหัสบัญชี 10 หลัก (ลึกกว่า GF อีกชั้น — 1 GF อาจรวมหลายรหัสบัญชี) ----------
map_df = pd.read_excel(BASE + r"\Mapping_Clean.xlsx", sheet_name="Mapping Clean", dtype={"CodeL1": str})
map_df["prefix"] = map_df["CodeL1"].str.split(".").str[0]
name_by_prefix = (
    map_df.groupby("prefix")["GL_Name"]
    .agg(lambda s: s.mode().iat[0] if not s.mode().empty else s.iloc[0])
    .to_dict()
)
m["prefix"] = m["prefix"].astype(str)
cdef = (
    m.groupby(["gfId", "prefix"], as_index=False).size().drop(columns="size")
    .sort_values(["gfId", "prefix"]).reset_index(drop=True)
)
cdef["codeId"] = cdef.index
cdef["name"] = cdef["prefix"].map(name_by_prefix).fillna(cdef["prefix"])
cdef["code"] = cdef["prefix"] + " " + cdef["name"]
code_key = dict(zip(cdef["gfId"].astype(str) + "|" + cdef["prefix"], cdef["codeId"]))
m["ckey"] = m["gfId"].astype(str) + "|" + m["prefix"]
m["codeId"] = m["ckey"].map(code_key)

# ---------- org / จังหวัด ----------
orgtbl = pd.read_excel(BASE + r"\อื่นๆ\OrgTbl - 2567.xlsx")
orgtbl["org5"] = orgtbl["OrgID"].astype(int).astype(str).str.zfill(5)
orgtbl = orgtbl[["org5", "Org1", "Org1" if "OrgT" not in orgtbl else "OrgT", "Province2"]]
orgtbl.columns = ["org5", "name", "type", "prov"]
org_map = orgtbl.set_index("org5").to_dict("index")
m["prov"] = m["org5"].map({k: v["prov"] for k, v in org_map.items()})

# ระดับหน่วยบริการ (F-level ตามเกณฑ์ประชากร/เตียง) — ใช้ต่อท้ายชื่อ รพ. ในหน้า dashboard
grptbl = pd.read_excel(r"D:\Hospital\รวมสูตรและหลักเกณฑ์ต่างๆ\รวมสูตร - พี่ตาล.xlsx", sheet_name="รายชื่อ รพ")
grptbl = grptbl[grptbl["Ket"] == 1].copy()
grptbl["org5"] = grptbl["OrgID"].astype(int).astype(str).str.zfill(5)
grp_map = grptbl.set_index("org5")["GroupName"].to_dict()
for k, v in org_map.items():
    v["grp"] = grp_map.get(k)

# เติม OrgT ที่ว่างในไฟล์ต้นทาง — ปางมะผ้า 11208 (รพช. 36 เตียง, F2 กลุ่มเดียวกับขุนยวม/สบเมย ที่เป็น "รพช. 30")
if "11208" in org_map and (org_map["11208"]["type"] is None or pd.isna(org_map["11208"]["type"])):
    org_map["11208"]["type"] = "รพช. 30"

periods = sorted(m["t"].unique().tolist())

# ข้อมูลครบทุกปีแล้ว (2564/2568 ใช้ Access .mdb แทน Excel ที่ truncated)
FLAGGED_FY = []
flagged = sorted(m[m["fy"].isin(FLAGGED_FY)]["t"].unique().tolist())


def agg(df, dims):
    g = df.groupby(dims + ["gfId", "t"], as_index=False)[["bs", "inc", "dec", "EndDr", "EndCr"]].sum()
    for c in ["bs", "inc", "dec", "EndDr", "EndCr"]:
        g[c] = g[c].round(0).astype("int64")
    return g


def agg_code(df, dims):
    g = df.groupby(dims + ["codeId", "t"], as_index=False)[["bs", "inc", "dec", "EndDr", "EndCr"]].sum()
    for c in ["bs", "inc", "dec", "EndDr", "EndCr"]:
        g[c] = g[c].round(0).astype("int64")
    return g


def dump(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {os.path.relpath(path, REPO)}  {os.path.getsize(path)/1024:,.0f} KB")


# ---------- meta.json ----------
meta = {
    "updated": pd.Timestamp.now().strftime("%Y-%m-%d"),
    "periods": periods,
    "flagged": flagged,
    "groups": [
        {"gfId": int(r.gfId), "bId": int(r.bId), "sId": int(r.sId), "gf": r.GF_Name,
         "budget": r.Budget_Name, "sub": r.SubGroup_Name, "accg": r.AccGroup_Name,
         "fin": r.FinStatement_Name}
        for r in gdef.itertuples()
    ],
    "orgs": [
        {"id": k, "name": v["name"], "type": str(v["type"]), "prov": v["prov"], "grp": v["grp"]}
        for k, v in org_map.items()
    ],
    "codes": [
        {"codeId": int(r.codeId), "gfId": int(r.gfId), "code": r.code}
        for r in cdef.itertuples()
    ],
}
dump(os.path.join(DATA, "meta.json"), meta)

# ---------- region (ทั้งเขต) ----------
r = agg(m, [])
dump(os.path.join(DATA, "region_gf.json"),
     [[int(x.gfId), int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)] for x in r.itertuples()])

# ---------- province ----------
p = agg(m, ["prov"])
provs = sorted(p["prov"].dropna().unique().tolist())
dump(os.path.join(DATA, "prov_gf.json"),
     {pr: [[int(x.gfId), int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)]
           for x in p[p["prov"] == pr].itertuples()] for pr in provs})

# ---------- hospital ระดับ SubGroup (โหลดทันทีเมื่อเข้าโหมด รพ.) ----------
ms = m.merge(gdef[["gfId", "sId"]], on="gfId")
hs = ms.groupby(["org5", "sId", "t"], as_index=False)[["bs", "inc", "dec", "EndDr", "EndCr"]].sum()
for c in ["bs", "inc", "dec", "EndDr", "EndCr"]:
    hs[c] = hs[c].round(0).astype("int64")
dump(os.path.join(DATA, "hosp_sub.json"),
     {o: [[int(x.sId), int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)]
          for x in hs[hs["org5"] == o].itertuples()] for o in sorted(hs["org5"].unique())})

# ---------- hospital แยกไฟล์ตาม Budget Group ----------
h = agg(m, ["org5"])
h = h.merge(gdef[["gfId", "bId"]], on="gfId")
for bid, sub in h.groupby("bId"):
    dump(os.path.join(DATA, "hosp", f"b{bid}.json"),
         {o: [[int(x.gfId), int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)]
              for x in sub[sub["org5"] == o].itertuples()] for o in sorted(sub["org5"].unique())})

# ---------- รหัสบัญชี (ทั้งเขต / จังหวัด / รพ. แยกไฟล์ตาม Budget Group เหมือนระดับ GF) ----------
os.makedirs(os.path.join(DATA, "hosp_code"), exist_ok=True)

rc = agg_code(m, [])
dump(os.path.join(DATA, "region_code.json"),
     [[int(x.codeId), int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)] for x in rc.itertuples()])

pc = agg_code(m, ["prov"])
dump(os.path.join(DATA, "prov_code.json"),
     {pr: [[int(x.codeId), int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)]
           for x in pc[pc["prov"] == pr].itertuples()] for pr in provs})

hc = agg_code(m, ["org5"])
hc = hc.merge(cdef[["codeId", "gfId"]], on="codeId").merge(gdef[["gfId", "bId"]], on="gfId")
for bid, sub in hc.groupby("bId"):
    dump(os.path.join(DATA, "hosp_code", f"b{bid}.json"),
         {o: [[int(x.codeId), int(x.t), int(x.bs), int(x.inc), int(x.dec), int(x.EndDr), int(x.EndCr)]
              for x in sub[sub["org5"] == o].itertuples()] for o in sorted(sub["org5"].unique())})

total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(DATA) for f in fs)
print(f"\nรวมขนาด docs/data ทั้งหมด: {total/1024/1024:.1f} MB | GF groups: {len(gdef)} | รหัสบัญชี: {len(cdef)} | Budget files: {h['bId'].nunique()}")
