@echo off
chcp 65001 >nul
REM ============================================================
REM  อัพเดทข้อมูลรายเดือน — Financial Trend Dashboard เขต 1 (v2: ผ่าน MySQL)
REM  1) วางไฟล์ .mdb เดือนใหม่ (D5317/DataIn จาก HFO) ใน  Balance Sheet\incoming\
REM  2) ดับเบิลคลิกไฟล์นี้
REM  flow: mdb -> MySQL (replace รายงวด) -> master.parquet -> docs/data JSON
REM        -> risk_drill.html data -> push
REM  หมายเหตุ: ถ้าเดือนนี้มีไฟล์ "risk score.xlsx" ใหม่จาก รพ. ให้รัน
REM  import_risk_2569.py ก่อนไฟล์นี้ ไม่งั้น risk_drill.html จะโชว์คะแนนที่
REM  คำนวณจาก GL แทนคะแนนทางการของเดือนนั้นไปก่อน (ไม่ผิด แค่ยังไม่ใช่ตัวที่รายงานเอง)
REM ============================================================
cd /d D:\Github\Rh1-BalanceSheet

echo [0/5] ตรวจสอบ MySQL (XAMPP)...
powershell -NoProfile -Command "if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 3306 -InformationLevel Quiet -WarningAction SilentlyContinue)) { Write-Host 'MySQL ยังไม่ทำงาน กำลังสตาร์ท...'; Start-Process 'C:\xampp\mysql\bin\mysqld.exe' -ArgumentList '--defaults-file=C:\xampp\mysql\bin\my.ini' -WindowStyle Hidden; for ($i=0; $i -lt 30; $i++) { Start-Sleep -Seconds 2; if (Test-NetConnection -ComputerName 127.0.0.1 -Port 3306 -InformationLevel Quiet -WarningAction SilentlyContinue) { Write-Host 'MySQL พร้อมใช้งานแล้ว'; exit 0 } }; Write-Host 'MySQL ไม่ขึ้นภายใน 60 วินาที'; exit 1 } else { Write-Host 'MySQL กำลังทำงานอยู่แล้ว' }"
if errorlevel 1 ( echo *** MySQL สตาร์ทไม่สำเร็จ — เช็ค XAMPP ก่อน *** & pause & exit /b 1 )

echo.
echo [1/5] นำเข้า .mdb เดือนใหม่เข้า MySQL (replace รายงวด + ตรวจสุขภาพ)...
python pipeline\import_month_mdb.py
if errorlevel 1 (
  echo.
  echo *** พบปัญหา — หยุดการอัพเดท ยังไม่มีการเปลี่ยนแปลงบนเว็บ ***
  pause
  exit /b 1
)

echo.
echo [2/5] สร้าง master.parquet จาก MySQL...
python pipeline\build_from_mysql.py
if errorlevel 1 ( echo *** build ล้มเหลว *** & pause & exit /b 1 )

echo.
echo [3/5] สร้างไฟล์ JSON สำหรับ Dashboard (+ anomaly scan)...
python pipeline\export_json.py
if errorlevel 1 ( echo *** export ล้มเหลว *** & pause & exit /b 1 )
if exist pipeline\export_anomaly.py python pipeline\export_anomaly.py
if exist pipeline\export_ratio_check.py python pipeline\export_ratio_check.py
if exist pipeline\export_acc.py python pipeline\export_acc.py
if exist pipeline\export_leaf13.py python pipeline\export_leaf13.py
if exist pipeline\export_code13_prov.py python pipeline\export_code13_prov.py
if exist pipeline\export_acc_names.py python pipeline\export_acc_names.py

echo.
echo [4/5] อัพเดตหน้า "สาเหตุวิกฤต" (risk_drill.html)...
if exist pipeline\export_risk_link.py python pipeline\export_risk_link.py

echo.
echo [5/5] ส่งขึ้น GitHub (เว็บจะอัพเดทใน ~1 นาที)...
git add -A
git commit -m "data: monthly update"
git push
echo.
echo ================= เสร็จสิ้น =================
pause
