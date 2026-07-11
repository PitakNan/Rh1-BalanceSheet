# -*- coding: utf-8 -*-
"""
build_from_mysql.py — สร้าง master.parquet จาก MySQL rh1_health.balance_sheet
แทน build_dataset.py ที่อ่าน Excel (ซึ่ง 2564/2568 truncated, 2569 มีแค่ Q1)

MySQL มีข้อมูลครบ: Access 2564/2568/2569(8) + Excel ปีอื่น รวมกันถูกต้อง
"""
import re
import sys
import pandas as pd
import numpy as np
import pymysql

sys.stdout.reconfigure(encoding="utf-8")

BASE    = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet"
OUT     = r"D:\Github\Rh1-BalanceSheet\master.parquet"
OUT_DAX = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet\master.parquet"

# ---------- 1) รายชื่อ 103 รพ. เขต 1 ----------
org = pd.read_excel(BASE + r"\อื่นๆ\OrgTbl - 2567.xlsx")
org["org5"] = org["OrgID"].astype(int).astype(str).str.zfill(5)
ORG_SET = set(org["org5"])
print(f"เขต 1: {len(ORG_SET)} รพ.")

# ---------- 2) Mapping ----------
LV = ["GF_Name", "Budget_Name", "SubGroup_Name", "AccGroup_Name", "FinStatement_Name"]

def norm_ws(s):
    # ตัดช่องว่างหัว-ท้าย + ยุบช่องว่างซ้ำเหลือ 1 ช่อง — กัน typo เว้นวรรค (เช่น "เจ้าหนี้อื่น  เงินนอกฯ" vs
    # "เจ้าหนี้อื่น เงินนอกฯ" ที่ทำให้ nunique() เห็นเป็นคนละหมวด แล้วดีดทั้งกลุ่ม prefix ไปกอง "ไม่ระบุ (นอก Mapping)")
    return re.sub(r"\s+", " ", str(s).strip()) if pd.notna(s) else s

mp = pd.read_excel(BASE + r"\Mapping_Clean.xlsx")
for c in LV:
    mp[c] = mp[c].map(norm_ws)
mp["fullkey"] = mp["MatchKey"].astype(float).map(lambda v: f"{v:.3f}")
mp["prefix"]  = mp["MatchKey"].astype("int64")
mp_full = mp.drop_duplicates("fullkey").set_index("fullkey")[LV]
pf      = mp.groupby("prefix")[LV].agg(lambda s: s.iloc[0] if s.nunique() == 1 else None)
pf_ok   = pf.dropna()
print(f"Mapping: รหัสเต็ม {len(mp_full)} | prefix สม่ำเสมอ {len(pf_ok)}/{len(pf)}")

# ---------- 2.5) Mapping patch — รหัสที่ไม่มีใน Mapping_Clean.xlsx เลย (fallback ชั้นที่ 3) ----------
# ไม่แก้ Mapping_Clean.xlsx ต้นฉบับ — ไฟล์แยกที่ผูก prefix เข้ากับหมวดที่ฝ่ายบัญชียืนยันแล้ว (6 ก.ค. 69)
patch = pd.read_csv(BASE + r"\Mapping_Patch_บัญชีนอกมาตรฐาน.csv", dtype={"prefix": str})
for c in LV:
    patch[c] = patch[c].map(norm_ws)
patch_ok = patch.set_index(patch["prefix"].astype("int64"))[LV]
print(f"Mapping patch: {len(patch_ok)} prefix เพิ่มเติม (นอกเหนือ Mapping_Clean.xlsx)")

# ---------- 3) อ่านจาก MySQL ----------
print("\nเชื่อมต่อ MySQL...")
conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")

SQL = """
    SELECT
        hcode,
        acc_code,
        time_id,
        COALESCE(dr, 0)     AS Dr,
        COALESCE(cr, 0)     AS Cr,
        COALESCE(end_dr, 0) AS EndDr,
        COALESCE(end_cr, 0) AS EndCr
    FROM balance_sheet
    WHERE time_id IS NOT NULL
      AND time_id != ''
      AND time_id REGEXP '^[0-9]{6}$'
      AND CAST(RIGHT(time_id, 2) AS UNSIGNED) BETWEEN 1 AND 12
"""

print("อ่าน balance_sheet จาก MySQL (อาจใช้เวลา 1-2 นาที)...")
df = pd.read_sql(SQL, conn)
conn.close()
print(f"อ่านได้: {len(df):,} แถว")

# ---------- 4) Normalize ----------
df["org5"] = df["hcode"].astype(str).str.zfill(5)
df = df[df["org5"].isin(ORG_SET)].copy()
print(f"หลัง filter เขต 1: {len(df):,} แถว | {df['org5'].nunique()} รพ.")

df["acc"]    = df["acc_code"].astype(str).str.strip()
df["cls"]    = df["acc"].str[0]
accf         = pd.to_numeric(df["acc"], errors="coerce")
df["fullkey"] = accf.map(lambda v: f"{v:.3f}" if pd.notna(v) else "")
df["prefix"]  = pd.to_numeric(df["acc"].str.slice(0, 10), errors="coerce").fillna(0).astype("int64")

df["t"]  = pd.to_numeric(df["time_id"], errors="coerce").astype("int64")
df["fy"] = (df["t"] // 100).astype("int64")

for c in ["Dr", "Cr", "EndDr", "EndCr"]:
    df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)

