# -*- coding: utf-8 -*-
"""
export_acc_names.py — ชื่อบัญชีจริงตามที่แต่ละ รพ. รายงานเอง (acc_name จาก MySQL balance_sheet)
ต่างจาก meta.json/gfMap ที่เป็นชื่อกลุ่ม (GF) เดียวกันทั้งเขต — ที่นี่คือชื่อบัญชีจริงที่ รพ. แต่ละแห่งตั้งเอง
เฉพาะรหัส 13 หลัก (10+3) ให้ตรงกับ code13_list.json / leaf ระดับเดียวกัน
- docs/data/acc_names_region.json : { "<code13>": "ชื่อที่พบบ่อยที่สุดข้ามทุก รพ." }
- docs/data/acc_names_prov.json   : { "<prov>": { "<code13>": "ชื่อที่พบบ่อยที่สุดในจังหวัดนี้" } }
- docs/data/acc_names/<org5>.json : { "<code13>": "ชื่อจริงของ รพ.นี้" }
"""
import sys, json, os
import pandas as pd
import pymysql

sys.stdout.reconfigure(encoding="utf-8")

REPO = r"D:\Github\Rh1-BalanceSheet"
BASE = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet"
DATA = os.path.join(REPO, "docs", "data")
OUT_DIR = os.path.join(DATA, "acc_names")
os.makedirs(OUT_DIR, exist_ok=True)

org = pd.read_excel(BASE + r"\อื่นๆ\OrgTbl - 2567.xlsx")
org["org5"] = org["OrgID"].astype(int).astype(str).str.zfill(5)
ORG_SET = set(org["org5"])
prov_map = org.rename(columns={"Province2": "prov"}).set_index("org5")["prov"].to_dict()

conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")
SQL = """
    SELECT hcode, acc_code, acc_name
    FROM balance_sheet
    WHERE time_id IS NOT NULL AND time_id != ''
      AND time_id REGEXP '^[0-9]{6}$'
      AND CAST(RIGHT(time_id, 2) AS UNSIGNED) BETWEEN 1 AND 12
      AND acc_name IS NOT NULL AND acc_name != ''
"""
df = pd.read_sql(SQL, conn)
conn.close()
print(f"อ่านจาก MySQL: {len(df):,} แถว")

df["org5"] = df["hcode"].astype(str).str.zfill(5)
df = df[df["org5"].isin(ORG_SET)].copy()
df["acc"] = df["acc_code"].astype(str).str.strip()
df["acc_name"] = df["acc_name"].astype(str).str.strip()
df = df[df["acc"].str.match(r"^\d{10}\.\d{3}$", na=False)]
print(f"หลังกรอง 13 หลัก + เขต 1: {len(df):,} แถว")

def mode_or_last(s):
    m = s.mode()
    return m.iat[0] if not m.empty else s.iloc[-1]

# ---------- per-org (ชื่อจริงที่ รพ.นั้นใช้) ----------
total = 0
for org5, sub in df.groupby("org5"):
    names = sub.groupby("acc")["acc_name"].agg(mode_or_last).to_dict()
    fp = os.path.join(OUT_DIR, f"{org5}.json")
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(names, f, ensure_ascii=False, separators=(",", ":"))
    total += os.path.getsize(fp)
print(f"acc_names/: {df['org5'].nunique()} ไฟล์ | รวม {total/1024:.0f} KB")

# ---------- region-wide (ชื่อที่พบบ่อยที่สุดข้ามทุก รพ. — สำหรับมุมมองทั้งเขต) ----------
region_names = df.groupby("acc")["acc_name"].agg(mode_or_last).to_dict()
p = os.path.join(DATA, "acc_names_region.json")
with open(p, "w", encoding="utf-8") as f:
    json.dump(region_names, f, ensure_ascii=False, separators=(",", ":"))
print(f"acc_names_region.json: {len(region_names):,} รหัส | {os.path.getsize(p)/1024:.0f} KB")

# ---------- per-province (ชื่อที่พบบ่อยที่สุดในจังหวัดนั้น — สำหรับมุมมองทั้งจังหวัด) ----------
df["prov"] = df["org5"].map(prov_map)
df_p = df.dropna(subset=["prov"])
prov_names = {}
for prov, sub in df_p.groupby("prov"):
    prov_names[prov] = sub.groupby("acc")["acc_name"].agg(mode_or_last).to_dict()
p = os.path.join(DATA, "acc_names_prov.json")
with open(p, "w", encoding="utf-8") as f:
    json.dump(prov_names, f, ensure_ascii=False, separators=(",", ":"))
print(f"acc_names_prov.json: {df_p['prov'].nunique()} จังหวัด | {os.path.getsize(p)/1024:.0f} KB")
