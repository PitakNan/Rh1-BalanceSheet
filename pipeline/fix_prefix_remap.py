# -*- coding: utf-8 -*-
"""แก้ master.parquet ที่สร้างแล้ว: รหัส suffix ซ้อนที่หลุด Mapping → จับ prefix 10 หลักจาก string"""
import sys
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")
BASE = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet"
MASTER = r"D:\Github\Rh1-BalanceSheet\master.parquet"
LV = ["GF_Name", "Budget_Name", "SubGroup_Name", "AccGroup_Name", "FinStatement_Name"]

m = pd.read_parquet(MASTER)
mp = pd.read_excel(BASE + r"\Mapping_Clean.xlsx")
mp["prefix"] = mp["MatchKey"].astype("int64")
pf_ok = mp.groupby("prefix")[LV].agg(lambda s: s.iloc[0] if s.nunique() == 1 else None).dropna()

bad = m[LV[0]].eq("ไม่ระบุ (นอก Mapping)")
m.loc[bad, "prefix"] = pd.to_numeric(m.loc[bad, "acc"].str.slice(0, 10), errors="coerce").fillna(0).astype("int64")
fixed = 0
for c in LV:
    hit = m.loc[bad, "prefix"].map(pf_ok[c])
    m.loc[bad, c] = hit.fillna("ไม่ระบุ (นอก Mapping)")
fixed = (m.loc[bad, LV[0]] != "ไม่ระบุ (นอก Mapping)").sum()
m.to_parquet(MASTER, index=False)
still = m[LV[0]].eq("ไม่ระบุ (นอก Mapping)")
print(f"แก้สำเร็จ {fixed:,} แถว | ยังนอก Mapping {still.sum():,} แถว "
      f"({m.loc[still,'bs'].abs().sum()/m['bs'].abs().sum()*100:.2f}% ของ |bs|)")
print("Top รหัสที่ยังนอก Mapping:")
print((m.loc[still].groupby("acc")["bs"].agg(lambda s: s.abs().sum()).sort_values(ascending=False).head(5)/1e6).round(1).to_string())
