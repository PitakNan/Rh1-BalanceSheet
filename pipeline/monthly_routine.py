# -*- coding: utf-8 -*-
"""
monthly_routine.py — Routine รายเดือน (วันที่ 16): ดึงไฟล์จาก HFO อัตโนมัติ -> อัพเดต Balance Sheet Dashboard
ไม่ push ขึ้น GitHub อัตโนมัติ — จบแล้วต้องรีวิวเอง แล้วรัน push_update.bat

flow: HFO scraper (download+process D/MOC/Q) -> คัดลอก D5317.mdb ใหม่เข้า incoming\
      -> import_month_mdb.py -> build_from_mysql.py -> export_json.py
      -> export_anomaly.py -> export_ratio_check.py -> export_acc.py
      -> export_risk_link.py (หน้า "สาเหตุวิกฤต" risk_drill.html)

ขอบเขตปัจจุบัน: อัพเดตเฉพาะ Balance Sheet Dashboard (รวม risk_drill.html)
ยังไม่เชื่อมกับ Planfin/ต้นทุน (import_hfo_scores_costs.py) แม้ไฟล์ MOC/Q จะถูก
ดาวน์โหลดมาแล้วในขั้นตอน HFO scraper ก็ตาม (ต่อยอดได้ทีหลัง)
TPS ไม่รวมในนี้เสมอ — วันเผยแพร่ไม่แน่นอน ต้องโหลดเองแยกต่างหาก

⚠️ risk_scores (คะแนนทางการที่ รพ. รายงาน) ไม่ได้ถูกอัพเดตอัตโนมัติในนี้ — ถ้าเดือนนี้
มีไฟล์ "risk score.xlsx" ใหม่จาก รพ. ให้รัน import_risk_2569.py ก่อน (หรือหลังก็ได้)
export_risk_link.py เอง ไม่งั้น risk_drill.html จะโชว์ "คำนวณจาก GL" แทนคะแนนทางการ
ของเดือนนั้นไปก่อน (ไม่ผิด แค่ยังไม่ใช่ตัวเลขที่ รพ. รายงานเอง)

ใช้งาน:
    python monthly_routine.py                   # เดือนปัจจุบัน
    python monthly_routine.py --month 2026-07    # ระบุเดือน (สำหรับรันย้อนหลัง/ทดสอบ)
    python monthly_routine.py --skip-download    # ใช้ไฟล์ที่ดาวน์โหลดไว้แล้วใน Output/<เดือน>/ (ทดสอบ pipeline โดยไม่ยิงเว็บ HFO ซ้ำ)
"""
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

