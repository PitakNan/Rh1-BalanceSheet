# -*- coding: utf-8 -*-
"""
export_exec.py — ข้อมูลแท็บ "แนวทางสำหรับผู้บริหาร" (risk_drill.html#exec)
สร้าง docs/data/risk/exec.json ไฟล์เดียว ครบทุก รพ. (ไม่ต้องโหลด h/*.json ทีละแห่ง)

ต่อ รพ. ประกอบด้วย:
  1) rev: รายได้กองทุนราย P (ผัง Planfin เดียวกับ export_planfin.py — รวมส่วนต่ำ/ส่วนสูงแล้ว)
     แยก op/ip/pp/oth ตามชื่อบัญชีระดับ root (⚠️ mapping OP/IP ร่างเอง — ดู checklist ท้ายไฟล์)
  2) exp: ค่าใช้จ่ายราย P (ฐานคำนวณ MOE — ค่าใช้จ่ายจำเป็นต่อเดือน ฝั่งหน้าเว็บเลือกหมวดได้)
  3) tj : หนี้ค่ารักษาตามจ่าย OP-UC นอก CUP สองฝั่ง
       payIn/payOut = เจ้าหนี้ (2101020199.202 ในจังหวัด / .203 ต่างจังหวัด)
       arIn /arOut  = ลูกหนี้ (1102050101.203 + 1102050194.204 ในจังหวัด /
                              1102050101.204 + 1102050194.205 ต่างจังหวัด)
  4) bs : snapshot งบดุลงวดล่าสุด (คัดจาก h/{hcode}.json ที่ export_risk_link.py ทำไว้
          — ใช้ตัวเลขชุดเดียวกับ Simulator เดิม → คะแนนตรงกัน 100%)

ตรวจสอบความสอดคล้อง: Σrev − Σexp ต้องเท่ากับ NI ของงวด (t.ni) ทุกแห่ง — ถ้าไม่ตรงจะ print เตือน
รันหลัง export_risk_link.py (ต้องมี h/*.json ก่อน)
"""
import os, sys, json, re
import pandas as pd
import pymysql

sys.stdout.reconfigure(encoding="utf-8")
REPO   = r"D:\Github\Rh1-BalanceSheet"
MASTER = os.path.join(REPO, "master.parquet")
META_J = os.path.join(REPO, "docs", "data", "meta.json")
H_DIR  = os.path.join(REPO, "docs", "data", "risk", "h")
SUM_J  = os.path.join(REPO, "docs", "data", "risk", "summary.json")
NAME_J = os.path.join(REPO, "docs", "data", "acc_names_region.json")
NAME_P = os.path.join(REPO, "docs", "data", "acc_names_prov.json")
OUT    = os.path.join(REPO, "docs", "data", "risk", "exec.json")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export_planfin import PN, REV_ORDER, EXP_ORDER, planfin_code, acc_root

# ══ รายการไม่ใช่เงินสด (non-cash) สำหรับ depMo ══
# ค่าเสื่อม/ตัดจำหน่าย (P24 ← 5105*) + หนี้สูญและสงสัยจะสูญ (P241 ← 5108*) เท่านั้น
#
# ⚠️ ห้ามกลับไปใช้ (t["exp"] − t["e33y"]) เป็น non-cash เหมือนเดิม — ตรวจกับ GL 2026-07-27 พบว่า
#    ผลต่าง 3010X−3330Y ไม่ใช่ค่าเสื่อมล้วน แต่มี "ค่าใช้จ่ายระหว่างหน่วยงาน" (5209*/5210* → P251/P25)
#    ปนอยู่ 87% ของยอด (ทั้งเขต: inter-agency 13,014 ลบ. เทียบค่าเสื่อมจริง 5105 = 1,936 ลบ.)
#    ซึ่งฝั่งหน้าเว็บนับเป็น "ค่าใช้จ่ายเงินสดนอกนิยาม MOE" (exXmoeMo) อยู่แล้ว → ถูกหักซ้ำสองรอบ
#    ทำให้ NI จำลองติดลบเกินจริงในโรงพยาบาลใหญ่ เช่น รพศ.เชียงรายประชานุเคราะห์ แสดง −486.65 ลบ./ด.
#    ทั้งที่งบทดลองจริงกำไร +59.69 ลบ./ด. และดันระดับวิกฤต ณ ก.ย. สูงเกินไป 1 ระดับใน 7 แห่ง
#
# ยืนยันความถูกต้องของนิยามใหม่: P24+P241 = 1,959 ลบ. เทียบบัญชีค่าเสื่อมจริง 5105* = 1,936 ลบ.
# (ต่างกัน 1.2% = ส่วนของหนี้สูญ P241 + งบลงทุน UC ที่ผัง Planfin จัดเข้า P24)
# สมการที่ได้: NI = Σรายรับ − MOE − คชจ.นอกนิยาม − depMo = Σรายรับ − Σคชจ. ← ตรงนิยาม NI ทางการ
#              (3006Y − 3010X) พอดี · กระแสเงินสด = NI + depMo = บวกกลับ non-cash จริงเท่านั้น
NONCASH_P = ("P24", "P241")

# ══ ปีงบที่ใช้วัดปัจจัยฤดูกาลปลายปีงบ (niYE/clYE) ══
# ใช้ 2 ปีล่าสุดที่ปิดงบครบแล้ว — ปี 2567 NI ไตรมาสท้ายพลิกลบ −328 ลบ./ด. · ปี 2568 −843 ลบ./ด.
# เฉลี่ยสองปีได้ค่ากลาง ๆ ไม่สุดโต่งไปทางใดทางหนึ่ง (RISK_EXEC_MODEL.md 7.10 · MOE_CHANGELOG)
YE_FY = (2567, 2568)

# ══ โปรไฟล์ NI รายเดือน (niProf) — แทนบล็อก 3 เดือนของ niYE ══════════════════════════
# เจ้าของงานสั่ง 12 ส.ค. 69: "NI ต้องไม่ใช่เฉลี่ยต่อเดือน ต้องไปเอามาจากงบทดลอง แล้วถ้าเลือก
# ตัวกรองเป็นเดือนไหน ต้องเทียบสัดส่วนเพิ่มหรือลดให้เป็นไปตามทิศทาง"
#
# ปัญหาของเดิม: niYE เป็นค่าเดียวใช้เหมือนกันทั้ง ก.ค./ส.ค./ก.ย. → ยอด "สะสม ณ ก.ย." ถูก
#   แต่เดือนกลางทางผิด และเดือนของปีงบถัดไป (เลือกได้ถึง 14 เดือน) ไม่ปรับเลยทั้งที่ ต.ค.
#   เป็นเดือนที่ NI สูงสุดของปีจริง ๆ (วัดจริงทั้งเขต: ต.ค. +866 ลบ. เหนือค่าเฉลี่ยทั้งปี)
#   ตั้งแต่ "เดือนเป้า" กลายเป็นตัวกรองที่ผู้ใช้เลือกเอง (11 ส.ค. 69) ข้อผิดนี้จึงโผล่บนจอ
#
# niProf[m] = ส่วนต่างของ NI เดือน m เทียบค่าเฉลี่ยรายเดือนของปีนั้น (บาท/เดือน) เฉลี่ยข้าม YE_FY
#   → ผลรวม 12 เดือน = 0 เสมอ (ไม่เปลี่ยนยอดทั้งปี เปลี่ยนแค่การกระจายตัวระหว่างเดือน)
#
# ⛔ ห้ามทำเป็น "สัดส่วน" (ตัวคูณ) แม้โจทย์จะใช้คำว่าสัดส่วน — วัดจริงแล้วใช้ไม่ได้:
#   ค่าเฉลี่ย NI รายเดือนปี 68 ทั้งเขต = −15.2 ลบ. (ใกล้ 0) ตัวคูณจึงระเบิดเป็น −58.89 ถึง +44.91 เท่า
#   และถ้าฐาน NI ของ รพ. ติดลบ การคูณด้วยตัวคูณติดลบจะพลิกขาดทุนเป็นกำไรทันที = ผิดทิศ
#   ส่วนต่างแบบบวกให้ "ทิศทางเพิ่ม/ลดรายเดือน" ตามที่ต้องการโดยไม่พังตอนข้ามศูนย์
PROF_FY = (2567, 2568)

