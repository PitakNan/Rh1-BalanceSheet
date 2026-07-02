@echo off
chcp 65001 >nul
REM ============================================================
REM  อัพเดทข้อมูลรายเดือน — Financial Trend Dashboard เขต 1 (v2: ผ่าน MySQL)
REM  1) วางไฟล์ .mdb เดือนใหม่ (D5317/DataIn จาก HFO) ใน  Balance Sheet\incoming\
REM  2) ดับเบิลคลิกไฟล์นี้
REM  flow: mdb -> MySQL (replace รายงวด) -> master.parquet -> docs/data JSON -> push
REM ============================================================
cd /d D:\Github\Rh1-BalanceSheet

echo [1/4] นำเข้า .mdb เดือนใหม่เข้า MySQL (replace รายงวด + ตรวจสุขภาพ)...
python pipeline\import_month_mdb.py
if errorlevel 1 (
  echo.
  echo *** พบปัญหา — หยุดการอัพเดท ยังไม่มีการเปลี่ยนแปลงบนเว็บ ***
  pause
  exit /b 1
)

echo.
echo [2/4] สร้าง master.parquet จาก MySQL...
python pipeline\build_from_mysql.py
if errorlevel 1 ( echo *** build ล้มเหลว *** & pause & exit /b 1 )

echo.
echo [3/4] สร้างไฟล์ JSON สำหรับ Dashboard (+ anomaly scan)...
python pipeline\export_json.py
if errorlevel 1 ( echo *** export ล้มเหลว *** & pause & exit /b 1 )
if exist pipeline\export_anomaly.py python pipeline\export_anomaly.py

echo.
echo [4/4] ส่งขึ้น GitHub (เว็บจะอัพเดทใน ~1 นาที)...
git add -A
git commit -m "data: monthly update"
git push
echo.
echo ================= เสร็จสิ้น =================
pause