# ---------- 5) ถ้ามีแถวซ้ำ (org+acc+งวด) — เอาแถวสุดท้าย ----------
keycols = ["fy", "t", "org5", "acc", "fullkey", "prefix", "cls"]
before = len(df)
df = df.groupby(keycols, as_index=False, dropna=False)[["Dr","Cr","EndDr","EndCr"]].last()
if len(df) < before:
    print(f"Deduplicated: {before:,} → {len(df):,} แถว")

# ---------- 6) คำนวณ bs/inc/dec ----------
sign     = np.where(df["cls"].isin(["1", "5"]), 1.0, -1.0)
df["bs"] = (df["EndDr"] - df["EndCr"]) * sign
df["inc"] = np.where(sign > 0, df["Dr"],  df["Cr"])
df["dec"] = -np.where(sign > 0, df["Cr"], df["Dr"])

# ---------- 7) รวมงวด 13 → 12 (ปรับปรุงสิ้นปี) ----------
is13 = df["t"] % 100 == 13
if is13.any():
    p13 = df[is13].copy()
    p13["t"] = p13["t"] - 1
    base  = df[~is13].set_index(keycols)
    add   = p13.set_index(keycols)
    inter = base.index.intersection(add.index)
    base.loc[inter, "bs"]   = add.loc[inter, "bs"]
    base.loc[inter, "EndDr"] = add.loc[inter, "EndDr"]
    base.loc[inter, "EndCr"] = add.loc[inter, "EndCr"]
    base.loc[inter, "inc"]  = base.loc[inter, "inc"] + add.loc[inter, "inc"]
    base.loc[inter, "dec"]  = base.loc[inter, "dec"] + add.loc[inter, "dec"]
    only13 = add.loc[add.index.difference(base.index)]
    df = pd.concat([base.reset_index(), only13.reset_index()], ignore_index=True)
    print(f"รวมงวด 13→12: {len(inter):,} แถว | บัญชีใหม่ {len(only13):,} แถว")

# ---------- 8) Join Mapping ----------
# หมายเหตุสำคัญ: เช็ค "need" แยกทีละคอลัมน์ (ไม่ใช่เช็คแค่ LV[0]=GF_Name แล้วใช้ผลเดียวกันทุกคอลัมน์)
# เพราะเจอเคสจริง: บางรหัสตรง fullkey เป๊ะ (GF_Name จึงไม่ null) แต่ Budget/SubGroup/AccGroup/FinStatement
# ว่างในไฟล์ Mapping_Clean.xlsx เอง (ข้อมูลกรอกไม่ครบ ไม่ใช่ prefix ไม่ตรง) — ถ้าเช็คแค่ GF_Name แถวนั้นจะถูก
# มองว่า "resolved แล้ว" ทั้งที่อีก 4 คอลัมน์ยังไม่มีค่า เลยข้าม prefix/patch fallback ไปเฉยๆ ทำให้ 4 คอลัมน์นั้น
# ตกไปเป็น "ไม่ระบุ (นอก Mapping)" ทั้งที่ prefix เดียวกันมีข้อมูลสมบูรณ์จากรหัสย่อยอื่นอยู่แล้ว
master = df.copy()
for c in LV:
    master[c] = master["fullkey"].map(mp_full[c])
for c in LV:
    need_c = master[c].isna()
    master.loc[need_c, c] = master.loc[need_c, "prefix"].map(pf_ok[c])
# fallback ชั้นที่ 3: Mapping patch (รหัสนอกมาตรฐานที่ยืนยันหมวดแล้ว)
before_na = master[LV].isna().sum().sum()
for c in LV:
    need_c = master[c].isna()
    master.loc[need_c, c] = master.loc[need_c, "prefix"].map(patch_ok[c])
patched_cells = before_na - master[LV].isna().sum().sum()
if patched_cells:
    print(f"Mapping patch เติมให้: {patched_cells:,} cell")
need_any = master[LV].isna().any(axis=1)
cov = (~need_any).mean() * 100
miss_val = master.loc[need_any, "bs"].abs().sum()
tot_val  = master["bs"].abs().sum()
for c in LV:
    master[c] = master[c].fillna("ไม่ระบุ (นอก Mapping)")

# ---------- 9) เลือก columns และ save ----------
OUT_COLS = ["fy","t","org5","acc","fullkey","prefix","cls","bs","inc","dec","EndDr","EndCr"] + LV
master = master[OUT_COLS]

master.to_parquet(OUT, index=False)
master.to_parquet(OUT_DAX, index=False)

print(f"\n=== master.parquet: {len(master):,} แถว | {master['t'].nunique()} งวด "
      f"({master['t'].min()}–{master['t'].max()}) ===")
print(f"Mapping coverage: {cov:.2f}% | มูลค่านอก Mapping {miss_val/tot_val*100:.2f}% ของ |bs|")
print("\nแถว/งวด แยกตาม fy:")
print(master.groupby("fy")["t"].agg(["nunique","min","max"]).rename(
    columns={"nunique":"งวด","min":"งวดแรก","max":"งวดสุดท้าย"}).to_string())

print("\n[DONE] บันทึกแล้ว:")
print(f"  {OUT}")
print(f"  {OUT_DAX}")