# ══ 🏦 เงินของเขตที่ฝากไว้กับ รพ. (เจ้าของงานแจ้ง 12 ส.ค. 69) ═══════════════════════
# เงินก้อนนี้ **ไม่ใช่ของ รพ. เอง** — เขตฝากไว้เฉย ๆ แต่ไปนอนอยู่ในบัญชีเงินฝากธนาคาร
# นอกงบประมาณของ รพ. โดย **ไม่มีบัญชีเงินรับฝากคู่กันฝั่งหนี้สิน** (ตรวจงบ 256910 แล้ว
# ทั้ง 3 แห่ง ไม่มีบัญชีไหนยอดตรง 57.4/47.4 และ 10674 ไม่มี "เงินรับฝากอื่น" เลย)
# → เงินสด+เทียบเท่าจึงสูงเกินจริง และ Cash/QR/CR ของ 3 แห่งนี้ดูดีเกินจริงตามไปด้วย
# ต้อง **หักออกตั้งแต่ต้น** ก่อนคำนวณทุกอย่าง (เจ้าของงานสั่ง)
#
# ⚠️ หักฝั่งเงินสดอย่างเดียว **ไม่แตะหนี้สิน** — เพราะไม่มีคู่บัญชีอยู่แล้ว ถ้าไปลด CL ด้วยจะผิด
# ⚠️ ไม่กระทบ NI — ไม่ใช่รายได้/ค่าใช้จ่าย เป็นการแก้ยอดตั้งต้นเฉย ๆ
#
# เงินก้อนนี้ใช้ **เติมสภาพคล่องให้ รพ. ทุกแห่งในเขต** ได้ (หลักการเดียวกับเงินเติมสภาพคล่อง)
# หน้าเว็บมีปุ่มเลือกว่าจะเติมให้ใคร และดึงจากก้อนของ รพ. ไหน
#
# 🕐 ยอด ณ 12 ส.ค. 69 — นครพิงค์เหลือ 47.4 เพราะโยกให้สำนักงานเขตฯ ไปแล้ว 10 ลบ.
#    ถ้ายอดเปลี่ยนอีกให้แก้ที่นี่ที่เดียว (หน้าเว็บอ่านจาก exec.json ไม่ hardcode ซ้ำ)
REGION_DEPOSIT = {
    "10713": 47_400_000.0,   # รพศ.นครพิงค์ (เดิม 57.4 − โยกให้สำนักงานเขตฯ 10.0)
    "10672": 57_400_000.0,   # รพศ.ลำปาง
    "10674": 57_400_000.0,   # รพศ.เชียงรายประชานุเคราะห์
}


# ══ รายได้ที่ไม่ใช่เงินสด (non-cash revenue) — สมมาตรกับ NONCASH_P ฝั่งค่าใช้จ่าย ══
# 4302030101.102 "รายได้จากการรับบริจาค-สินทรัพย์อื่น" = ได้ของ ไม่ได้เงิน แต่ลงรายได้เต็มจำนวน
# (แล้วทยอยรับรู้เป็นค่าเสื่อมในปีต่อ ๆ ไป) — งวด 256909 ทั้งเขต 1,146.3 ลบ. = 2.65% ของรายรับ
# ⚠️ 18/103 แห่งผ่านเกณฑ์ NI ≥ 0 เพราะรายการนี้ (น่าน 445 · บ่อเกลือ 77 ลบ.)
# หลักที่ใช้ (CFO 29 ก.ค. 69): คงไว้ใน NI ตามบัญชี (คะแนน ST/SU ต้องตรงเกณฑ์ทางการ)
# แต่ **หักออกจากกระแสเงินสด** — ตรงข้ามกับ depMo ที่บวกกลับ ดู RISK_EXEC_MODEL.md 3.10
# ไม่รวม .101 (รับบริจาคเป็นเงินสด/รายการเทียบเท่า) ซึ่งเป็นเงินจริง
NONCASH_REV = {"4302030101.102"}

# ══ เงินรับโอนจากหน่วยงานในสังกัด (สำหรับปัจจัยเสี่ยง "ถ้าเงินโอนหยุด") ══
# 4313010199.114-123 = "รายได้อื่น-…รับโอนจาก สสจ./รพศ./รพท./รพช./รพ.สต." ทั้งชุดอยู่ใน 3006Y
# ⚠️ บัญชีชุดนี้อยู่ใน rev อยู่แล้ว (P12/P13) — ที่เก็บแยกนี้เป็นเพียง "แท็ก" ไว้แสดงผล
#    ห้ามบวกเข้า rev ซ้ำ ไม่งั้น identity Σrev−Σexp = NI จะพัง
# แยกสองถัง เพราะกระทบการดำเนินงานไม่เท่ากัน (ดู RISK_EXEC_MODEL.md หัวข้อ 3.7):
#   op  = เงินดำเนินงาน/สินค้า/วัสดุ — หยุดแล้วกระทบสภาพคล่องทันที
#   inv = ครุภัณฑ์-ที่ดิน (.116) + งบลงทุน (.118) — ไม่ใช่เงินหมุนเวียน และ .118 ไม่อยู่ใน 3330X
TRF_OP  = {f"4313010199.{i}" for i in (114, 115, 117, 119, 120, 121, 122, 123)}
TRF_INV = {"4313010199.116", "4313010199.118"}

# ══ แยกหนี้สินหมุนเวียน (1001Y) เป็นถัง — ฐานของเงินสำรอง MOE (RISK_EXEC_MODEL.md 3.13) ══
# วัดจากงบจริงงวด 256909: เจ้าหนี้การค้า 4,312.8 ลบ. = 66.8% ของหนี้สินหมุนเวียนทั้งเขต
# และ "รอบค้างจริง" (ยอดเจ้าหนี้ ÷ ค่าใช้จ่ายกลุ่มนั้น/เดือน) ต่างกันคนละเรื่อง:
#   เจ้าหนี้การค้า มัธยฐาน 4.72 เดือน  ← ผู้ขายให้เครดิต ยืดได้ (หางดง 20.6 ด. · ดอยหล่อ 18.9 ด.)
#   คชจ.บุคลากร/สาธารณูปโภคค้างจ่าย 1.84 เดือน  ← ยืดไม่ได้ ต้องมีเงินสดจ่าย
# → เงินสำรอง MOE กันเฉพาะส่วนที่ "ยืดไม่ได้" ไม่กันเจ้าหนี้การค้า (ดูเหตุผลเต็มใน 3.13)
# รีโปรดิวซ์: python pipeline/analyze_ap_terms.py (ใช้ cl_bucket ตัวนี้ ห้ามก๊อปไปไว้ที่อื่น)
CL_TRADE_PRE = ("2101010101", "2101010102", "2101010103", "2101010107", "2101020198")
CL_ACCR_PRE  = ("2102",)


def cl_bucket(root):
    """จำแนก root บัญชีหนี้สินหมุนเวียนเป็น 4 ถัง
    trade = เจ้าหนี้การค้า/ผู้ขาย (ยา เวชภัณฑ์ วัสดุ ครุภัณฑ์ จ้างเหมา LAB/X-Ray + GR/IR) — มีเครดิต
    accr  = คชจ.บุคลากร/สาธารณูปโภคค้างจ่าย (2102*) — ครบกำหนดแล้ว ต้องจ่ายด้วยเงินสด
    tj    = เจ้าหนี้ค่ารักษาตามจ่าย — มีกลไก Option แยกในแท็บ #exec อยู่แล้ว ไม่ใช่ MOE
    oth   = เงินรับฝาก/เงินประกัน/รายได้รับล่วงหน้า — ไม่ใช่ภาระจ่ายจากเงินบำรุงตามรอบ
    """
    if root.startswith(CL_TRADE_PRE):
        return "trade"
    if root.startswith("2101020199."):
        # .134-.150 = เจ้าหนี้สินค้า/บริการ · .2xx/.3xx/.5xx/.7xx = ค่ารักษาตามจ่าย
        return "trade" if root.split(".")[1][0] == "1" else "tj"
    if root.startswith("2101020106"):
        return "tj"
    if root.startswith(CL_ACCR_PRE):
        return "accr"
    return "oth"


