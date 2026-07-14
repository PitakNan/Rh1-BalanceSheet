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

# ── เจ้าหนี้/ลูกหนี้ค่ารักษาตามจ่าย (root 13 หลัก) ──
TJ_PAY_IN  = {"2101020199.202"}                      # เจ้าหนี้ OP-UC นอก CUP ในจังหวัดสังกัด สธ.
TJ_PAY_OUT = {"2101020199.203"}                      # เจ้าหนี้ OP-UC นอก CUP ต่างจังหวัดสังกัด สธ.
TJ_AR_IN   = {"1102050101.203", "1102050194.204"}    # ลูกหนี้ UC-OP นอก CUP ในจังหวัด
TJ_AR_OUT  = {"1102050101.204", "1102050194.205"}    # ลูกหนี้ UC-OP นอก CUP ต่างจังหวัด

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
                        "AND RatioItemID IN ('3006Y','3010X')", conn)
    conn.close()
    rev_codes = set(items.loc[items.RatioItemID == "3006Y", "CodeL1"])
    exp_codes = set(items.loc[items.RatioItemID == "3010X", "CodeL1"])

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
        # ── rev ราย P × op/ip/pp/oth · exp ราย P ──
        rev, exp = {}, {}
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
        # ── ตามจ่าย ──
        def bal(roots):
            return round(float(g.loc[g["root"].isin(roots), "bs"].sum()), 0)
        tj = {"payIn": bal(TJ_PAY_IN), "payOut": bal(TJ_PAY_OUT),
              "arIn": bal(TJ_AR_IN),  "arOut": bal(TJ_AR_OUT)}
        # ── ตรวจ NI สอดคล้อง ──
        if abs(ni_chk - float(t["ni"])) > 5:
            ni_bad.append(f"{org5} {h.get('name')}: Σrev−Σexp={ni_chk:,.0f} ≠ t.ni={t['ni']:,.0f}")
        s = srisk.get(org5, {})
        grp = h.get("grp") or ""
        typ = "รพศ." if grp.startswith("รพศ.") else ("รพท." if grp.startswith("รพท.") else "รพช.")
        hosp.append({
            "hcode": org5, "name": h.get("name"), "prov": h.get("prov"),
            "grp": grp, "type": typ, "cls": h.get("typeSer"), "bed": h.get("bed"),
            "risk": s.get("risk"),
            "bs": {"t": int(t["t"]), "mo": mo, "ca": t["ca"], "cl": t["cl"], "qn": t["qn"],
                   "cn": t["cn"], "ni": t["ni"],
                   "depMo": round(max(0.0, (t["exp"] - t["e33y"]) / mo), 0)},
            "rev": rev, "exp": exp, "tj": tj,
        })

    out = {"period": tmax, "periodLabel": summ.get("periodLabel"), "monthsElapsed": tmax % 100,
           "pn": PN, "revOrder": REV_ORDER, "expOrder": EXP_ORDER, "hosp": hosp}
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
