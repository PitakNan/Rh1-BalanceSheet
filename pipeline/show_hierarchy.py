# -*- coding: utf-8 -*-
import sys, pandas as pd
sys.stdout.reconfigure(encoding="utf-8")

m = pd.read_parquet(r"D:\Github\Rh1-BalanceSheet\master.parquet")
levels = ['FinStatement_Name','AccGroup_Name','SubGroup_Name','Budget_Name','GF_Name']

for lv in levels:
    vals = [v for v in sorted(m[lv].dropna().unique()) if 'Mapping' not in str(v) and 'ระบุ' not in str(v)]
    extra = [v for v in sorted(m[lv].dropna().unique()) if 'Mapping' in str(v) or 'ระบุ' in str(v)]
    print(f"\n{'='*60}")
    print(f"{lv}  ({len(vals)} รายการ + {len(extra)} นอก Mapping)")
    print('='*60)
    for v in vals:
        print(f"  {v}")

print(f"\n{'='*60}")
print(f"acc (รหัสบัญชีแต่ละตัว)  {m['acc'].nunique():,} รหัส")
print('='*60)