# กลุ่ม MOE ที่ "ต้องชำระตามกำหนด" (ไม่มีเครดิตเทอม) — ต้องมีเงินสดจ่ายตามรอบเดือน
#   labor = ค่าจ้าง/ค่าตอบแทน · util = สาธารณูปโภค · rent = ค่าเช่า (เจ้าของงานยืนยัน 6 ส.ค. 69: ค้างไม่ได้)
# ที่เหลือ (med/mat/rep/svc/oth) เป็นสินค้า/บริการที่ผู้ขายให้เครดิต ค้างเป็นเจ้าหนี้การค้าได้
#   วัดจากงบ 256909: เจ้าหนี้การค้าค้างชำระมัธยฐาน 4.72 เดือน vs คชจ.ค้างจ่าย 1.84 เดือน (ดู 3.13)
# ⚠️ ธงนี้เป็นฐานของ "เงินสำรอง MOE" (× 3 เดือน) — เพิ่ม/ลดกลุ่มแล้วต้องรีรัน export_exec.py
#    และแก้ค่าคาดหวังใน test_exec_model.js 3.5 + test_moe_ver.js ด้วย
MOE_CASH_G = ("labor", "util", "rent")

# ── เจ้าหนี้/ลูกหนี้ค่ารักษาตามจ่าย (root 13 หลัก) ──
TJ_PAY_IN  = {"2101020199.202"}                      # เจ้าหนี้ OP-UC นอก CUP ในจังหวัดสังกัด สธ.
TJ_PAY_OUT = {"2101020199.203"}                      # เจ้าหนี้ OP-UC นอก CUP ต่างจังหวัดสังกัด สธ.
TJ_AR_IN   = {"1102050101.203", "1102050194.204"}    # ลูกหนี้ UC-OP นอก CUP ในจังหวัด
TJ_AR_OUT  = {"1102050101.204", "1102050194.205"}    # ลูกหนี้ UC-OP นอก CUP ต่างจังหวัด

# ══ MOE นิยามทางการกองเศรษฐกิจสุขภาพ — เลือกได้ 2 เวอร์ชันที่หน้าเว็บ ══
#
# MOE.Ver69 = 59 บัญชี ← **ค่าเริ่มต้น** (CFO กำหนด 6 ส.ค. 69) = MOE_GROUPS ด้านล่างนี้
# MOE.Ver68 = 62 บัญชี (ชุดเดิม 14 ก.ค. 69) = Ver69 − MOE_V69_ONLY + MOE_V68_EXTRA
#   ต่างกัน 5 บัญชี: Ver68 มีค่าจ้างชั่วคราว(บริการ) + ค่าตอบแทนไม่ทำเวชปฏิบัติชุดรหัสเดิม 3 ตัว
#                    Ver69 มีค่าเช่าเบ็ดเตล็ดเพิ่ม (กลุ่มใหม่ "ค่าเช่า")
#
# ⚠️ MOE_ACC (= Ver69) เป็นชุดที่ export_risk_link.py import ไปคิด `moeMo` ใน summary.json
#    → คอลัมน์ "เงินสดพอจ่าย MOE" ใน Watchlist จึงเป็น Ver69 ตรงกับค่าเริ่มต้นของ #exec
#    (กติกาเหล็ก 3.6: สองหน้าต้องเป็นตัวเลขชุดเดียวกัน) — สลับเวอร์ชันได้เฉพาะฝั่ง #exec
#
# map ชื่อบัญชี → root GL ตรวจกับผังชื่อบัญชี (acc_names_region/prov) แล้วครบทั้งสองชุด
# หมายเหตุ: ไม่มีเงินเดือนข้าราชการ (จ่ายจากงบประมาณ ไม่ใช่เงินบำรุง) และไม่มีค่ารักษาตามจ่าย
MOE_GROUPS = [
    ("labor", "ค่าจ้างชั่วคราว/พกส./ค่าตอบแทน", [
        "5101010113.104",                                # ค่าจ้างชั่วคราว (สนับสนุน)
        "5101010113.105", "5101010113.106",              # ค่าจ้าง พกส. (บริการ/สนับสนุน)
        "5101010199.103",                                # ค่าตอบแทนเวร/ผลัดบ่าย-ดึก พยาบาล
        "5101020114.114",                                # พ.ต.ส./ค.ต.ส. (เงินนอกงบประมาณ)
        "5104040102.101", "5104040102.102", "5104040102.103",  # ไม่ทำเวชปฏิบัติ แพทย์/ทันตะ/เภสัช
    ]),
    ("mat", "วัสดุทั่วไปใช้ไป", [
        "5104010104.101", "5104010104.102", "5104010104.103", "5104010104.104",
        "5104010104.105", "5104010104.106", "5104010104.107", "5104010104.108",
        "5104010104.109",                                # สำนักงาน…สินค้าใช้ไป
    ]),
    ("rep", "ซ่อมแซม/บำรุงรักษา", [
        "5104010107.101", "5104010107.102", "5104010107.103", "5104010107.104",
        "5104010107.105", "5104010107.106", "5104010107.107", "5104010107.108",
        "5104010107.109", "5104010107.110", "5104010107.111", "5104010107.112",
        "5104010107.113",                                # ซ่อมอาคาร…จ้างเหมาซ่อมบ้านพัก
    ]),
    ("svc", "จ้างเหมาบริการ/เชื้อเพลิง", [
        "5104010110.101",                                # ค่าเชื้อเพลิง
        "5104010112.101", "5104010112.103", "5104010112.106", "5104010112.108",
        "5104010112.110", "5104010112.111", "5104010112.112", "5104010112.113",
        "5104010112.114", "5104010112.115",              # ทำความสะอาด…Lab/X-Ray
    ]),
    ("rent", "ค่าเช่า", [
        "5104030212.101",                                # ค่าเช่าเบ็ดเตล็ด (มีเฉพาะ Ver69)
    ]),
    ("util", "สาธารณูปโภค", [
        "5104020101.101", "5104020103.101", "5104020105.101",
        "5104020106.101", "5104020107.101",              # ไฟฟ้า/น้ำ/โทรศัพท์/สื่อสาร/ไปรษณีย์
    ]),
    ("med", "ยาและเวชภัณฑ์ใช้ไป", [
        "5104030205.101", "5104030205.102", "5104030205.103", "5104030205.104",
        "5104030205.112", "5104030205.113", "5104030205.117", "5104030205.118",
    ]),
    ("oth", "ครุภัณฑ์ต่ำกว่าเกณฑ์/โครงการ P&P", [
        "5104030206.101",                                # ครุภัณฑ์มูลค่าต่ำกว่าเกณฑ์
        "5104030299.102", "5104030299.502", "5104030299.701",  # โครงการ (UC)(PP)/ต่างด้าว/สถานะสิทธิ
    ]),
]
MOE_ACC = {a: gid for gid, _, accs in MOE_GROUPS for a in accs}          # Ver69 (ค่าเริ่มต้น · 59 บัญชี)

