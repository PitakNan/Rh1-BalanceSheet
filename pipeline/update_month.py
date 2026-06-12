# -*- coding: utf-8 -*-
"""
SOP รายเดือน — อ่านไฟล์ใหม่จาก incoming\ → ตรวจสุขภาพข้อมูล → append เข้า master.parquet
ใช้: วางไฟล์ .xlsx/.csv (โครงสร้างคอลัมน์เดียวกับ DataIn) ใน
     D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet\incoming\
แล้วรัน update.bat (หรือ python update_month.py)

กติกา: งวดที่มีอยู่แล้วใน master จะถูก "แทนที่" ด้วยข้อมูลใหม่ (รองรับส่งซ้ำ/แก้ไขย้อนหลัง)
"""
import glob
import os
import sys

import numpy as np
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

BASE = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet"
INCOMING = os.path.join(BASE, "incoming")
REPO = r"D:\Github\Rh1-Finance-Trend"
MASTER = os.path.join(REPO, "master.parquet")
LV = ["GF_Name", "Budget_Name", "SubGroup_Name", "AccGroup_Name", "FinStatement_Name"]

os.makedirs(INCOMING, exist_ok=True)
files = [f for f in glob.glob(os.path.join(INCOMING, "*.*")) if f.lower().endswith((".xlsx", ".xls", ".csv"))]
if not files:
    print("ไม่พบไฟล์ใหม่ใน incoming\\ — ข้ามขั้นตอน append (จะ export + push จากข้อมูลเดิม)")
    sys.exit(0)

# ---------- master เดิม + ตารางอ้างอิง ----------
master = pd.read_parquet(MASTER)
org = pd.read_excel(BASE + r"\อื่นๆ\OrgTbl - 2567.xlsx")
org["org5"] = org["OrgID"].astype(int).astype(str).str.zfill(5)
ORG_SET = set(org["org5"])

mp = pd.read_excel(BASE + r"\Mapping_Clean.xlsx")
mp["fullkey"] = mp["MatchKey"].astype(float).map(lambda v: f"{v:.3f}")
mp["prefix"] = mp["MatchKey"].astype("int64")
mp_full = mp.drop_duplicates("fullkey").set_index("fullkey")[LV]
pf_ok = mp.groupby("prefix")[LV].agg(lambda s: s.iloc[0] if s.nunique() == 1 else None).dropna()


def fy_timeid(pdate):
    y, m = pdate.dt.year, pdate.dt.month
    fy = y + 543 + (m >= 10).astype(int)
    fm = ((m - 10) % 12) + 1
    return fy * 100 + fm


errors = []
new_parts = []
for path in files:
    df = pd.read_csv(path, dtype=str) if path.lower().endswith(".csv") else pd.read_excel(path, engine="calamine")
    df["org5"] = df["OrgID"].astype(str).str.strip().str.replace(r"\.0$", "", regex=True).str.zfill(5)
    df = df[df["org5"].isin(ORG_SET)].copy()
    if df.empty:
        errors.append(f"{os.path.basename(path)}: ไม่มีแถวของ รพ. เขต 1 เลย")
        continue

    acc = df["AccCode"].astype(str).str.strip()
    df["acc"] = acc
    df["cls"] = acc.str[0]
    accf = pd.to_numeric(acc, errors="coerce")
    df["fullkey"] = accf.map(lambda v: f"{v:.3f}" if pd.notna(v) else "")
    df["prefix"] = accf.fillna(0).astype("int64")

    t = pd.to_numeric(df.get("TimeID"), errors="coerce")
    pdate = pd.to_datetime(df["PDate"], errors="coerce")
    t = t.fillna(fy_timeid(pdate))
    df["t"] = t.astype("int64")
    df = df[df["t"] % 100 > 0]

    for c in ["Dr", "Cr", "EndDr", "EndCr"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)

    # ✔ ตรวจ 1: งบทดลองสมดุล (ΣDr = ΣCr ต่อ รพ. ต่อ งวด, เพี้ยนได้ < 1 บาท/ล้าน)
    bal = df.groupby(["org5", "t"]).apply(lambda g: abs(g["Dr"].sum() - g["Cr"].sum()), include_groups=False)
    bad = bal[bal > df.groupby(["org5", "t"])["Dr"].sum() * 1e-6 + 1]
    if len(bad):
        errors.append(f"{os.path.basename(path)}: งบทดลองไม่สมดุล {len(bad)} (รพ.,งวด) เช่น {bad.head(3).to_dict()}")

    sign = np.where(df["cls"].isin(["1", "5"]), 1.0, -1.0)
    df["bs"] = (df["EndDr"] - df["EndCr"]) * sign
    df["inc"] = np.where(sign > 0, df["Dr"], df["Cr"])
    df["dec"] = -np.where(sign > 0, df["Cr"], df["Dr"])
    df["fy"] = df["t"] // 100

    keep = df[["fy", "t", "org5", "acc", "fullkey", "prefix", "cls", "bs", "inc", "dec"]]
    new_parts.append(keep)
    norgs = keep["org5"].nunique()
    print(f"{os.path.basename(path)}: {len(keep):,} แถว | งวด {sorted(keep['t'].unique())} | รพ. {norgs}/103"
          + ("  ⚠ รพ. ไม่ครบ" if norgs < 103 else ""))
    if norgs < 95:
        errors.append(f"{os.path.basename(path)}: รพ. มาแค่ {norgs}/103 — น่าจะไฟล์ไม่ครบ")

