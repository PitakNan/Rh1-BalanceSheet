# -*- coding: utf-8 -*-
"""
fix_sep_months.py — แก้ Dr/Cr ของ ก.ย. ที่ขาดข้อมูล movement ใน MySQL
อ่าน DataIn จาก MDB ปีนั้นๆ แล้ว UPDATE balance_sheet เฉพาะแถวที่ Dr=Cr=0
รัน: python pipeline/fix_sep_months.py
"""
import sys
import pyodbc
import pymysql
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

BASE = r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet"

# MDB แต่ละปีกับ ก.ย.ที่ขาด
MDB_MAP = {
    "256212": BASE + r"\DataIn - 2563.mdb",  # ก.ย.62 อยู่ใน DataIn-2563 (opening)
    "256312": BASE + r"\DataIn - 2563.mdb",  # ก.ย.63
    "256512": BASE + r"\DataIn - 2565.mdb",  # ก.ย.65
    "256812": BASE + r"\DataIn - 2568.mdb",  # ก.ย.68
}


def read_mdb_month(mdb_path, time_id):
    """อ่าน DataIn จาก MDB กรองเฉพาะ time_id ที่ต้องการ"""
    conn_str = f"DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={mdb_path};"
    conn = pyodbc.connect(conn_str)
    df = pd.read_sql(
        f"SELECT OrgID, AccCode, TimeID, Dr, Cr, EndDr, EndCr FROM DataIn WHERE TimeID='{time_id}'",
        conn
    )
    conn.close()

    df["hcode"]    = df["OrgID"].astype(str).str.strip().str.zfill(5)
    df["acc_code"] = df["AccCode"].astype(str).str.strip()
    df["time_id"]  = time_id
    for c in ["Dr", "Cr", "EndDr", "EndCr"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)

    # เฉพาะแถวที่มี movement จริง (Dr > 0 หรือ Cr > 0)
    df = df[df["Dr"].abs() + df["Cr"].abs() > 0].copy()
    return df[["hcode", "acc_code", "time_id", "Dr", "Cr", "EndDr", "EndCr"]]


def fix_month(cur, time_id, mdb_path):
    print(f"\n=== {time_id} ===")
    print(f"  อ่านจาก {mdb_path.split(chr(92))[-1]} ...", end=" ")

    mdb_df = read_mdb_month(mdb_path, time_id)
    print(f"{len(mdb_df):,} แถว (Dr>0 หรือ Cr>0)")

    if mdb_df.empty:
        print("  ไม่มีข้อมูล — ข้าม")
        return 0

    # ดึงแถวใน MySQL ที่ Dr=Cr=0 สำหรับ time_id นี้
    cur.execute(
        "SELECT hcode, acc_code FROM balance_sheet WHERE time_id=%s AND dr=0 AND cr=0",
        (time_id,)
    )
    mysql_zeros = set((r[0].zfill(5), r[1].strip()) for r in cur.fetchall())
    print(f"  MySQL Dr=Cr=0: {len(mysql_zeros):,} แถว")

    # เฉพาะแถวที่ MDB มีข้อมูลและ MySQL ยังเป็น 0
    mdb_df["key"] = mdb_df["hcode"] + "|" + mdb_df["acc_code"]
    zero_keys     = set(h + "|" + a for h, a in mysql_zeros)
    to_update     = mdb_df[mdb_df["key"].isin(zero_keys)]
    print(f"  จะ UPDATE: {len(to_update):,} แถว")

    if to_update.empty:
        print("  ไม่มีแถวที่ต้อง update")
        return 0

    # ตั้ง lock timeout 10 นาที (ป้องกัน timeout บน UPDATE ใหญ่)
    cur.execute("SET SESSION innodb_lock_wait_timeout = 600")

    # batch UPDATE ผ่าน temp table → JOIN → UPDATE
    cur.execute("""
        CREATE TEMPORARY TABLE IF NOT EXISTS _fix_sep (
            hcode    VARCHAR(10),
            acc_code VARCHAR(50),
            dr       DOUBLE,
            cr       DOUBLE,
            end_dr   DOUBLE,
            end_cr   DOUBLE,
            INDEX idx_key (hcode, acc_code)
        )
    """)
    cur.execute("TRUNCATE TABLE _fix_sep")
    batch = [
        (r.hcode, r.acc_code, r.Dr, r.Cr, r.EndDr, r.EndCr)
        for r in to_update.itertuples()
    ]
    cur.executemany("INSERT INTO _fix_sep VALUES (%s,%s,%s,%s,%s,%s)", batch)

    cur.execute(f"""
        UPDATE balance_sheet b
        JOIN _fix_sep f ON b.hcode=f.hcode AND b.acc_code=f.acc_code AND b.time_id='{time_id}'
        SET b.dr=f.dr, b.cr=f.cr, b.end_dr=f.end_dr, b.end_cr=f.end_cr
        WHERE b.dr=0 AND b.cr=0
    """)
    updated = cur.rowcount

    print(f"  UPDATE สำเร็จ: {updated:,} แถว")
    return updated


# ---------- main ----------
print("เชื่อมต่อ MySQL...")
conn = pymysql.connect(host="localhost", user="root", db="rh1_health",
                       charset="utf8mb4", autocommit=False)
cur = conn.cursor()
print("เชื่อมต่อได้ ✓")

total = 0
for tid, mdb in MDB_MAP.items():
    n = fix_month(cur, tid, mdb)
    total += n

conn.commit()
cur.close()
conn.close()

print(f"\n✅ UPDATE รวมทั้งหมด: {total:,} แถว")
print("ขั้นต่อไป: python pipeline/build_from_mysql.py && python pipeline/export_json.py")
