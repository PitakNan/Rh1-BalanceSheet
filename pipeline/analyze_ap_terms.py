# -*- coding: utf-8 -*-
"""
analyze_ap_terms.py — วัด "รอบจ่ายจริง" ของหนี้สินหมุนเวียน เพื่อออกแบบเงินสำรอง MOE
(งานค้างข้อ 7 ใน RISK_EXEC_MODEL.md — แยกเจ้าหนี้การค้า/เจ้าหนี้อื่น · กันตามรอบจ่ายจริง)

แยกหนี้สินหมุนเวียน (RatioItemID 1001Y) เป็น 4 ถัง แล้วเทียบกับ MOE/เดือนของกลุ่มที่ก่อหนี้นั้น
เพื่อหา "จำนวนเดือนที่ค้างอยู่จริง" = ยอดเจ้าหนี้ ÷ ค่าใช้จ่ายต่อเดือนของกลุ่มนั้น

  trade = เจ้าหนี้การค้า/ผู้ขาย (ยา เวชภัณฑ์ วัสดุ ครุภัณฑ์ จ้างเหมา LAB/X-Ray + GR/IR)
          ↔ MOE กลุ่ม med mat rep svc oth   ← มีเครดิตเทอม จ่ายตามรอบ
  accr  = ค่าใช้จ่ายบุคลากร/สาธารณูปโภคค้างจ่าย (2102*)
          ↔ MOE กลุ่ม labor util            ← ไม่มีเครดิต ต้องมีเงินสดจ่าย
  tj    = เจ้าหนี้ค่ารักษาตามจ่าย (มีกลไกแยกในแท็บ #exec อยู่แล้ว ไม่นับใน MOE)
  oth   = เงินรับฝาก/เงินประกัน/รายได้รับล่วงหน้า (ไม่ใช่ภาระจ่ายจากเงินบำรุงตามรอบ)

รัน: python pipeline/analyze_ap_terms.py
"""
import os, sys, json
import pandas as pd
import pymysql

sys.stdout.reconfigure(encoding="utf-8")
REPO = r"D:\Github\Rh1-BalanceSheet"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export_planfin import acc_root
# ⚠️ นิยามชุดเดียวกับที่หน้าเว็บใช้ — import มา ห้ามก๊อปมาไว้ที่นี่ (กติกาเหล็ก RISK_EXEC_MODEL.md 3.6)
from export_exec import MOE_GROUPS, MOE_ACC, MOE_CASH_G, cl_bucket

# MOE กลุ่มที่ก่อเจ้าหนี้การค้า (มีเครดิต) = ที่เหลือจาก MOE_CASH_G
MOE_TRADE_G = tuple(gid for gid, _, _ in MOE_GROUPS if gid not in MOE_CASH_G)


