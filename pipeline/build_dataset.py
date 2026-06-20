# -*- coding: utf-8 -*-
"""
Phase 1.1+1.2 — สร้าง master.parquet จาก DataIn 7 ไฟล์ (2563–2569Q1)
- กรองเฉพาะ 103 รพ. เขตสุขภาพที่ 1 (จาก OrgTbl - 2567.xlsx)
- normalize OrgID เป็น string 5 หลัก
- คำนวณ bs (ยอดคงเหลือสิ้นเดือน), inc/dec (เคลื่อนไหวเพิ่ม/ลด) ด้วยสูตรที่พิสูจน์แล้ว
  หมวด 1,5: bs = EndDr-EndCr, inc = Dr, dec = -Cr
  หมวด 2,3,4: bs = EndCr-EndDr, inc = Cr, dec = -Dr
- สร้าง TimeID จาก PDate สำหรับปีที่ TimeID เป็น NaN (2568/2569)
- validate กับคอลัมน์ BSNet/MonthNet เดิม (ปีที่มี) — ต้องตรง 100%
- join Mapping_Clean (key = รหัสบัญชี 10 หลักก่อนจุด)
"""
import sys
import pandas as pd
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")

BASE = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet"
OUT = r"D:\Github\Rh1-BalanceSheet\master.parquet"

FILES = {
    2563: "DataIn - 2563.xlsx",
    2564: "DataIn - 2564.xlsx",
    2565: "DataIn - 2565.xlsx",
    2566: "DataIn - 2566.xlsx",
    2567: "DataIn - 2567.xlsx",
    2568: "DataIn - 2568.xlsx",
    2569: "DataIn - 2569(Q1).xlsx",
}

# ---------- 1) รายชื่อ 103 รพ. เขต 1 ----------
org = pd.read_excel(BASE + r"\อื่นๆ\OrgTbl - 2567.xlsx")
org["org5"] = org["OrgID"].astype(int).astype(str).str.zfill(5)
ORG_SET = set(org["org5"])
print(f"เขต 1: {len(ORG_SET)} รพ.")

# ---------- 2) Mapping ----------
# MatchKey = รหัสบัญชีเต็มรวม suffix (เช่น 2101020199.134) เก็บเป็น float
# join 2 ชั้น: (1) รหัสเต็ม  (2) fallback ด้วย prefix 10 หลัก (ใช้ได้เมื่อทุกแถวใน prefix เดียวกันชี้กลุ่มเดียวกัน)
LV = ["GF_Name", "Budget_Name", "SubGroup_Name", "AccGroup_Name", "FinStatement_Name"]
mp = pd.read_excel(BASE + r"\Mapping_Clean.xlsx")
mp["fullkey"] = mp["MatchKey"].astype(float).map(lambda v: f"{v:.3f}")
mp["prefix"] = mp["MatchKey"].astype("int64")
mp_full = mp.drop_duplicates("fullkey").set_index("fullkey")[LV]
pf = mp.groupby("prefix")[LV].agg(lambda s: s.iloc[0] if s.nunique() == 1 else None)
pf_ok = pf.dropna()
print(f"Mapping: รหัสเต็ม {len(mp_full)} | prefix สม่ำเสมอ {len(pf_ok)}/{len(pf)}")

# ---------- 3) ประมวลผลทีละไฟล์ ----------
def fy_timeid(pdate):
    """PDate → TimeID เช่น 2023-10-31 → 256701 (ต.ค. = เดือนงวด 01 ของ FY2567)"""
    y, m = pdate.dt.year, pdate.dt.month
    fy = y + 543 + (m >= 10).astype(int)
    fm = ((m - 10) % 12) + 1
    return fy * 100 + fm

import shutil
import tempfile
import time


def read_excel_safe(path):
    """อ่าน Excel ทน OneDrive lock: ลองตรง → copy ไป temp แล้วอ่าน"""
    for attempt in range(3):
        try:
            return pd.read_excel(path, engine="calamine")
        except PermissionError:
            try:
                tmp = tempfile.mktemp(suffix=".xlsx")
                shutil.copy2(path, tmp)
                df = pd.read_excel(tmp, engine="calamine")
                os_remove_quiet(tmp)
                return df
            except PermissionError:
                time.sleep(3)
    raise PermissionError(path)


def os_remove_quiet(p):
    import os
    try:
        os.remove(p)
    except OSError:
        pass


