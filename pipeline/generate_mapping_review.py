# -*- coding: utf-8 -*-
"""
generate_mapping_review.py — สร้างชีท (CSV) ให้ "ฝ่ายบัญชี" ตรวจสอบ mapping 2 อย่างที่ยัง "ร่างเอง":
  1) การแยกรายรับเป็น OP / IP / P&P (opip_of — จาก keyword ในชื่อบัญชี)
  2) การจับรหัสบัญชี -> P-code Planfin (planfin_code — จาก Mapping_Clean.xlsx + fallback โครงสร้าง MOPH)
reuse ฟังก์ชันจริงจาก export_exec/export_planfin (ตัวเดียวกับที่หน้าเว็บใช้) → ชีทตรงกับที่แสดงจริงเสมอ

ผลลัพธ์: mapping_review_for_accounting.csv (UTF-8 BOM เปิดใน Excel ภาษาไทยได้) — มีช่องให้ทำเครื่องหมาย
ถูก/ผิด + ช่องแก้ไข ส่งให้ฝ่ายบัญชี/กองเศรษฐกิจสุขภาพยืนยัน แล้วค่อยแก้ที่ผัง (Mapping_Clean.xlsx / regex)

ใช้: python generate_mapping_review.py
"""
import sys, os, csv, json
import pandas as pd
import pymysql

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = r"D:\Github\Rh1-BalanceSheet"
sys.path.insert(0, HERE)
from export_exec import opip_of                       # noqa: E402
from export_planfin import planfin_code, PN           # noqa: E402

NAME_FILES = [os.path.join(REPO, "docs", "data", "acc_names_region.json"),
              os.path.join(REPO, "docs", "data", "acc_names_prov.json")]
OPIP_LABEL = {"op": "OP ผู้ป่วยนอก", "ip": "IP ผู้ป่วยใน", "pp": "P&P ส่งเสริม/ป้องกัน", "oth": "อื่น/รวม (ชื่อไม่ระบุ)"}


def main():
    names = {}
    for p in NAME_FILES:
        if os.path.exists(p):
            names.update(json.load(open(p, encoding="utf-8")))
    print(f"โหลดชื่อบัญชี {len(names)} รายการ")

    conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")
    items = pd.read_sql("SELECT RatioItemID,CodeL1 FROM ratio_items WHERE UseYN='Yes' "
                        "AND RatioItemID IN ('3006Y','3010X')", conn)
    conn.close()
    rev = sorted(set(items.loc[items.RatioItemID == "3006Y", "CodeL1"]))
    exp = sorted(set(items.loc[items.RatioItemID == "3010X", "CodeL1"]))

    rows = []
    for r in rev:
        nm = names.get(r, "(ไม่พบชื่อ)")
        seg = opip_of(nm)
        p = planfin_code(r)
        rows.append(["รายรับ (3006Y)", r, nm, OPIP_LABEL[seg], p, PN.get(p, ""), "", ""])
    for r in exp:
        nm = names.get(r, "(ไม่พบชื่อ)")
        p = planfin_code(r)
        rows.append(["รายจ่าย (3010X)", r, nm, "—", p, PN.get(p, ""), "", ""])

    # เรียงให้กลุ่มเดียวกันอยู่ติดกัน: ประเภท -> P-code -> รหัส (ฝ่ายบัญชีตรวจง่าย)
    rows.sort(key=lambda x: (x[0], x[4], x[1]))

    out = os.path.join(REPO, "mapping_review_for_accounting.csv")
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ประเภท", "รหัสบัญชี (root)", "ชื่อบัญชี",
                    "แยกเป็น OP/IP/P&P (เฉพาะรายรับ)", "P-code (Planfin)", "ชื่อ P-code",
                    "ถูกต้อง? (✓/✗)", "ถ้าผิด แก้เป็น"])
        w.writerows(rows)
    print(f"เขียน {len(rows)} แถว ({len(rev)} รายรับ + {len(exp)} รายจ่าย) -> {out}")
    print("ช่องให้ฝ่ายบัญชีตรวจ: 'ถูกต้อง? (✓/✗)' + 'ถ้าผิด แก้เป็น'")


if __name__ == "__main__":
    main()
