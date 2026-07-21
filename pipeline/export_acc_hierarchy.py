# -*- coding: utf-8 -*-
"""
export_acc_hierarchy.py — สร้าง docs/data/acc_hierarchy.json สำหรับหน้า acc_tree.html
(ต้นไม้ผังบัญชี 7 ชั้นทางการ) อ่านจากตาราง acc_hierarchy (นำเข้าจาก AllCodeTbl)
ผังบัญชีเปลี่ยนไม่บ่อย (ต่างจากงบทดลองรายเดือน) จึงรันแยกเองเวลาผังอัพเดต ไม่ได้ผูกกับ monthly_routine.py
"""
import sys, json, os
from collections import Counter
import pymysql

sys.stdout.reconfigure(encoding="utf-8")

REPO = r"D:\Github\Rh1-BalanceSheet"
OUT = os.path.join(REPO, "docs", "data", "acc_hierarchy.json")

CAT_MAP = {
    "สินทรัพย์": "asset",
    "หนี้สิน": "liability",
    "ทุน": "equity",
    "รายได้": "revenue",
    "ค่าใช้จ่าย": "expense",
}

conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")
cur = conn.cursor()
cur.execute(
    "SELECT CodeL1,Account1,CodeL2,Name2,CodeL3,Name3,CodeL4,Name4,CodeL5,Name5,Code6,Name6,Code7,Name7,UseYN "
    "FROM acc_hierarchy ORDER BY CodeL1,CodeL2,CodeL3,CodeL4,CodeL5,Code6,Code7"
)
cols = ["CodeL1", "Account1", "CodeL2", "Name2", "CodeL3", "Name3", "CodeL4", "Name4",
        "CodeL5", "Name5", "Code6", "Name6", "Code7", "Name7", "UseYN"]
data = [dict(zip(cols, r)) for r in cur.fetchall()]

KEY_MAP = {
    0: ("Code7", "Name7"),
    1: ("Code6", "Name6"),
    2: ("CodeL5", "Name5"),
    3: ("CodeL4", "Name4"),
    4: ("CodeL3", "Name3"),
    5: ("CodeL2", "Name2"),
}


def build(depth, items):
    if depth == 6:
        out = []
        for r in items:
            o = {"c": r["CodeL1"], "n": r["Account1"]}
            if r["UseYN"] != "Yes":
                o["x"] = 1
            out.append(o)
        return out
    ck, nk = KEY_MAP[depth]
    groups, order = {}, []
    for r in items:
        k = (r[ck], r[nk])
        if k not in groups:
            groups[k] = []
            order.append(k)
        groups[k].append(r)
    children = []
    for k in order:
        code, name = k
        node = {"c": code, "n": name, "k": build(depth + 1, groups[k])}
        if depth == 2:
            node["cat"] = CAT_MAP.get(name, "")
        children.append(node)
    return children


tree = build(0, data)

total = len(data)
active = sum(1 for r in data if r["UseYN"] == "Yes")
by_cat = Counter(r["Name5"] for r in data)
stats = {
    "total": total,
    "active": active,
    "inactive": total - active,
    "byCat": [{"name": n, "key": CAT_MAP[n], "count": c} for n, c in by_cat.items()],
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"tree": tree, "stats": stats}, f, ensure_ascii=False, separators=(",", ":"))

print(f"{OUT} — {total:,} รหัส ({os.path.getsize(OUT)/1024:.0f} KB)")
