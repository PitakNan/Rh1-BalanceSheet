# -*- coding: utf-8 -*-
"""สร้าง docs/data/acc_list.json: [[prefix, gfId], ...] สำหรับ Explorer search"""
import pandas as pd, json, sys, os
sys.stdout.reconfigure(encoding='utf-8')

PARQUET = r'D:\Github\Rh1-BalanceSheet\master.parquet'
DATA    = r'D:\Github\Rh1-BalanceSheet\docs\data'

print('อ่าน parquet...')
m = pd.read_parquet(PARQUET)

# rebuild gfId เหมือน export_json.py
gdef = (
    m.groupby(['FinStatement_Name','AccGroup_Name','SubGroup_Name','Budget_Name','GF_Name'])
    .size().reset_index().drop(columns=0)
    .sort_values(['FinStatement_Name','AccGroup_Name','SubGroup_Name','Budget_Name','GF_Name'])
    .reset_index(drop=True)
)
gdef['gfId'] = gdef.index
gf_key = dict(zip(gdef['GF_Name']+'|'+gdef['Budget_Name'], gdef['gfId']))
m['gkey'] = m['GF_Name']+'|'+m['Budget_Name']
m['gfId'] = m['gkey'].map(gf_key)

# unique (prefix, gfId) sorted by prefix
acc_gf = m[['prefix','gfId']].drop_duplicates().sort_values('prefix').reset_index(drop=True)
rows = [[r.prefix, int(r.gfId)] for r in acc_gf.itertuples()]

out = os.path.join(DATA, 'acc_list.json')
with open(out, 'w') as f:
    json.dump(rows, f, separators=(',',':'))
print(f'acc_list.json: {len(rows):,} prefixes | {os.path.getsize(out)/1024:.0f} KB')
