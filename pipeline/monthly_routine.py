# -*- coding: utf-8 -*-
"""
monthly_routine.py — Routine รายเดือน (วันที่ 16): ดึงไฟล์จาก HFO อัตโนมัติ -> อัพเดต Balance Sheet Dashboard
ไม่ push ขึ้น GitHub อัตโนมัติ — จบแล้วต้องรีวิวเอง แล้วรัน push_update.bat

flow: HFO scraper (download+process D/MOC/Q) -> คัดลอก D5317.mdb ใหม่เข้า incoming\
      -> import_month_mdb.py -> build_from_mysql.py -> export_json.py
      -> export_anomaly.py -> export_ratio_check.py -> export_acc.py
      -> export_leaf.py -> export_leaf13.py -> export_code13_prov.py -> export_acc_names.py
         (แคตตาล็อกบัญชี explorer.html — เพิ่ม 2026-07-24 เดิมตกหล่นรันมือแยก)
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


# เก็บเวลาแต่ละขั้นตอน (label, วินาที, สถานะ) เพื่อสรุปตอนจบ
STEPS = []


def fmt_dur(sec):
    m, s = divmod(int(round(sec)), 60)
    return f"{m}m {s:02d}s" if m else f"{s}s"


def timed(label, func, *args, **kwargs):
    """เรียกฟังก์ชันพร้อมจับเวลา บันทึกลง STEPS (สำหรับขั้นที่ไม่ใช่ subprocess เช่น start MySQL/คัดลอกไฟล์)"""
    t0 = time.perf_counter()
    result = func(*args, **kwargs)
    STEPS.append((label, time.perf_counter() - t0, "ok"))
    return result


def print_summary(year_month, total_sec, done=True):
    lines = []
    lines.append("=" * 60)
    lines.append(f"  สรุปเวลาแต่ละขั้นตอน — Monthly Routine {year_month}")
    lines.append(f"  จบเมื่อ: {datetime.now():%Y-%m-%d %H:%M:%S}   สถานะ: {'เสร็จสมบูรณ์' if done else 'หยุดกลางคัน (มีขั้นล้มเหลว)'}")
    lines.append("=" * 60)
    for label, sec, status in STEPS:
        mark = "" if status == "ok" else "  <-- ล้มเหลว"
        lines.append(f"  {label:<34}{fmt_dur(sec):>10}{mark}")
    lines.append("-" * 60)
    total_label = "รวมทั้งสิ้น (Start run -> " + ("เสร็จ" if done else "หยุด") + ")"
    lines.append(f"  {total_label:<34}{fmt_dur(total_sec):>10}")
    lines.append("=" * 60)
    text = "\n".join(lines)
    print("\n" + text)
    # เซฟลง log ด้วย (สำหรับรอบที่รันอัตโนมัติไม่มีคนเฝ้า — จอจะเลื่อนหาย ต้องมีไฟล์ไว้ดูย้อน)
    log_path = None
    try:
        log_dir = BS_PIPE / "logs"
        log_dir.mkdir(exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = log_dir / f"routine_{year_month}_{stamp}.log"
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    except Exception as e:
        print(f"  (เขียน log ไม่สำเร็จ: {e})")
    return log_path


def notify_email(subject, log_path):
    """ส่งอีเมลแจ้งผล (best-effort — ส่งไม่ได้ก็ไม่ทำให้ routine พัง). ปิดด้วย --no-email
    (n8n จะส่งเมลเอง ตอนย้ายไป orchestrate ด้วย n8n ให้ผ่าน --no-email กันเมลซ้ำ)"""
    if "--no-email" in sys.argv:
        return
    sender = HFO_DIR / "send_notify.py"
    if not (sender.exists() and log_path):
        return
    try:
        subprocess.run([sys.executable, str(sender), subject, "--file", str(log_path)],
                       cwd=str(HFO_DIR), timeout=90)
    except Exception as e:
        print(f"  (ส่งอีเมลไม่สำเร็จ: {e})")


def run(cmd, cwd, label=None):
    if label is None:
        label = next((Path(c).name for c in cmd if str(c).endswith(".py")), " ".join(cmd[:2]))
    print(f"\n>>> {' '.join(cmd)}   (cwd={cwd})")
    t0 = time.perf_counter()
    r = subprocess.run(cmd, cwd=str(cwd))
    dt = time.perf_counter() - t0
    STEPS.append((label, dt, "ok" if r.returncode == 0 else "fail"))
    print(f"    [{fmt_dur(dt)}] {label}")
    if r.returncode != 0:
        print(f"\n*** ล้มเหลว: {label} ({fmt_dur(dt)}) — หยุด Routine (ยังไม่แตะ production) ***")
        ym = parse_month()
        log_path = print_summary(ym, sum(s[1] for s in STEPS), done=False)
        notify_email(f"[HFO Routine] {ym} ล้มเหลวที่ {label}", log_path)
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
    routine_start = time.perf_counter()
    year_month = parse_month()
    skip_download = "--skip-download" in sys.argv
    print("=" * 60)
    print(f"  Monthly Routine — {year_month}  (Start run: {datetime.now():%Y-%m-%d %H:%M:%S})")
    print("=" * 60)

    timed("เตรียม MySQL", ensure_mysql_running)

    # 1) HFO scraper: login + download (D/MOC/Q ทั้งเขต) + process -> Excel/CSV
    # --force = โหลดทับ ZIP เดิมเสมอ: ถ้าเคยโหลดด่วนดูก่อนหลังวันที่ 10 (ข้อมูลยังไม่ final)
    # รอบ 16 ต้องโหลดใหม่ทับให้ได้ตัวเต็ม ไม่ skip เพราะเจอไฟล์เดิม (เว้นตอน --skip-download)
    hfo_cmd = [sys.executable, "main.py", "--month", year_month]
    if skip_download:
        hfo_cmd.append("--skip-download")
    else:
        hfo_cmd.append("--force")
    run(hfo_cmd, HFO_DIR, label="HFO ดาวน์โหลด+process (D/MOC/Q)")

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
    timed("คัดลอก mdb เข้า incoming", shutil.copy2, mdb_src, dest)
    print(f"  คัดลอกเข้า incoming: {dest.name}")

    # 4) Balance Sheet pipeline: import -> build -> export (เหมือน update.bat แต่ไม่ push)
    run([sys.executable, "import_month_mdb.py"], BS_PIPE)
    run([sys.executable, "build_from_mysql.py"], BS_PIPE)
    run([sys.executable, "export_json.py"], BS_PIPE)
    # export_planfin.py ต้องรัน "หลัง" export_risk_link.py เพราะ merge คีย์ planfin เข้าไฟล์ h/*.json ที่มันสร้าง
    # export_exec.py ต้องรันท้ายสุด (อ่าน h/*.json + summary.json → exec.json แท็บผู้บริหาร)
    # export_leaf/leaf13/code13_prov/acc_names = แคตตาล็อกบัญชีของ explorer.html (เลือกหน่วยงาน 3 ระดับ
    # + ชื่อบัญชีจริงราย รพ.) — เดิมรันมือแยก ทำให้ explorer.html ค้าง (พบ 6-12 ก.ค. 69) เพิ่มเข้า routine
    # ให้อัพเดตทุกเดือนพร้อมกัน. ทั้ง 4 ตัวอ่าน master.parquet/MySQL ที่ build_from_mysql.py สร้างแล้ว
    # ไม่ขึ้นกับ risk_link/planfin — วางก่อนได้. คง risk_link->planfin->exec ท้ายสุดตามลำดับเดิม
    for opt in ("export_anomaly.py", "export_ratio_check.py", "export_acc.py",
                "export_leaf.py", "export_leaf13.py", "export_code13_prov.py", "export_acc_names.py",
                "export_risk_link.py", "export_planfin.py", "export_exec.py"):
        if (BS_PIPE / opt).exists():
            run([sys.executable, opt], BS_PIPE)

    print("\n" + "=" * 60)
    print("  เสร็จ — ข้อมูลอัพเดตใน MySQL + master.parquet + docs/data แล้ว")
    print("  *** ยังไม่ push ขึ้นเว็บจริง ***")
    print("  ตรวจสอบผล (เช่น เปิด docs/index.html ในเครื่อง หรือดู git diff --stat)")
    print(r"  แล้วรัน push_update.bat เพื่อขึ้นเว็บจริงเมื่อพร้อม")
    print("=" * 60)

    log_path = print_summary(year_month, time.perf_counter() - routine_start, done=True)
    notify_email(f"[HFO Routine] {year_month} สำเร็จ — พร้อมรีวิว+push", log_path)


if __name__ == "__main__":
    main()