def main():
    conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")
    items = pd.read_sql("SELECT RatioItemID,CodeL1 FROM ratio_items WHERE UseYN='Yes' "
                        "AND RatioItemID IN ('1001Y','3010X')", conn)
    conn.close()
    cl_codes = set(items.loc[items.RatioItemID == "1001Y", "CodeL1"])
    exp_codes = set(items.loc[items.RatioItemID == "3010X", "CodeL1"])

    with open(os.path.join(REPO, "docs", "data", "meta.json"), encoding="utf-8") as f:
        orgs = {o["id"]: o for o in json.load(f)["orgs"]}

    m = pd.read_parquet(os.path.join(REPO, "master.parquet"), columns=["org5", "t", "acc", "bs"])
    m = m[m["org5"].isin(orgs)]
    tmax = int(m["t"].max())
    m = m[m["t"] == tmax].copy()
    m["root"] = m["acc"].map(acc_root)
    mo = tmax % 100

    rows = []
    for org5, g in m.groupby("org5"):
        o = orgs[org5]
        cl = g[g["root"].isin(cl_codes)]
        buck = {"trade": 0.0, "accr": 0.0, "tj": 0.0, "oth": 0.0}
        for root, gg in cl.groupby("root"):
            buck[cl_bucket(root)] += float(gg["bs"].sum())
        moe = {}
        for root, gg in g[g["root"].isin(exp_codes)].groupby("root"):
            gid = MOE_ACC.get(root)
            if gid:
                moe[gid] = moe.get(gid, 0.0) + float(gg["bs"].sum())
        trade_mo = sum(moe.get(k, 0) for k in MOE_TRADE_G) / mo
        cash_mo  = sum(moe.get(k, 0) for k in MOE_CASH_G) / mo
        moe_mo   = trade_mo + cash_mo
        rows.append({
            "hcode": org5, "name": o.get("name"), "prov": o.get("prov"),
            "cl": sum(buck.values()), **buck,
            "moeMo": moe_mo, "tradeMo": trade_mo, "cashMo": cash_mo,
            "termTrade": buck["trade"] / trade_mo if trade_mo > 0 else None,
            "termAccr": buck["accr"] / cash_mo if cash_mo > 0 else None,
        })
    d = pd.DataFrame(rows)

    print(f"═══ งวด {tmax} · {len(d)} รพ. · หน่วย: ล้านบาท ═══\n")
    tot = d[["cl", "trade", "accr", "tj", "oth"]].sum()
    print("โครงสร้างหนี้สินหมุนเวียนทั้งเขต")
    for k, lab in (("trade", "เจ้าหนี้การค้า/ผู้ขาย"), ("accr", "คชจ.บุคลากร/สาธารณูปโภคค้างจ่าย"),
                   ("tj", "เจ้าหนี้ค่ารักษาตามจ่าย"), ("oth", "เงินรับฝาก/ประกัน/รับล่วงหน้า")):
        print(f"  {lab:36s} {tot[k]/1e6:>9,.1f}  {tot[k]/tot['cl']*100:>5.1f}%")
    print(f"  {'รวม':36s} {tot['cl']/1e6:>9,.1f}")

    print(f"\nMOE/เดือนทั้งเขต {d['moeMo'].sum()/1e6:,.1f} ลบ. "
          f"= กลุ่มมีเครดิต {d['tradeMo'].sum()/1e6:,.1f} + กลุ่มจ่ายสด {d['cashMo'].sum()/1e6:,.1f}")
    print(f"รอบจ่ายจริงทั้งเขต: เจ้าหนี้การค้า {tot['trade']/d['tradeMo'].sum():.2f} เดือน "
          f"· คชจ.ค้างจ่าย {tot['accr']/d['cashMo'].sum():.2f} เดือน")

    for col, lab in (("termTrade", "เจ้าหนี้การค้า ÷ MOE กลุ่มมีเครดิต/เดือน"),
                     ("termAccr", "คชจ.ค้างจ่าย ÷ MOE กลุ่มจ่ายสด/เดือน")):
        s = d[col].dropna()
        q = s.quantile([0, .1, .25, .5, .75, .9, 1])
        print(f"\n{lab} (เดือน) — n={len(s)}")
        print("  min %.2f · p10 %.2f · p25 %.2f · มัธยฐาน %.2f · p75 %.2f · p90 %.2f · max %.2f"
              % tuple(q))

    print("\n10 แห่งที่ค้างเจ้าหนี้การค้ายาวสุด (เดือน)")
    for _, r in d.nlargest(10, "termTrade").iterrows():
        print(f"  {r['name'][:28]:30s} {r['prov'][:10]:12s} เจ้าหนี้การค้า {r['trade']/1e6:>8,.1f} "
              f"÷ {r['tradeMo']/1e6:>6,.1f}/ด. = {r['termTrade']:>5.2f} ด.")

    # ══ เทียบเกณฑ์เงินสำรอง MOE 3 แบบ (งานค้างข้อ 7 ครึ่งที่เหลือ) ══
    # ใช้ bs.cn จาก exec.json เพื่อให้เป็นตัวเลขชุดเดียวกับหน้าเว็บ (กติกาเหล็ก หัวข้อ 3.6)
    ex = os.path.join(REPO, "docs", "data", "risk", "exec.json")
    if os.path.exists(ex):
        with open(ex, encoding="utf-8") as f:
            EX = json.load(f)
        cn = {h["hcode"]: h["bs"]["cn"] for h in EX["hosp"]}
        MIN_MO = 3                                   # MOE_MIN_MO ใน risk_drill.html
        d["cn"] = d["hcode"].map(cn)
        d = d[d["cn"].notna()].copy()
        # ① เดิม (28 ก.ค.): MOE ทั้งก้อน × เดือนที่เหลือถึงสิ้นปีงบ
        d["resOld"] = d["moeMo"] * max(0, 12 - mo)
        # ② ที่ session อื่นเพิ่งเปลี่ยน (29 ก.ค.): MOE ทั้งก้อน × 3 คงที่
        d["resFix3"] = d["moeMo"] * MIN_MO
        # ③ ที่เสนอ: แยกเจ้าหนี้ — กันเฉพาะ MOE ที่ยืดไม่ได้ + คชจ.ค้างจ่ายที่ครบกำหนดแล้ว
        #    เจ้าหนี้การค้าไม่กัน เพราะผู้ขายให้เครดิตอยู่ (และถูกนับเป็นตัวส่วนใน CR/QR แล้ว)
        d["resSplit"] = d["cashMo"] * MIN_MO + d["accr"]
        print("\n═══ เทียบเกณฑ์เงินสำรอง MOE (ล้านบาท · ทั้งเขต 103 แห่ง) ═══")
        print(f"  {'เกณฑ์':44s} {'เงินสำรองรวม':>14s} {'แห่งที่เงินสดไม่พอกัน':>22s}")
        for col, lab in (("resOld", f"① เดิม MOE×(12−m) = MOE×{max(0,12-mo)}"),
                         ("resFix3", "② MOE×3 คงที่ (ที่เปลี่ยนแล้ว 29 ก.ค.)"),
                         ("resSplit", "③ เสนอ: (ค่าจ้าง+สาธารณูปโภค)×3 + คชจ.ค้างจ่าย")):
            stuck = int((d["cn"] < d[col]).sum())
            print(f"  {lab:44s} {d[col].sum()/1e6:>14,.1f} {stuck:>19d}/103")
        print("\n  10 แห่งที่เกณฑ์ ② กับ ③ ต่างกันมากสุด (ล้านบาท)")
        d["gap23"] = d["resFix3"] - d["resSplit"]
        for _, r in d.nlargest(10, "gap23").iterrows():
            f2 = "ไม่พอ" if r["cn"] < r["resFix3"] else "พอ"
            f3 = "ไม่พอ" if r["cn"] < r["resSplit"] else "พอ"
            print(f"    {r['name'][:26]:28s} เงินสด {r['cn']/1e6:>7,.1f} · ② {r['resFix3']/1e6:>7,.1f} ({f2})"
                  f" · ③ {r['resSplit']/1e6:>7,.1f} ({f3})")

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
    os.makedirs(out, exist_ok=True)
    p = os.path.join(out, f"ap_terms_{tmax}.csv")
    d.to_csv(p, index=False, encoding="utf-8-sig")
    print(f"\n→ {p}")


if __name__ == "__main__":
    main()