HFO_DIR  = Path(r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Routine AI\HFO")
INCOMING = Path(r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI\Balance Sheet\incoming")
BS_PIPE  = Path(r"D:\Github\Rh1-BalanceSheet\pipeline")
MYSQLD   = Path(r"C:\xampp\mysql\bin\mysqld.exe")
MYSQL_INI = Path(r"C:\xampp\mysql\bin\my.ini")


def run(cmd, cwd):
    print(f"\n>>> {' '.join(cmd)}   (cwd={cwd})")
    r = subprocess.run(cmd, cwd=str(cwd))
    if r.returncode != 0:
        print(f"\n*** ล้มเหลว: {' '.join(cmd)} — หยุด Routine (ยังไม่แตะ production) ***")
        sys.exit(1)


def ensure_mysql_running():
    """MySQL (XAMPP) ไม่ได้ตั้งเป็น Windows Service — ต้อง start เองทุกครั้งที่เครื่องรีสตาร์ท
    ก่อนรันแบบไม่มีคนเฝ้า (Task Scheduler วันที่ 16) เช็ค+สตาร์ทให้อัตโนมัติ กัน routine
    ทั้งชุด fail เงียบๆ ตั้งแต่ขั้น import_month_mdb.py"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        if s.connect_ex(("127.0.0.1", 3306)) == 0:
            print("MySQL: กำลังทำงานอยู่แล้ว")
            return
    if not MYSQLD.exists():
        print(f"\n*** ไม่พบ {MYSQLD} — เช็ค path XAMPP ก่อนรันต่อ ***")
        sys.exit(1)
    print("MySQL: ยังไม่ทำงาน — กำลังสตาร์ท...")
    subprocess.Popen([str(MYSQLD), f"--defaults-file={MYSQL_INI}"],
                      creationflags=subprocess.CREATE_NO_WINDOW)
    for _ in range(30):
        time.sleep(2)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            if s.connect_ex(("127.0.0.1", 3306)) == 0:
                print("MySQL: พร้อมใช้งานแล้ว")
                return
    print("\n*** MySQL ไม่ขึ้นภายใน 60 วินาที — หยุด Routine ***")
    sys.exit(1)


def parse_month():
    if "--month" in sys.argv:
        return sys.argv[sys.argv.index("--month") + 1]
    return datetime.now().strftime("%Y-%m")


def main():
    year_month = parse_month()
    skip_download = "--skip-download" in sys.argv
    print("=" * 60)
    print(f"  Monthly Routine — {year_month}")
    print("=" * 60)

    ensure_mysql_running()

    # 1) HFO scraper: login + download (D/MOC/Q ทั้งเขต) + process -> Excel/CSV
    hfo_cmd = [sys.executable, "main.py", "--month", year_month]
    if skip_download:
        hfo_cmd.append("--skip-download")
    run(hfo_cmd, HFO_DIR)

    # 2) หาไฟล์ D5317.mdb (งบทดลองดิบ) ที่เพิ่งดาวน์โหลด
    candidates = sorted((HFO_DIR / "Output" / year_month / "_extracted").glob("D_*/D5317.mdb"))
    if not candidates:
        print(f"\n*** ไม่พบ D5317.mdb ที่ดาวน์โหลดใหม่ใน Output/{year_month}/_extracted — หยุด ***")
        sys.exit(1)
    mdb_src = candidates[0]
    print(f"\nพบไฟล์งบทดลองดิบ: {mdb_src}  ({mdb_src.stat().st_size // 1024 // 1024} MB)")

    # 3) เคลียร์ incoming เดิม (กันไฟล์เก่าคั่งค้าง+ import ซ้ำ) แล้ววางไฟล์ใหม่
    INCOMING.mkdir(parents=True, exist_ok=True)
    for old in INCOMING.glob("*.mdb"):
        old.unlink()
        print(f"  ลบไฟล์เก่า: {old.name}")
    dest = INCOMING / f"D5317_{year_month}.mdb"
    shutil.copy2(mdb_src, dest)
    print(f"  คัดลอกเข้า incoming: {dest.name}")

    # 4) Balance Sheet pipeline: import -> build -> export (เหมือน update.bat แต่ไม่ push)
    run([sys.executable, "import_month_mdb.py"], BS_PIPE)
    run([sys.executable, "build_from_mysql.py"], BS_PIPE)
    run([sys.executable, "export_json.py"], BS_PIPE)
    # export_planfin.py ต้องรัน "หลัง" export_risk_link.py เพราะ merge คีย์ planfin เข้าไฟล์ h/*.json ที่มันสร้าง
    # export_exec.py ต้องรันท้ายสุด (อ่าน h/*.json + summary.json → exec.json แท็บผู้บริหาร)
    for opt in ("export_anomaly.py", "export_ratio_check.py", "export_acc.py",
                "export_risk_link.py", "export_planfin.py", "export_exec.py"):
        if (BS_PIPE / opt).exists():
            run([sys.executable, opt], BS_PIPE)

    print("\n" + "=" * 60)
    print("  เสร็จ — ข้อมูลอัพเดตใน MySQL + master.parquet + docs/data แล้ว")
    print("  *** ยังไม่ push ขึ้นเว็บจริง ***")
    print("  ตรวจสอบผล (เช่น เปิด docs/index.html ในเครื่อง หรือดู git diff --stat)")
    print(r"  แล้วรัน push_update.bat เพื่อขึ้นเว็บจริงเมื่อพร้อม")
    print("=" * 60)


if __name__ == "__main__":
    main()