if errors:
    print("\n❌ พบปัญหา — ไม่บันทึกข้อมูล แก้แล้วรันใหม่:")
    for e in errors:
        print("  -", e)
    sys.exit(1)

new = pd.concat(new_parts, ignore_index=True)
keycols = ["fy", "t", "org5", "acc", "fullkey", "prefix", "cls"]
new = new.groupby(keycols, as_index=False, dropna=False)[["bs", "inc", "dec"]].sum()

# งวด 13 → รวมเข้างวด 12 (ตรรกะเดียวกับ build_dataset)
is13 = new["t"] % 100 == 13
if is13.any():
    p13 = new[is13].copy()
    p13["t"] -= 1
    base = new[~is13].set_index(keycols)
    add = p13.set_index(keycols)
    inter = base.index.intersection(add.index)
    base.loc[inter, "bs"] = add.loc[inter, "bs"]
    base.loc[inter, "inc"] += add.loc[inter, "inc"]
    base.loc[inter, "dec"] += add.loc[inter, "dec"]
    new = pd.concat([base.reset_index(), add.loc[add.index.difference(base.index)].reset_index()],
                    ignore_index=True)

for c in LV:
    new[c] = new["fullkey"].map(mp_full[c])
need = new[LV[0]].isna()
for c in LV:
    new.loc[need, c] = new.loc[need, "prefix"].map(pf_ok[c])
for c in LV:
    new[c] = new[c].fillna("ไม่ระบุ (นอก Mapping)")

# ✔ ตรวจ 2: ความต่อเนื่อง — ยอดรวมเขตงวดใหม่ vs งวดก่อนหน้าใน master (แจ้งเตือนเฉยๆ)
for t_new in sorted(new["t"].unique()):
    prev_t = master[master["t"] < t_new]["t"].max()
    if pd.notna(prev_t):
        a = new[new["t"] == t_new]["bs"].abs().sum()
        b = master[master["t"] == prev_t]["bs"].abs().sum()
        r = a / b * 100 if b else 0
        flag = "⚠ ผิดปกติ" if (r < 70 or r > 140) else "OK"
        print(f"ตรวจต่อเนื่อง งวด {t_new}: Σ|bs| = {r:,.0f}% ของงวด {int(prev_t)} → {flag}")

# แทนที่งวดซ้ำ แล้ว append
dup = master["t"].isin(new["t"].unique())
if dup.any():
    print(f"แทนที่งวดเดิม {sorted(master.loc[dup,'t'].unique())} ({dup.sum():,} แถวเดิม)")
master = pd.concat([master[~dup], new], ignore_index=True)
master.to_parquet(MASTER, index=False)
print(f"\n✅ master.parquet อัพเดทแล้ว: {len(master):,} แถว | งวดล่าสุด {master['t'].max()}")

# ย้ายไฟล์ที่ประมวลผลแล้วไปเก็บ
done = os.path.join(INCOMING, "done")
os.makedirs(done, exist_ok=True)
for path in files:
    os.replace(path, os.path.join(done, os.path.basename(path)))
print(f"ย้ายไฟล์ต้นทาง {len(files)} ไฟล์ → incoming\\done\\")