# ── ส่วนต่าง Ver68 ↔ Ver69 (ชุดเดียวในระบบ — หน้าเว็บสลับเวอร์ชันจากยอดที่ export ไปให้) ──
# บัญชีที่อยู่ใน Ver68 แต่ไม่อยู่ใน Ver69 (ค่า = กลุ่มที่จะเอาไปรวมเมื่อเลือก Ver68)
MOE_V68_EXTRA = {
    "5101010113.103": "labor",                           # ค่าจ้างชั่วคราว(บริการ)
    "5104040199.106": "labor",                           # ไม่ทำเวชปฏิบัติ แพทย์ (ชุดรหัสเดิม)
    "5104040199.107": "labor",                           # ไม่ทำเวชปฏิบัติ ทันตแพทย์ (ชุดรหัสเดิม)
    "5104040199.108": "labor",                           # ไม่ทำเวชปฏิบัติ เภสัชกร (ชุดรหัสเดิม)
}
# บัญชีที่อยู่ใน Ver69 แต่ไม่อยู่ใน Ver68
MOE_V69_ONLY = {"5104030212.101"}                        # ค่าเช่าเบ็ดเตล็ด
MOE_ACC68 = {**{a: g for a, g in MOE_ACC.items() if a not in MOE_V69_ONLY}, **MOE_V68_EXTRA}

# ── บัญชีที่ "ยืดเป็นเจ้าหนี้การค้าได้" — ฐานของตัวเลือก Ver69 + จ่ายหนี้การค้า X% ══
# 9 บัญชี (ยา/เวชภัณฑ์ 8 + ครุภัณฑ์มูลค่าต่ำกว่าเกณฑ์ 1) ที่ CFO กำหนด 6 ส.ค. 69
# หน้าเว็บใช้ยอดชุดนี้คิด "ส่วนที่เลือกไม่จ่ายเงินสด" → ค้างเป็นเจ้าหนี้การค้า (หนี้สินหมุนเวียนโต)
# ⚠️ ไม่กระทบ NI: ค่าใช้จ่ายยังรับรู้เต็มตามเกณฑ์คงค้าง เปลี่ยนแค่ "จ่ายเงินสดหรือค้างไว้"
MOE_PAY9 = {
    "5104030205.101", "5104030205.102", "5104030205.103", "5104030205.104",
    "5104030205.112", "5104030205.113", "5104030205.117", "5104030205.118",
    "5104030206.101",
}

# ── แยก OP/IP/PP จากชื่อบัญชี (⚠️ ร่างเองจาก keyword — รอ CFO review) ──
RE_PP = re.compile(r"P\s*&\s*P|(?<![A-Za-z])PP(?![A-Za-z])|สร้างเสริม|ส่งเสริมสุขภาพ")
RE_IP = re.compile(r"(?<![A-Za-z])IP(?![A-Za-z])|ผู้ป่วยใน|\bDRG\b", re.I)
RE_OP = re.compile(r"(?<![A-Za-z])OP(?![A-Za-z])|ผู้ป่วยนอก")
def opip_of(name):
    n = name or ""
    if RE_PP.search(n): return "pp"
    if RE_IP.search(n): return "ip"
    if RE_OP.search(n): return "op"
    return "oth"