parts = []
for year, fname in FILES.items():
    df = read_excel_safe(f"{BASE}\\{fname}")
    n0 = len(df)

    # normalize OrgID → string 5 หลัก (รองรับทั้ง int 6009 และ str '05811')
    df["org5"] = (
        df["OrgID"].astype(str).str.strip().str.replace(r"\.0$", "", regex=True).str.zfill(5)
    )
    df = df[df["org5"].isin(ORG_SET)].copy()

    acc = df["AccCode"].astype(str).str.strip()
    df["acc"] = acc
    df["cls"] = acc.str[0]
    accf = pd.to_numeric(acc, errors="coerce")
    df["fullkey"] = accf.map(lambda v: f"{v:.3f}" if pd.notna(v) else "")
    # prefix จาก 10 หลักแรกของ string (รองรับ suffix ซ้อน เช่น 1101030102.101.02)
    df["prefix"] = pd.to_numeric(acc.str.slice(0, 10), errors="coerce").fillna(0).astype("int64")

    # TimeID: ใช้ของเดิมถ้ามี ไม่งั้นสร้างจาก PDate
    t = pd.to_numeric(df.get("TimeID"), errors="coerce")
    pdate = pd.to_datetime(df["PDate"], errors="coerce")
    t = t.fillna(fy_timeid(pdate))
    df["t"] = t.astype("int64")
    df = df[df["t"] % 100 > 0]  # ตัดงวดยกมา (xx00)

    for c in ["Dr", "Cr", "EndDr", "EndCr"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)

    sign = np.where(df["cls"].isin(["1", "5"]), 1.0, -1.0)
    df["bs"] = (df["EndDr"] - df["EndCr"]) * sign
    df["inc"] = np.where(sign > 0, df["Dr"], df["Cr"])
    df["dec"] = -np.where(sign > 0, df["Cr"], df["Dr"])

    # ---- validate กับคอลัมน์เดิม (เฉพาะปีที่มี) ----
    bs0 = pd.to_numeric(df.get("BSNet"), errors="coerce")
    mn0 = pd.to_numeric(df.get("MonthNet"), errors="coerce")
    msg = ""
    if bs0.notna().sum() > 0:
        m = bs0.notna()
        dbs = (df.loc[m, "bs"] - bs0[m]).abs().max()
        dmn = (df.loc[m & mn0.notna(), "inc"] + df.loc[m & mn0.notna(), "dec"] - mn0[m & mn0.notna()]).abs().max()
        msg = f"| validate: ΔBSNet={dbs:,.2f} ΔMonthNet={dmn:,.2f}"

    keep = df[["org5", "acc", "fullkey", "prefix", "cls", "t", "bs", "inc", "dec", "EndDr", "EndCr"]].copy()
    keep["fy"] = year
    parts.append(keep)
    print(
        f"{year}: อ่าน {n0:,} → เขต1 {len(keep):,} แถว | "
        f"รพ. {keep['org5'].nunique()} | งวด {keep['t'].nunique()} {msg}"
    )

master = pd.concat(parts, ignore_index=True)

# รวมแถวซ้ำ (org+acc+งวด เดียวกัน)
keycols = ["fy", "t", "org5", "acc", "fullkey", "prefix", "cls"]
master = master.groupby(keycols, as_index=False, dropna=False)[["bs", "inc", "dec", "EndDr", "EndCr"]].sum()

# ---------- 3.5) รวมงวด 13 (ปรับปรุงสิ้นปี) เข้า ก.ย. (งวด 12) ----------
# ตามหลักบัญชี: ยอดสิ้นปีจริง = ยอดหลังปรับปรุง → bs ใช้ของงวด 13, inc/dec บวกสะสมเข้างวด 12
is13 = master["t"] % 100 == 13
if is13.any():
    p13 = master[is13].copy()
    p13["t"] = p13["t"] - 1  # → งวด 12 ปีเดียวกัน
    base = master[~is13].set_index(keycols)
    add = p13.set_index(keycols)
    inter = base.index.intersection(add.index)
    base.loc[inter, "bs"] = add.loc[inter, "bs"]
    base.loc[inter, "EndDr"] = add.loc[inter, "EndDr"]
    base.loc[inter, "EndCr"] = add.loc[inter, "EndCr"]
    base.loc[inter, "inc"] = base.loc[inter, "inc"] + add.loc[inter, "inc"]
    base.loc[inter, "dec"] = base.loc[inter, "dec"] + add.loc[inter, "dec"]
    only13 = add.loc[add.index.difference(base.index)]
    master = pd.concat([base.reset_index(), only13.reset_index()], ignore_index=True)
    print(f"รวมงวด 13 → 12: ปรับ {len(inter):,} แถว | บัญชีเกิดตอนปรับปรุง {len(only13):,} แถว")

# ---------- 4) join Mapping (รหัสเต็มก่อน → fallback prefix 10 หลัก) ----------
for c in LV:
    master[c] = master["fullkey"].map(mp_full[c])
need = master[LV[0]].isna()
for c in LV:
    master.loc[need, c] = master.loc[need, "prefix"].map(pf_ok[c])
cov = master[LV[0]].notna().mean() * 100
miss_val = master.loc[master[LV[0]].isna(), "bs"].abs().sum()
tot_val = master["bs"].abs().sum()
unmapped_top = (
    master.loc[master[LV[0]].isna()]
    .groupby("acc")["bs"].agg(lambda s: s.abs().sum())
    .sort_values(ascending=False).head(10)
)
for c in LV:
    master[c] = master[c].fillna("ไม่ระบุ (นอก Mapping)")

master.to_parquet(OUT, index=False)
print(f"\n=== master.parquet: {len(master):,} แถว | {master['t'].nunique()} งวด "
      f"({master['t'].min()}–{master['t'].max()}) ===")
print(f"Mapping coverage: {cov:.2f}% ของแถว | มูลค่านอก Mapping {miss_val/tot_val*100:.2f}% ของ |bs| รวม")
print(master.groupby("fy")["t"].nunique().rename("งวด/ปี").to_string())

# ตัวอย่าง: เจ้าหนี้การค้ารวมเขต รายปี ณ งวด 12 (ก.ย.)
chk = master[master["acc"].str.startswith("2101")]
sep = chk[chk["t"] % 100 == 12].groupby("fy")["bs"].sum()
print("\nเจ้าหนี้ (2101*) รวมเขต ณ สิ้นปีงบ (ก.ย. หลังปรับปรุง):")
print((sep / 1e6).round(1).astype(str).add(" ลบ.").to_string())

if len(unmapped_top):
    print("\nTop 10 รหัสบัญชีนอก Mapping (ตาม |bs| สะสม):")
    print((unmapped_top / 1e6).round(1).astype(str).add(" ลบ.").to_string())
