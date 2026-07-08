@echo off
chcp 65001 >nul
REM ============================================================
REM  Routine รายเดือน — ดึงไฟล์จาก HFO อัตโนมัติ + อัพเดต Balance Sheet
REM  (ไม่ push ขึ้นเว็บจริงอัตโนมัติ — รีวิวก่อนแล้วรัน push_update.bat)
REM  ตั้งเวลาไว้ใน Task Scheduler ให้รันวันที่ 16 ของทุกเดือน
REM ============================================================
set HFO_HEADLESS=1
cd /d D:\Github\Rh1-BalanceSheet\pipeline
python monthly_routine.py
echo.
echo เสร็จสิ้น Routine อัตโนมัติ — ดู log ด้านบนเพื่อตรวจสอบก่อน push
pause