def main():
    conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")
    items = pd.read_sql("SELECT RatioItemID,CodeL1 FROM ratio_items WHERE UseYN='Yes' "
                        "AND RatioItemID IN ('3006Y','3010X','1001Y')", conn)
    # 1003X = เงินสดและรายการเทียบเท่าเงินสด (ตัวเศษ Cash ratio) — ดึงชื่อบัญชีจากผัง acc_hierarchy
    # สำหรับ tooltip "ที่มา" ในตารางผลจำลอง (แสดงว่าเงินสดมาจากบัญชีอะไรบ้าง) — ผันแปรตามผังจริงเสมอ
    cash_df = pd.read_sql(
        "SELECT r.CodeL1 AS code, h.Account1 AS nm, h.Name2 AS grp "
        "FROM ratio_items r JOIN acc_hierarchy h ON h.CodeL1=r.CodeL1 "
        "WHERE r.RatioItemID='1003X' AND r.UseYN='Yes' ORDER BY r.CodeL1", conn)
    conn.close()
    rev_codes = set(items.loc[items.RatioItemID == "3006Y", "CodeL1"])
    exp_codes = set(items.loc[items.RatioItemID == "3010X", "CodeL1"])
    cl_codes  = set(items.loc[items.RatioItemID == "1001Y", "CodeL1"])

    names = {}
    for p in (NAME_J, NAME_P):
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                names.update(json.load(f))

    with open(META_J, encoding="utf-8") as f:
        meta = json.load(f)
    orgs = {o["id"]: o for o in meta["orgs"]}
    with open(SUM_J, encoding="utf-8") as f:
        summ = json.load(f)
    srisk = {h["hcode"]: h for h in summ["hospitals"]}

    m = pd.read_parquet(MASTER, columns=["org5", "t", "acc", "bs"])
    m = m[m["org5"].isin(orgs)].copy()
    tmax = int(m["t"].max())
    # ── ค่าเฉลี่ยย้อนหลังของหนี้ตามจ่าย (เจ้าของงานสั่ง 13 ส.ค. 69 · คู่มือ 7.32) ────────────
    # ใช้ตอบคำถาม "ยอดงวดนี้ผิดปกติไหม" — เทียบยอดคงเหลือปัจจุบันกับค่าเฉลี่ยของตัวเอง
    # ⚠️ หน้าต่าง 12 งวด: วัดแล้วนิ่งพอ ๆ กับ 3/6 งวด แต่ 24 งวดยาวเกินจนโดนเทรนด์ขาขึ้นลาก
    #    (ทั้งเขต: ฐาน 3 งวด +31.2M · 6 งวด +44.5M · 12 งวด +48.8M · แต่ 24 งวด +87.0M)
    # ⚠️ รวม "ต่างจังหวัด" ด้วย (payOut/arOut) ต่างจากคอลัมน์สายเลขคณิตที่ใช้เฉพาะในจังหวัด
    #    → เป็นภาพ "สังกัด สธ. ทั้งหมด" ตามที่เจ้าของงานถาม
    TJ_HIST_WIN = 12
    tj_hist = {}
    try:
        _r = m["acc"].map(acc_root)
        _ap, _ar = TJ_PAY_IN | TJ_PAY_OUT, TJ_AR_IN | TJ_AR_OUT
        _d = m[_r.isin(_ap | _ar)].copy()
        _d["k"] = _r[_d.index].map(lambda x: "ap" if x in _ap else "ar")
        _ts = sorted(t for t in _d["t"].unique() if int(t) < tmax)[-TJ_HIST_WIN:]
        _d = _d[_d["t"].isin(_ts)]
        _g = _d.pivot_table(index=["org5", "t"], columns="k", values="bs", aggfunc="sum").fillna(0.0)
        for _o, _gg in _g.groupby(level=0):
            tj_hist[_o] = {"apAvg": round(float(_gg["ap"].mean()) if "ap" in _gg else 0.0, 0),
                           "arAvg": round(float(_gg["ar"].mean()) if "ar" in _gg else 0.0, 0),
                           "avgN": int(len(_gg))}
        print(f"  tj history: {len(tj_hist)} แห่ง × {len(_ts)} งวด ({_ts[0]}–{_ts[-1]})" if _ts else "  tj history: ไม่มีงวดย้อนหลัง")
    except Exception as e:                      # ⛔ ห้ามล้มไพป์ไลน์เพราะฟีเจอร์เสริม (CLAUDE.md ข้อ 3)
        print(f"  ⚠️ tj history ไม่สำเร็จ ({e}) — คอลัมน์จำลองจะว่าง ส่วนอื่นไม่กระทบ")
        tj_hist = {}
    m = m[m["t"] == tmax].copy()
    m["root"] = m["acc"].map(acc_root)

    hosp, ni_bad = [], []
    for org5, g in m.groupby("org5"):
        hp = os.path.join(H_DIR, f"{org5}.json")
        if not os.path.exists(hp): continue
        with open(hp, encoding="utf-8") as f:
            h = json.load(f)
        t = h["trend"][-1] if h.get("trend") else None
        if not t or t.get("cl") is None or t.get("e33y") is None or int(t["t"]) != tmax:
            print(f"  skip {org5} {h.get('name')}: งวดล่าสุดไม่พอ/ไม่ตรง {t and t.get('t')}")
            continue
        mo = int(t["t"]) % 100
        # ── rev ราย P × op/ip/pp/oth · exp ราย P · MOE ทางการรายกลุ่ม ──
        # moe   = Ver69 (ค่าเริ่มต้น) · moe68 = Ver68 (ชุดเดิม) · moeP9 = ส่วนที่ยืดเป็นเจ้าหนี้การค้าได้
        rev, exp, moe, moe68, moe_p9 = {}, {}, {}, {}, {}
        ni_chk = 0.0
        for root, gg in g.groupby("root"):
            v = float(gg["bs"].sum())
            if abs(v) < 1: continue
            if root in rev_codes:
                p = planfin_code(root)
                seg = opip_of(names.get(root, ""))
                rev.setdefault(p, {"op": 0, "ip": 0, "pp": 0, "oth": 0})
                rev[p][seg] = round(rev[p][seg] + v, 0)
                ni_chk += v
            elif root in exp_codes:
                p = planfin_code(root)
                exp[p] = round(exp.get(p, 0) + v, 0)
                ni_chk -= v
                gid = MOE_ACC.get(root)
                if gid:
                    moe[gid] = round(moe.get(gid, 0) + v, 0)
                    if root in MOE_PAY9: moe_p9[gid] = round(moe_p9.get(gid, 0) + v, 0)
                g68 = MOE_ACC68.get(root)
                if g68: moe68[g68] = round(moe68.get(g68, 0) + v, 0)
        # ── ตามจ่าย ──
        def bal(roots):
            return round(float(g.loc[g["root"].isin(roots), "bs"].sum()), 0)
        tj = {"payIn": bal(TJ_PAY_IN), "payOut": bal(TJ_PAY_OUT),
              "arIn": bal(TJ_AR_IN),  "arOut": bal(TJ_AR_OUT)}
        tj.update(tj_hist.get(org5, {"apAvg": None, "arAvg": None, "avgN": 0}))
        # ── เงินรับโอนจากหน่วยงานในสังกัด (แท็กจาก rev ที่มีอยู่แล้ว ไม่บวกซ้ำ) ──
        trf = {"op": bal(TRF_OP), "inv": bal(TRF_INV)}
        # ── หนี้สินหมุนเวียนแยก 4 ถัง (ฐานคำนวณเงินสำรอง MOE — ดู cl_bucket ด้านบน) ──
        clb = {"trade": 0.0, "accr": 0.0, "tj": 0.0, "oth": 0.0}
        for root, gg in g[g["root"].isin(cl_codes)].groupby("root"):
            clb[cl_bucket(root)] += float(gg["bs"].sum())
        # ── ตรวจ NI สอดคล้อง ──
        if abs(ni_chk - float(t["ni"])) > 5:
            ni_bad.append(f"{org5} {h.get('name')}: Σrev−Σexp={ni_chk:,.0f} ≠ t.ni={t['ni']:,.0f}")
        # ── หนี้สินหมุนเวียนโตเฉลี่ย/เดือน จาก trend ปีงบเดียวกัน (ด.1 → งวดล่าสุด) ──
        # ใช้ค่าจริงของแต่ละ รพ. เอง ไม่ใช่ค่ากลางทั้งเขต · ถ้าข้อมูลไม่พอให้เป็น 0 (= พฤติกรรมเดิม)
        fy_now = int(t["t"]) // 100
        tr_all = h.get("trend") or []
        tr_fy = [r for r in tr_all
                 if r.get("cl") is not None and r.get("t") is not None and int(r["t"]) // 100 == fy_now]
        tr_fy.sort(key=lambda r: int(r["t"]))
        cl_mo = 0.0
        if len(tr_fy) >= 2:
            span = (int(tr_fy[-1]["t"]) % 100) - (int(tr_fy[0]["t"]) % 100)
            if span >= 1:
                cl_mo = round((float(tr_fy[-1]["cl"]) - float(tr_fy[0]["cl"])) / span, 0)
        # ── ปัจจัยฤดูกาลปลายปีงบ niYE/clYE — วัดจาก trend จริงของแต่ละแห่ง (ปี YE_FY) ──
        # 🚨 เพิ่มเข้าไพป์ไลน์ 11 ส.ค. 69 — เดิมค่าสองตัวนี้ถูกยัดมือลง exec.json งวด 256909
        #    เท่านั้น (commit b345a64 แก้ไพป์ไลน์แค่ clMo) พอ export งวด 256910 คีย์เลยหายทั้ง
        #    103 แห่ง → ปัจจัยฤดูกาลกลายเป็น no-op เงียบ ๆ และเงินสนับสนุนเป้า 6 ต่ำไป
        #    50.85 เทียบ 83.15 ลบ. — ห้ามถอดออกอีก มี guard ท้ายไฟล์ + test_exec_backtest คุมไว้
        #   niYE = ส่วนต่างของ NI ต่อเดือนช่วงปิดบัญชี (ด.10-12) เทียบ run-rate ต้นปี (ด.1-9)
        #          → หน้าเว็บเอาไป "บวกเพิ่ม" จาก niM ในเดือน ด.≥10 จึงต้องเป็นส่วนต่าง ไม่ใช่ระดับ
        #   clYE = อัตราโตหนี้สินหมุนเวียนต่อเดือนช่วงปิดบัญชี → หน้าเว็บใช้ "แทนที่" clMo (ไม่ใช่บวก)
        ye_ni, ye_cl = [], []
        for fy in YE_FY:
            a = next((r for r in tr_all if r.get("t") == fy * 100 + 9), None)
            c = next((r for r in tr_all if r.get("t") == fy * 100 + 12), None)
            if not a or not c: continue
            if a.get("ni") is not None and c.get("ni") is not None:
                ye_ni.append((float(c["ni"]) - float(a["ni"])) / 3 - float(a["ni"]) / 9)
            if a.get("cl") is not None and c.get("cl") is not None:
                ye_cl.append((float(c["cl"]) - float(a["cl"])) / 3)
        ni_ye = round(sum(ye_ni) / len(ye_ni), 0) if ye_ni else 0.0
        cl_ye = round(sum(ye_cl) / len(ye_cl), 0) if ye_cl else 0.0   # 0 → หน้าเว็บถอยไปใช้ clMo เอง
        # ── โปรไฟล์ NI รายเดือน (ดูบล็อกอธิบายที่ PROF_FY) ──────────────────────────────
        # NI ใน trend เป็น "ยอดสะสมในปีงบ" → NI ของเดือน m = ผลต่างกับเดือน m−1 (เดือน 1 = ยอดเอง)
        # เท่ากับคอลัมน์ความเคลื่อนไหวในงบทดลองเป๊ะ (ตรวจแล้ว 12 ส.ค. 69: ต่างสูงสุด 0.01 ลบ.)
        prof_rows = []
        for fy in PROF_FY:
            ytd = {int(r["t"]) % 100: float(r["ni"]) for r in tr_all
                   if r.get("ni") is not None and int(r["t"]) // 100 == fy}
            if len(ytd) < 12: continue                     # ต้องครบ 12 เดือน ไม่งั้นค่าเฉลี่ยเบ้
            mm = [ytd[1]] + [ytd[m] - ytd[m - 1] for m in range(2, 13)]
            avg = sum(mm) / 12.0
            prof_rows.append([v - avg for v in mm])        # ส่วนต่างจากค่าเฉลี่ยปีนั้น (ผลรวม = 0)
        ni_prof = ([round(sum(c) / len(prof_rows), 0) for c in zip(*prof_rows)]
                   if prof_rows else [0.0] * 12)
        # ── โปรไฟล์ CL รายเดือน (เจ้าของงานสั่ง 12 ส.ค. 69 · เหตุผลเดียวกับ niProf) ──────
        # NWC = CA − CL · CA เดินตามกระแสเงินสด ส่วน CL เดินตาม clMo ซึ่งเป็น "ค่าเฉลี่ยแบน"
        # → NWC จึงแบนตาม เป็นข้อผิดเดียวกับที่ NI เคยเป็น (clYE = แพตช์บล็อก 3 เดือน แบบเดียวกับ niYE)
        # วัดจริงทั้งเขต: ธ.ค. +114 · พ.ค. −106 · มี.ค. −104 ลบ. = ไม่แบนเลย
        # ⚠️ cl เป็น "ยอดคงเหลือ" ไม่ใช่ยอดสะสมในปีงบ → เดือน 1 ต้องเทียบกับ ด.12 ของปีก่อน
        #    (ต่างจาก ni ที่รีเซ็ตทุก 1 ต.ค. จึงใช้ยอดตัวเองได้เลย) — พลาดตรงนี้โปรไฟล์จะเบ้ทั้งชุด
        cl_rows = []
        for fy in PROF_FY:
            y = {int(r["t"]) % 100: r for r in tr_all
                 if r.get("cl") is not None and int(r["t"]) // 100 == fy}
            prev12 = next((r for r in tr_all if r.get("t") == (fy - 1) * 100 + 12
                           and r.get("cl") is not None), None)
            if len(y) < 12 or not prev12: continue
            mm = [float(y[m]["cl"]) - float(prev12["cl"] if m == 1 else y[m - 1]["cl"])
                  for m in range(1, 13)]
            avg = sum(mm) / 12.0
            cl_rows.append([v - avg for v in mm])
        cl_prof = ([round(sum(c) / len(cl_rows), 0) for c in zip(*cl_rows)]
                   if cl_rows else [0.0] * 12)
        # ── โปรไฟล์ "การเปลี่ยนแปลงเงินทุนหมุนเวียน" รายเดือน (12 ส.ค. 69 · เจ้าของงานสั่ง) ──────
        # กรอบบัญชี: งบกระแสเงินสดวิธีทางอ้อม บรรทัดที่โมเดลขาดไปคือ
        #   ± การเปลี่ยนแปลงลูกหนี้การค้า  ± การเปลี่ยนแปลงสินค้าคงเหลือ
        # ของเดิมบวกกำไรทั้งก้อนเข้า "เงินสด" ตรง ๆ = สมมติว่าเก็บเงินสดได้ทันที 100%
        # ทั้งที่ลูกหนี้+สินค้าคงเหลือ = 54% ของสินทรัพย์หมุนเวียนทั้งเขต
        # แยก 3 ถังจากตัวเลขที่มีอยู่แล้ว (ไม่ต้องดึงบัญชีเพิ่ม):
        #   เงินสดและรายการเทียบเท่า = cn (1003X)
        #   ลูกหนี้ + สินทรัพย์เร็วอื่น = qn − cn (1002X − 1003X)
        #   สินค้าคงเหลือ + อื่น ๆ    = ca − qn (1001X − 1002X)
        # ⚠️ ยอดคงเหลือ ไม่ใช่ยอดสะสมปีงบ → เดือน 1 ต้องเทียบ ด.12 ปีก่อน (เหมือน cl_prof)
        def _bucket_prof(getter):
            rows = []
            for fy in PROF_FY:
                y = {int(r["t"]) % 100: r for r in tr_all
                     if int(r["t"]) // 100 == fy and r.get("ca") is not None
                     and r.get("qn") is not None and r.get("cn") is not None}
                p12 = next((r for r in tr_all if r.get("t") == (fy - 1) * 100 + 12
                            and r.get("ca") is not None and r.get("qn") is not None
                            and r.get("cn") is not None), None)
                if len(y) < 12 or not p12: continue
                mm = [getter(y[m]) - getter(p12 if m == 1 else y[m - 1]) for m in range(1, 13)]
                avg = sum(mm) / 12.0
                rows.append([v - avg for v in mm])
            return ([round(sum(c) / len(rows), 0) for c in zip(*rows)] if rows else [0.0] * 12)

        ar_prof  = _bucket_prof(lambda r: float(r["qn"]) - float(r["cn"]))
        inv_prof = _bucket_prof(lambda r: float(r["ca"]) - float(r["qn"]))
        s = srisk.get(org5, {})
        grp = h.get("grp") or ""
        typ = "รพศ." if grp.startswith("รพศ.") else ("รพท." if grp.startswith("รพท.") else "รพช.")
        hosp.append({
            "hcode": org5, "name": h.get("name"), "prov": h.get("prov"),
            "grp": grp, "type": typ, "cls": h.get("typeSer"), "bed": h.get("bed"),
            "risk": s.get("risk"),
            # ที่มาของคะแนน: "rep" = ค่าที่ รพ. รายงานเข้า risk_scores (ทางการ) · "gl" = คำนวณจากงบทดลอง
            # ⚠️ สำคัญต่อการสื่อสาร: งวดที่ risk_scores ยังไม่มีข้อมูล (เช่น 256909) ทุกแห่งจะเป็น "gl"
            # หน้าเว็บต้องไม่เรียกว่า "ทางการ" ในกรณีนั้น (ดู RISK_EXEC_MODEL.md หัวข้อ 1)
            "src": s.get("source"),
            "bs": {"t": int(t["t"]), "mo": mo, "ca": t["ca"], "cl": t["cl"], "qn": t["qn"],
                   "cn": t["cn"], "ni": t["ni"],
                   # non-cash/เดือน = ค่าเสื่อม+ตัดจำหน่าย+หนี้สูญ (ดูเหตุผลที่ NONCASH_P ด้านบน)
                   "depMo": round(max(0.0, sum(v for p, v in exp.items() if p in NONCASH_P) / mo), 0),
                   # clMo = หนี้สินหมุนเวียนโตเฉลี่ยกี่บาท/เดือน (run-rate ปีงบนี้ ด.1 → งวดล่าสุด)
                   # ⚠️ เพิ่ม 6 ส.ค. 69 หลัง backtest พบว่าโมเดลเดิม "ตรึง CL คงที่" ทำให้ CR/QR/Cash
                   #    ดีขึ้นเองโดยอัตโนมัติ และทำนายผิดทิศ: ปี 67/68 จริงระดับแย่ลง แต่โมเดลว่าดีขึ้น
                   #    วัดความลำเอียงแล้ว run-rate ดีกว่าตรึง (ปี 68: −7.3% → −2.8%)
                   "clMo": cl_mo,
                   # ปัจจัยฤดูกาลปลายปีงบรายแห่ง (ดูบล็อกคำนวณด้านบน + guard ท้าย main())
                   "niYE": ni_ye, "clYE": cl_ye,
                   # niProf[0..11] = ส่วนต่าง NI รายเดือน ต.ค.→ก.ย. เทียบค่าเฉลี่ยทั้งปี (ผลรวม = 0)
                   # หน้าเว็บใช้แทน niYE ทั้งหมด และหักค่าเฉลี่ยของเดือนที่ผ่านมาแล้วออกเพื่อกันนับซ้ำ
                   "niProf": ni_prof,
                   # clProf[0..11] = ส่วนต่างการโตของหนี้สินหมุนเวียนรายเดือน (ผลรวม = 0)
                   # ใช้คู่กับ clMo แบบเดียวกับที่ niProf ใช้คู่กับ run-rate ของ NI
                   "clProf": cl_prof,
                   # การเปลี่ยนแปลงเงินทุนหมุนเวียนรายเดือน (ผลรวม 12 ด. = 0 ทั้งคู่)
                   #   arProf  = ลูกหนี้ + สินทรัพย์หมุนเวียนเร็วอื่น
                   #   invProf = สินค้าคงเหลือ + สินทรัพย์หมุนเวียนอื่น
                   "arProf": ar_prof, "invProf": inv_prof,
                   # รายได้ไม่ใช่เงินสด/เดือน = รับบริจาคสินทรัพย์ (หักออกจากกระแสเงินสด ดู NONCASH_REV)
                   "donMo": round(max(0.0, bal(NONCASH_REV) / mo), 0),
                   # เจ้าหนี้แยกถัง (ฐานเงินสำรอง MOE · ดู cl_bucket + RISK_EXEC_MODEL.md 3.13)
                   #   apAccr  = คชจ.บุคลากร/สาธารณูปโภค "ค้างจ่าย" — ครบกำหนดแล้ว ต้องมีเงินสดจ่าย
                   #             → เข้าเงินสำรองเต็มจำนวน
                   #   apTrade = เจ้าหนี้การค้า — ผู้ขายให้เครดิตอยู่ ไม่เข้าเงินสำรอง
                   #             (และถูกนับเป็นตัวส่วนของ CR/QR/Cash ratio อยู่แล้ว จะนับซ้ำ)
                   "apAccr": round(max(0.0, clb["accr"]), 0),
                   "apTrade": round(max(0.0, clb["trade"]), 0)},
            "rev": rev, "exp": exp, "moe": moe, "moe68": moe68, "moeP9": moe_p9,
            "tj": tj, "trf": trf,
        })

    # meta กลุ่ม MOE พร้อมรหัส+ชื่อบัญชี (ให้หน้าเว็บแสดง "ที่มา" ตรวจสอบได้รายบัญชี)
    # cash=True → กลุ่มที่ "ยืดไม่ได้" (ค่าจ้าง/ค่าตอบแทน/สาธารณูปโภค) ต้องมีเงินสดจ่ายตามรอบเดือน
    # หน้าเว็บใช้ธงนี้คิดเงินสำรอง MOE — ห้าม hardcode รายชื่อกลุ่มซ้ำใน risk_drill.html
    # accs = ชุด Ver69 (ค่าเริ่มต้น) · accs68 = ชุด Ver68 · p9 = บัญชีที่ยืดเป็นเจ้าหนี้การค้าได้
    def acc_list(accs):
        return [{"a": a, "n": names.get(a, "?")} for a in accs]
    moe_meta = [{"id": gid, "name": gname, "cash": gid in MOE_CASH_G,
                 "accs": acc_list(accs),
                 "accs68": acc_list([a for a in sorted(MOE_ACC68) if MOE_ACC68[a] == gid]),
                 "p9": acc_list([a for a in accs if a in MOE_PAY9])}
                for gid, gname, accs in MOE_GROUPS]
    # meta เวอร์ชัน MOE ให้หน้าเว็บทำ dropdown ได้เองโดยไม่ hardcode จำนวนบัญชี
    moe_vers = {"def": "69",
                "n69": len(MOE_ACC), "n68": len(MOE_ACC68), "nP9": len(MOE_PAY9),
                "v69only": sorted(MOE_V69_ONLY), "v68only": sorted(MOE_V68_EXTRA)}
    # cashDef: ที่มาบัญชีของ "เงินสดและรายการเทียบเท่าเงินสด" (bs.cn) จัดกลุ่มตาม Name2 ของผัง
    cash_df = cash_df.drop_duplicates("code")
    cash_groups = [{"g": gname, "accs": [{"a": r.code, "n": r.nm} for _, r in gdf.iterrows()]}
                   for gname, gdf in cash_df.groupby("grp", sort=False)]
    cash_def = {"item": "เงินสดและรายการเทียบเท่าเงินสด (ตัวเศษ Cash ratio · RatioItemID 1003X ตามผัง)",
                "n": int(cash_df.shape[0]), "groups": cash_groups}
    # 🏦 เงินของเขตที่ฝากไว้ — ส่งเป็นก้อนระดับไฟล์ (หน้าเว็บใช้ทั้งหักออกและเป็นแหล่งเงินเติม)
    reg_dep = {k: v for k, v in REGION_DEPOSIT.items() if any(x["hcode"] == k for x in hosp)}
    _miss = [k for k in REGION_DEPOSIT if k not in reg_dep]
    if _miss:
        raise SystemExit(f"❌ REGION_DEPOSIT อ้าง hcode ที่ไม่มีใน exec.json: {_miss}")
    print(f"🏦 เงินเขตฝากไว้ {len(reg_dep)} แห่ง รวม {sum(reg_dep.values())/1e6:,.1f} ลบ. "
          + " · ".join(f"{next(x['name'] for x in hosp if x['hcode']==k)} {v/1e6:,.1f}"
                       for k, v in reg_dep.items()))
    out = {"period": tmax, "periodLabel": summ.get("periodLabel"), "monthsElapsed": tmax % 100,
           "regionDep": reg_dep,
           "pn": PN, "revOrder": REV_ORDER, "expOrder": EXP_ORDER,
           "moeGroups": moe_meta, "moeVers": moe_vers, "cashDef": cash_def, "hosp": hosp}
    # ══ 🚨 GUARD: ปัจจัยฤดูกาลต้องมีจริงก่อนเขียนไฟล์ ══════════════════════════════════
    # เคสจริง 11 ส.ค. 69: คีย์ niYE/clYE หายทั้งชุดตอนเดินงวด 256910 แล้ว "ไม่มีอะไรพัง" —
    # หน้าเว็บยังเรนเดอร์ปกติ สวิตช์ 📉 ยังกดได้ แต่เป็น no-op และเงินสนับสนุนต่ำไป 39%
    # จึงต้องล้มที่ไพป์ไลน์ ไม่ใช่ปล่อยให้ไปโผล่เป็นตัวเลขผิดบนหน้าเว็บ
    n_ye = sum(1 for x in hosp if x["bs"].get("niYE"))
    ni_ye_tot = sum(x["bs"].get("niYE") or 0 for x in hosp)
    if hosp and n_ye < len(hosp) * 0.8:
        raise SystemExit(f"❌ ปัจจัยฤดูกาล niYE มีแค่ {n_ye}/{len(hosp)} แห่ง — "
                         f"ตรวจ trend ปี {YE_FY} ใน h/*.json ก่อน (ห้ามเขียน exec.json ทับ)")
    # เหตุผลเดียวกับ niYE: โปรไฟล์หาย = หน้าเว็บกลับไปแบนเงียบ ๆ ไม่มีอะไรพังให้เห็น
    n_pf = sum(1 for x in hosp if any(x["bs"].get("niProf") or []))
    if hosp and n_pf < len(hosp) * 0.8:
        raise SystemExit(f"❌ โปรไฟล์ NI รายเดือน niProf มีแค่ {n_pf}/{len(hosp)} แห่ง — "
                         f"ตรวจ trend ปี {PROF_FY} ใน h/*.json ก่อน (ห้ามเขียน exec.json ทับ)")
    _pf_bad = [x["hcode"] for x in hosp
               if abs(sum(x["bs"].get("niProf") or [0])) > max(1000.0, abs(x["bs"]["ni"]) * 1e-4)]
    if _pf_bad:
        raise SystemExit(f"❌ niProf ผลรวม 12 เดือนต้องเป็น 0 (เป็นการกระจายตัว ไม่ใช่การเพิ่มยอด) "
                         f"— ผิด {len(_pf_bad)} แห่ง เช่น {_pf_bad[:5]}")
    n_cf = sum(1 for x in hosp if any(x["bs"].get("clProf") or []))
    if hosp and n_cf < len(hosp) * 0.8:
        raise SystemExit(f"❌ โปรไฟล์ CL รายเดือน clProf มีแค่ {n_cf}/{len(hosp)} แห่ง — "
                         f"ตรวจ trend ปี {PROF_FY} + งวด ด.12 ของปีก่อนหน้า ใน h/*.json ก่อน")
    _cf_bad = [x["hcode"] for x in hosp
               if abs(sum(x["bs"].get("clProf") or [0])) > max(1000.0, abs(x["bs"]["cl"]) * 1e-4)]
    if _cf_bad:
        raise SystemExit(f"❌ clProf ผลรวม 12 เดือนต้องเป็น 0 — ผิด {len(_cf_bad)} แห่ง เช่น {_cf_bad[:5]}")
    for _k, _lab in (("arProf", "ลูกหนี้"), ("invProf", "สินค้าคงเหลือ")):
        _n = sum(1 for x in hosp if any(x["bs"].get(_k) or []))
        if hosp and _n < len(hosp) * 0.8:
            raise SystemExit(f"❌ โปรไฟล์เงินทุนหมุนเวียน {_k} ({_lab}) มีแค่ {_n}/{len(hosp)} แห่ง")
        _bad = [x["hcode"] for x in hosp
                if abs(sum(x["bs"].get(_k) or [0])) > max(1000.0, abs(x["bs"]["ca"]) * 1e-4)]
        if _bad:
            raise SystemExit(f"❌ {_k} ผลรวม 12 เดือนต้องเป็น 0 — ผิด {len(_bad)} แห่ง เช่น {_bad[:5]}")
        _t = [sum(x["bs"][_k][i] for x in hosp) / 1e6 for i in range(12)]
        print(f"โปรไฟล์{_lab}รายเดือน ({_k}) ทั้งเขต ลบ./ด.: " + " ".join(f"{v:,.0f}" for v in _t))
    _cf_tot = [sum(x["bs"]["clProf"][i] for x in hosp) / 1e6 for i in range(12)]
    print("โปรไฟล์ CL รายเดือน (clProf) ทั้งเขต ลบ./ด. ต.ค.→ก.ย.: "
          + " ".join(f"{v:,.0f}" for v in _cf_tot))
    _pf_tot = [sum(x["bs"]["niProf"][i] for x in hosp) / 1e6 for i in range(12)]
    print("โปรไฟล์ NI รายเดือน (niProf) ทั้งเขต ลบ./ด. ต.ค.→ก.ย.: "
          + " ".join(f"{v:,.0f}" for v in _pf_tot))
    print(f"ปัจจัยฤดูกาลปลายปีงบ: niYE {n_ye}/{len(hosp)} แห่ง รวม {ni_ye_tot/1e6:,.1f} ลบ./เดือน · "
          f"clYE รวม {sum(x['bs'].get('clYE') or 0 for x in hosp)/1e6:,.1f} ลบ./เดือน "
          f"(clMo รวม {sum(x['bs'].get('clMo') or 0 for x in hosp)/1e6:,.1f})")
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    kb = os.path.getsize(OUT) / 1024
    print(f"exec.json: {len(hosp)} รพ. · งวด {tmax} · {kb:,.0f} KB")
    if ni_bad:
        print(f"⚠️ NI ไม่ตรง {len(ni_bad)} แห่ง:")
        for x in ni_bad: print("   " + x)
    else:
        print("✅ Σrev−Σexp = NI ตรงทุกแห่ง")
    # สรุปยอดตามจ่ายสองฝั่ง (ควรใกล้กันถ้าคู่หนี้อยู่ในเขตเดียวกัน)
    pay_in = sum(x["tj"]["payIn"] for x in hosp if x["type"] == "รพช.")
    ar_in  = sum(x["tj"]["arIn"] for x in hosp if x["type"] in ("รพศ.", "รพท."))
    print(f"ตามจ่ายในจังหวัด: เจ้าหนี้ฝั่ง รพช. {pay_in/1e6:,.1f} ลบ. · ลูกหนี้ฝั่ง รพศ./รพท. {ar_in/1e6:,.1f} ลบ.")
    # สรุป MOE ทางการทั้งเขต (เทียบค่าใช้จ่ายรวม)
    mo_n = tmax % 100
    moe_tot = sum(sum(x["moe"].values()) for x in hosp)
    exp_tot = sum(sum(x["exp"].values()) for x in hosp)
    print(f"MOE ทางการทั้งเขต {moe_tot/mo_n/1e6:,.1f} ลบ./เดือน "
          f"({moe_tot/exp_tot*100:,.1f}% ของค่าใช้จ่ายรวม {exp_tot/mo_n/1e6:,.1f} ลบ./เดือน)")
    for gid, gname, _ in MOE_GROUPS:
        v = sum(x["moe"].get(gid, 0) for x in hosp)
        print(f"   {gid:6s} {gname}: {v/mo_n/1e6:,.1f} ลบ./เดือน")
    # ── เทียบสองเวอร์ชัน + ก้อนที่ยืดเป็นเจ้าหนี้การค้าได้ (ฐานของตัวเลือกที่ 3) ──
    moe68_tot = sum(sum(x["moe68"].values()) for x in hosp)
    p9_tot    = sum(sum(x["moeP9"].values()) for x in hosp)
    print(f"MOE.Ver69 ({len(MOE_ACC)} บัญชี · ค่าเริ่มต้น) {moe_tot/mo_n/1e6:,.1f} ลบ./ด. · "
          f"MOE.Ver68 ({len(MOE_ACC68)} บัญชี) {moe68_tot/mo_n/1e6:,.1f} ลบ./ด. "
          f"(ต่าง {(moe68_tot-moe_tot)/mo_n/1e6:+,.1f})")
    print(f"   ก้อนยืดเป็นเจ้าหนี้การค้าได้ ({len(MOE_PAY9)} บัญชี): {p9_tot/mo_n/1e6:,.1f} ลบ./ด. "
          f"= {p9_tot/moe_tot*100:,.1f}% ของ Ver69 → เลือกจ่าย 50% เหลือ MOE เงินสด "
          f"{(moe_tot-p9_tot*0.5)/mo_n/1e6:,.1f} ลบ./ด.")
    # บัญชี MOE ที่ไม่อยู่ในชุดค่าใช้จ่าย 3010X = ยอดจะเป็น 0 เงียบ ๆ (ผังเปลี่ยน/พิมพ์รหัสผิด)
    miss = sorted((set(MOE_ACC) | set(MOE_ACC68)) - exp_codes)
    if miss:
        print(f"⚠️ บัญชี MOE {len(miss)} ตัวไม่อยู่ในชุด 3010X (ยอดจะเป็น 0): "
              + " ".join(f"{a} {names.get(a,'?')}" for a in miss))
    # ฐานเงินสำรอง MOE: MOE กลุ่มยืดไม่ได้ × 3 เดือน + คชจ.ค้างจ่ายที่ครบกำหนดแล้ว
    moe_cash = sum(sum(x["moe"].get(g, 0) for g in MOE_CASH_G) for x in hosp) / mo_n
    ap_accr  = sum(x["bs"]["apAccr"] for x in hosp)
    ap_trade = sum(x["bs"]["apTrade"] for x in hosp)
    print(f"เจ้าหนี้: การค้า {ap_trade/1e6:,.1f} ลบ. (ไม่กันสำรอง — มีเครดิต) · "
          f"คชจ.ค้างจ่าย {ap_accr/1e6:,.1f} ลบ. (กันเต็ม)")
    print(f"เงินสำรอง MOE ทั้งเขต = ยืดไม่ได้ {moe_cash/1e6:,.1f} ลบ./ด. × 3 + ค้างจ่าย {ap_accr/1e6:,.1f} "
          f"= {(moe_cash*3+ap_accr)/1e6:,.1f} ลบ. (เดิม MOE ทั้งก้อน×3 = {moe_tot/mo_n*3/1e6:,.1f} ลบ.)")

# ══════════════════════════════════════════════════════════════════
# ⚠️ CHECKLIST รอ CFO review — mapping ที่ร่างเองในไฟล์นี้ (ยังไม่ validate ผัง MOPH)
# 1) การแยก OP/IP/PP ใช้ keyword จากชื่อบัญชี (RE_PP/RE_IP/RE_OP ด้านบน)
#    - บัญชีที่ไม่มีคำระบุ → 'oth' (เช่น เหมาจ่ายรายหัวรวม, กองทุนอื่น, งบบุคลากร)
#    - DRG ถูกจัดเป็น IP เสมอ — ถูกต้องไหม?
# 2) ตามจ่าย: ใช้เฉพาะ OP-UC นอก CUP (บัญชี 2101020199.202/.203 ↔ 1102050101/.194)
#    - ไม่รวมเจ้าหนี้ตามจ่ายสิทธิอื่น (ต่างด้าว .501, สถานะสิทธิ .701) — ตั้งใจตัดออก
# 3) รหัส P ใช้ PMAP เดิมจาก export_planfin.py ซึ่งติด checklist รอ review อยู่แล้ว
# ══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    main()
