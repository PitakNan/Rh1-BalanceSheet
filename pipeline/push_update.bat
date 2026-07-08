@echo off
chcp 65001 >nul
REM ============================================================
REM  รันหลัง monthly_routine.py เสร็จ + คุณตรวจสอบข้อมูลแล้ว
REM  ขั้นตอนนี้ push ขึ้น GitHub Pages จริง (เว็บที่คนอื่นดูอยู่)
REM ============================================================
cd /d D:\Github\Rh1-BalanceSheet
git add -A
echo.
echo ===== ไฟล์ที่จะขึ้นเว็บ =====
git status
echo.
set /p CONFIRM=ตรวจสอบรายการข้างบนแล้ว พิมพ์ y แล้ว Enter เพื่อ push ขึ้นเว็บจริง:
if /I "%CONFIRM%"=="y" (
  git commit -m "data: monthly update"
  git push
  echo.
  echo เสร็จแล้ว — เว็บจะอัพเดทใน ~1 นาที ที่ https://pitaknan.github.io/Rh1-BalanceSheet/
) else (
  echo.
  echo ยกเลิก — ไฟล์ยัง staged อยู่ใน git ตรวจสอบเพิ่มเติมได้ตามสบาย
)
pause
