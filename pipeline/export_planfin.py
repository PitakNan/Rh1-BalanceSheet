# -*- coding: utf-8 -*-
"""
export_planfin.py — เพิ่มการแบ่งรายได้/ค่าใช้จ่ายราย "รหัส P ของ Planfin" ต่อ รพ.
ลง docs/data/risk/h/{hcode}.json (คีย์ใหม่ "planfin") เพื่อใช้ในป็อปอัปประมาณการ NI
ของ Survival Simulator (risk_drill.html)

หลักการ:
  - map บัญชี GL (root 13 หลัก) → รหัส P ตามผัง Planfin (ร่างจากรหัสบัญชี — ดู PMAP ด้านล่าง)
  - รวมยอด YTD งวดล่าสุดของแต่ละ รพ. เป็นราย P (ค่าเดียวกับ waterfall คือ 'bs' สะสมในปีงบ)
  - ครอบคลุมทุกบัญชีในชุด 3006Y (รายได้) / 3010X (ค่าใช้จ่าย) จึงได้ ΣP-รายได้ − ΣP-ค่าใช้จ่าย
    = รายได้รวม − ค่าใช้จ่ายรวม = NI เดียวกับที่ Risk Score ใช้ (คงความสอดคล้อง 100%)

หมายเหตุ: เป็นสคริปต์เสริมแยก (merge เข้าไฟล์เดิม ไม่แตะค่าอื่น) — รันหลัง export_risk_link.py
"""
import os, sys, json
import pandas as pd
import pymysql

sys.stdout.reconfigure(encoding="utf-8")
REPO = r"D:\Github\Rh1-BalanceSheet"
MASTER = os.path.join(REPO, "master.parquet")
META_J = os.path.join(REPO, "docs", "data", "meta.json")
OUT_H  = os.path.join(REPO, "docs", "data", "risk", "h")

# ── ผังชื่อรหัส P (แนวเดียวกับ Planfin ของเขต — Planfin-Rh1) ──
PN = {
    # รายได้
    "P04": "รายได้ UC", "P05": "รายได้ EMS", "P06": "ค่ารักษาเบิกต้นสังกัด",
    "P07": "ค่ารักษาเบิกจ่ายตรงกรมบัญชีกลาง", "P08": "รายได้ประกันสังคม",
    "P09": "รายได้แรงงานต่างด้าว", "P10": "ค่ารักษาและบริการอื่น ๆ",
    "P11": "รายได้งบประมาณส่วนบุคลากร", "P12": "รายได้อื่น", "P13": "รายได้งบลงทุน",
    "P61": "ค่ารักษา อปท.", "RADJ": "รายการระหว่างหน่วยงาน/ปรับปรุง (รายได้)",
    # ค่าใช้จ่าย
    "P14": "ต้นทุนยา", "P15": "ต้นทุนเวชภัณฑ์มิใช่ยา/วัสดุการแพทย์",
    "P151": "ต้นทุนวัสดุทันตกรรม", "P16": "ต้นทุนวัสดุวิทยาศาสตร์การแพทย์",
    "P17": "เงินเดือนและค่าจ้างประจำ", "P18": "ค่าจ้างชั่วคราว/พกส./พนง.ราชการ",
    "P19": "ค่าตอบแทน", "P20": "ค่าใช้จ่ายบุคลากรอื่น", "P21": "ค่าใช้สอย",
    "P22": "ค่าสาธารณูปโภค", "P23": "วัสดุใช้ไป", "P24": "ค่าเสื่อมราคา/ตัดจำหน่าย",
    "P241": "หนี้สูญและสงสัยจะสูญ", "P25": "ค่าใช้จ่ายอื่น",
    "EADJ": "รายการระหว่างหน่วยงาน/ปรับปรุง (ค่าใช้จ่าย)",
}
REV_ORDER = ["P04", "P05", "P06", "P07", "P08", "P09", "P61", "P10", "P11", "P12", "P13", "RADJ"]
EXP_ORDER = ["P14", "P15", "P151", "P16", "P23", "P17", "P18", "P19", "P20", "P21", "P22", "P24", "P241", "P25", "EADJ"]

