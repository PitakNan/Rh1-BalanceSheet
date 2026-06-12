@echo off
chcp 65001 >nul
REM ============================================================
REM  อัพเดทข้อมูลรายเดือน — Financial Trend Dashboard เขต 1
REM  1) วางไฟล์เดือนใหม่ใน  Balance Sheet\incoming\
REM  2) ดับเบิลคลิกไฟล์นี้
REM ============================================================
cd /d D:\Github\Rh1-BalanceSheet

echo [1/3] นำเข้าไฟล์เดือนใหม่ + ตรวจสุขภาพข้อมูล...
python pipeline\update_month.py
if errorlevel 1 (
  echo.
  echo *** พบปัญหา — หยุดการอัพเดท ยังไม่มีการเปลี่ยนแปลงบนเว็บ ***
  pause
  exit /b 1
)

echo.
echo [2/3] สร้างไฟล์ JSON สำหรับ Dashboard...
python pipeline\export_json.py
if errorlevel 1 ( echo *** export ล้มเหลว *** & pause & exit /b 1 )

echo.
echo [3/3] ส่งขึ้น GitHub (เว็บจะอัพเดทใน ~1 นาที)...
git add -A
git commit -m "data: monthly update"
git push
echo.
echo ================= เสร็จสิ้น =================
pause
