# -*- coding: utf-8 -*-
"""
import_month_mdb.py — นำเข้า DataIn เดือนใหม่ (.mdb) เข้า MySQL rh1_health.balance_sheet
ใช้ใน SOP รายเดือน (เรียกจาก update.bat):
  1) วางไฟล์ .mdb ที่ได้จาก HFO ใน  Balance Sheet\incoming\  (กี่ไฟล์ก็ได้)
  2) สคริปต์นี้อ่านทุกไฟล์ → หา time_id ที่มีในไฟล์ → ลบ time_id เดิมใน MySQL → insert ใหม่
     (replace ทั้งงวด = รองรับการแก้ข้อมูลย้อนหลังจากต้นทางอัตโนมัติ)
  3) ตรวจสุขภาพ: จำนวน รพ. เขต 1 ต่องวด ต้องเท่าเดิมหรือมากขึ้น — ถ้าลดลง ให้หยุดและรายงาน

อิง pattern จาก D:\Hospital\Rh1-Hospital-Master-Data\import_access_bs.py (พิสูจน์แล้ว 22 มิ.ย. 69)
"""
import sys, os, glob, io
import datetime
from decimal import Decimal

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import pyodbc
import pymysql

INCOMING = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet\incoming"
DB = dict(host="localhost", port=3306, user="root", password="", database="rh1_health", charset="utf8mb4")

def hcode(val):
    try:
        return str(int(float(str(val)))).zfill(5)
    except Exception:
        return str(val).strip().zfill(5)

def safe(val):
    if val is None: return None
    if isinstance(val, Decimal): return float(val)
    return val

def compute_timeid(pdate):
    """PDate (CE) → TimeID ปีงบ BE: 2024-09→256712, 2024-10→256801"""
    if not isinstance(pdate, (datetime.datetime, datetime.date)): return None
    y_be, m = pdate.year + 543, pdate.month
    return f"{y_be+1}{m-9:02d}" if m >= 10 else f"{y_be}{m+3:02d}"

def main():
    files = sys.argv[1:] or glob.glob(os.path.join(INCOMING, "*.mdb"))
    if not files:
        print(f"ไม่พบไฟล์ .mdb ใน {INCOMING} (หรือระบุ path เป็น argument)")
        sys.exit(1)

    my = pymysql.connect(**DB)
    cur = my.cursor()

    for path in files:
        print(f"\n=== {os.path.basename(path)} ===")
        acc = pyodbc.connect(r"Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=" + path)
        ac = acc.cursor()

        # 1) สำรวจ time_id ในไฟล์ (จาก PDate เสมอ — TimeID ใน Access บางปีเป็น NULL)
        ac.execute("SELECT PDate, COUNT(*) FROM [DataIn] GROUP BY PDate")
        tid_new = {}
        for pdate, n in ac.fetchall():
            tid = compute_timeid(pdate)
            if tid: tid_new[tid] = tid_new.get(tid, 0) + n
        print("  งวดในไฟล์:", {k: f"{v:,}" for k, v in sorted(tid_new.items())})

        # 2) เทียบกับที่มีใน MySQL — เตือนถ้างวดใหม่เล็กกว่าเดิมมาก (>10%)
        blocked = []
        for tid, n_new in sorted(tid_new.items()):
            cur.execute("SELECT COUNT(*) FROM balance_sheet WHERE time_id=%s", (tid,))
            n_old = cur.fetchone()[0]
            mark = ""
            if n_old and n_new < n_old * 0.9:
                mark = "  ⛔ ใหม่เล็กกว่าเดิม >10% — ข้ามงวดนี้ (ตรวจไฟล์ก่อน)"
                blocked.append(tid)
            print(f"  {tid}: เดิม {n_old:,} → ใหม่ {n_new:,}{mark}")

        # 3) replace ทีละงวด
        INSERT_SQL = """INSERT INTO balance_sheet
            (p_date, hcode, acc_type, acc_code, acc_name, dr, cr, end_dr, end_cr,
             last_net, prev_net, month_net, bs_net, pl_net, time_id, sent_date)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""
        todo = [t for t in tid_new if t not in blocked]
        for tid in todo:
            cur.execute("DELETE FROM balance_sheet WHERE time_id=%s", (tid,))
        my.commit()

        ac.execute("SELECT * FROM [DataIn]")
        cols = [d[0] for d in ac.description]
        batch, inserted = [], 0
        while True:
            rows = ac.fetchmany(10000)
            if not rows: break
            for row in rows:
                r = dict(zip(cols, row))
                pdate = safe(r.get("PDate"))
                tid = compute_timeid(pdate)
                if tid not in todo: continue
                batch.append((pdate, hcode(r.get("OrgID", "")), str(r.get("Type", "") or ""),
                              str(r.get("AccCode", "") or ""), str(r.get("AccName", "") or ""),
                              safe(r.get("Dr")), safe(r.get("Cr")), safe(r.get("EndDr")), safe(r.get("EndCr")),
                              safe(r.get("LastNet")), safe(r.get("PrevLastNet")), safe(r.get("MonthNet")),
                              safe(r.get("BSNet")), safe(r.get("PLNet")), tid, safe(r.get("SentDate"))))
                if len(batch) >= 10000:
                    cur.executemany(INSERT_SQL, batch); my.commit(); inserted += len(batch); batch = []
        if batch:
            cur.executemany(INSERT_SQL, batch); my.commit(); inserted += len(batch)
        print(f"  insert {inserted:,} แถว ({len(todo)} งวด)" + (f" | ข้าม {blocked}" if blocked else ""))
        acc.close()

    # 4) สรุปงวดล่าสุด
    cur.execute("SELECT MAX(time_id), COUNT(DISTINCT hcode) FROM balance_sheet WHERE time_id=(SELECT MAX(time_id) FROM balance_sheet)")
    tid, orgs = cur.fetchone()
    print(f"\nงวดล่าสุดใน MySQL: {tid} ({orgs} หน่วยงาน)")
    my.close()

if __name__ == "__main__":
    main()