def planfin_code(root):
    """root = '4301020105.201' → รหัส P (ร่างจากโครงสร้างรหัสบัญชี MOPH)"""
    d, _, suf = root.partition(".")
    # ---------- รายได้ 4xxx ----------
    if d.startswith("4"):
        if d == "4301020105": return "P04"                       # UC
        if d == "4301020102": return "P05" if suf == "105" else "P10"  # EMS / บริการอื่น
        if d == "4301020104":                                    # ค่ารักษา — แยกตามสิทธิ
            if suf in ("104", "105", "108", "109", "110", "111"): return "P06"  # เบิกต้นสังกัด/หน่วยงานอื่น
            if suf in ("401", "402", "405", "406"): return "P07"              # จ่ายตรงกรมบัญชีกลาง
            if suf and suf[0] == "8": return "P61"                            # 8xx = อปท.
            return "P10"                                                      # ชำระเงิน/พรบ.รถ ฯลฯ
        if d == "4301020106":                                    # กองทุน — แยกตามหลักสิทธิ
            if suf and suf[0] == "3": return "P08"               # 3xx = ประกันสังคม
            if suf and suf[0] == "5": return "P09"               # 5xx = แรงงานต่างด้าว
            return "P10"                                          # 7xx สถานะสิทธิ ฯลฯ
        if d == "4307010103": return "P11"                       # งบบุคลากร
        if d in ("4307010104", "4302020107", "4302020199"): return "P13"  # งบลงทุน/ช่วยเหลือลงทุน
        if d.startswith("4308"): return "RADJ"                   # ระหว่างหน่วยงาน (ปรับเงินฝากคลัง ฯลฯ)
        if d.startswith("4307"): return "P12"                    # งบดำเนินงาน/อุดหนุน/กลาง/กู้
        return "P12"                                             # บริจาค/ดอกเบี้ย/ขาย/อื่น/ของแผ่นดิน
    # ---------- ค่าใช้จ่าย 5xxx ----------
    if d == "5104030205":                                        # ต้นทุนบริการ — แยกยา/เวชภัณฑ์/วัสดุ
        if suf == "101": return "P14"                            # ยา
        if suf in ("102", "103"): return "P15"                   # เวชภัณฑ์มิใช่ยา/วัสดุการแพทย์
        if suf in ("104", "118"): return "P16"                   # วิทยาศาสตร์การแพทย์/เอกซเรย์
        if suf == "117": return "P151"                           # ทันตกรรม
        return "P23"                                             # บริโภค/เครื่องแต่งกาย/อื่น
    if d == "5104040102": return "P19"                           # ค่าตอบแทน
    if d == "5101010113":                                        # ค่าจ้าง — ประจำ/ชั่วคราว
        return "P17" if suf in ("101", "102") else "P18"
    if d in ("5101010101", "5101010103", "5101010108", "5101010109", "5101010116"): return "P17"
    if d == "5101010115": return "P18"                           # พนักงานราชการ
    if d == "5101010199": return "P19"                           # ค่าตอบแทนเวร ฯลฯ
    if d[:6] in ("510102", "510103", "510104"): return "P20"     # บุคลากรอื่น/ช่วยเหลือ/บำนาญ
    if d[:4] in ("5102", "5103"): return "P21"                   # ฝึกอบรม/เดินทาง → ค่าใช้สอย
    if d in ("5104010104", "5104010110", "5104030206"): return "P23"  # วัสดุ/เชื้อเพลิง/ครุภัณฑ์ต่ำเกณฑ์
    if d[:6] == "510402": return "P22"                           # สาธารณูปโภค
    if d == "5104030299": return "P25"                           # ดำเนินงานอื่น (ค่าตามจ่าย ฯลฯ)
    if d.startswith("5105"): return "P24"                        # ค่าเสื่อม/ตัดจำหน่าย
    if d.startswith("5108"): return "P241"                       # หนี้สูญ
    if d[:4] in ("5209", "5210", "5211"): return "EADJ"          # ระหว่างหน่วยงาน/ปรับปรุง
    if d.startswith("5104"): return "P21"                        # ค่าใช้สอย/จ้างเหมา/ซ่อม/เช่า/ธรรมเนียม
    return "P25"                                                 # อุดหนุน/ขายทรัพย์สิน/อื่น

def acc_root(a):
    p, _, rest = a.partition("."); dd = rest.replace(".", "")
    return p + "." + dd[:3] if dd else a

def main():
    conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")
    items = pd.read_sql("SELECT RatioItemID,CodeL1 FROM ratio_items WHERE UseYN='Yes' "
                        "AND RatioItemID IN ('3006Y','3010X')", conn)
    conn.close()
    rev_codes = set(items.loc[items.RatioItemID == "3006Y", "CodeL1"])
    exp_codes = set(items.loc[items.RatioItemID == "3010X", "CodeL1"])

    with open(META_J, encoding="utf-8") as f:
        meta = json.load(f)
    org_ids = {o["id"] for o in meta["orgs"]}

    m = pd.read_parquet(MASTER, columns=["org5", "t", "acc", "bs"])
    m = m[m["org5"].isin(org_ids)].copy()
    m["root"] = m["acc"].map(acc_root)
    m["side"] = m["root"].map(lambda r: "rev" if r in rev_codes else ("exp" if r in exp_codes else None))
    m = m[m["side"].notna()].copy()
    m["p"] = m["root"].map(planfin_code)

    written = skipped = 0
    for org5, g in m.groupby("org5"):
        path = os.path.join(OUT_H, f"{org5}.json")
        if not os.path.exists(path):
            skipped += 1; continue
        tmax = int(g["t"].max())
        cur = g[g["t"] == tmax]
        agg = cur.groupby(["side", "p"])["bs"].sum()
        def rows(side, order):
            out = []
            for p in order:
                v = float(agg.get((side, p), 0.0))
                if abs(v) < 1: continue
                out.append({"p": p, "name": PN.get(p, p), "value": round(v, 0)})
            # เผื่อ P ที่ไม่อยู่ใน order (กันตกหล่น)
            for (s, p), v in agg.items():
                if s == side and p not in order and abs(v) >= 1:
                    out.append({"p": p, "name": PN.get(p, p), "value": round(float(v), 0)})
            return out
        planfin = {"t": tmax, "rev": rows("rev", REV_ORDER), "exp": rows("exp", EXP_ORDER)}
        with open(path, encoding="utf-8") as f:
            h = json.load(f)
        h["planfin"] = planfin
        with open(path, "w", encoding="utf-8") as f:
            json.dump(h, f, ensure_ascii=False, separators=(",", ":"))
        written += 1
    print(f"planfin merged: {written} files, skipped {skipped}")

if __name__ == "__main__":
    main()
