# -*- coding: utf-8 -*-
"""
analyze_support_flows.py — เงินสนับสนุนระหว่างหน่วยบริการ ไหลตามความเสี่ยงหรือไม่?

คู่บัญชีที่วิเคราะห์ (ดู RISK_EXEC_MODEL.md หัวข้อ 3.7):
  ผู้รับ 4313010199.117  เงินนอกงบประมาณรับโอนจาก สสจ./รพศ./รพท./รพช./รพ.สต.   (P12  · 3006Y+3330X)
  ผู้ให้ 5212010199.114  เงินนอกงบประมาณโอนไป  สสจ./รพศ./รพท./รพช./รพ.สต.     (P25  · 3010X+3330Y)
เทียบกับ 4313010199.119 (งบดำเนินงานที่ สสจ. จัดสรร) เพื่อแยกว่าเงินถึงแห่งวิกฤตทางช่องทางไหน

⚠️ bs = ยอด**สะสมภายในปีงบ** และงวด 12 = 0 เพราะปิดบัญชี → ยอดเต็มปีต้องอ่านที่ **งวด 11**
   (เคยพลาด: รวม bs ทุกงวดทำให้ยอดพุ่งเป็น 5-6 เท่า)

รัน: python pipeline/analyze_support_flows.py   (ไม่เขียนไฟล์ใน docs/ — พิมพ์ผลออก stdout + CSV ข้าง repo)
"""
import os, sys, json
import pandas as pd
import pymysql

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export_planfin import acc_root

sys.stdout.reconfigure(encoding="utf-8")
REPO   = r"D:\Github\Rh1-BalanceSheet"
MASTER = os.path.join(REPO, "master.parquet")
META_J = os.path.join(REPO, "docs", "data", "meta.json")
EXEC_J = os.path.join(REPO, "docs", "data", "risk", "exec.json")
OUT_CSV = os.path.join(REPO, "pipeline", "logs", "support_flows.csv")

RECV, GIVE, ALLOC = "4313010199.117", "5212010199.114", "4313010199.119"
CUR = 256909          # งวดล่าสุดที่มีข้อมูล (แก้ตามงวดที่เดินไป)
CRIT = 5              # นับว่า "วิกฤต" เมื่อ risk_score >= ค่านี้


def yearly(m, acc, cur_t):
    """ยอดเต็มปีราย รพ. — งวด 11 ของแต่ละปีงบ + งวดล่าสุดสำหรับปีที่ยังไม่จบ (หน่วย: ลบ.)"""
    s = m[m.acc == acc]
    full = s[s.t % 100 == 11].pivot_table(index="org5", columns="fy", values="bs", aggfunc="sum")
    cur = s[s.t == cur_t].groupby("org5").bs.sum().rename(cur_t // 100)
    return full.drop(columns=[cur_t // 100], errors="ignore").join(cur, how="outer").fillna(0) / 1e6


def main():
    m = pd.read_parquet(MASTER, columns=["fy", "t", "org5", "acc", "bs"])
    # ⚠️ ต้องรวมบัญชีย่อยเข้า root ก่อน (เช่น .11701 → .117) ไม่งั้นยอดขาด — ใช้ acc_root ชุดเดียว
    #    กับ export_exec.py/export_planfin.py · เคยพลาด: จับ acc ตรงตัวทำให้ .117 ขาด 4% และ .116 ขาด 4 เท่า
    m["acc"] = m["acc"].map(acc_root)
    m = m[m.acc.isin([RECV, GIVE, ALLOC])].copy()
    R, G, A = (yearly(m, a, CUR) for a in (RECV, GIVE, ALLOC))
    fy_cur = CUR // 100

    conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")
    rs = pd.read_sql("SELECT hcode,time_id,risk_score FROM risk_scores WHERE risk_score IS NOT NULL", conn)
    conn.close()
    rs["hcode"] = rs.hcode.astype(str).str.zfill(5)
    n_per = rs.groupby("hcode").time_id.nunique()
    crit = rs[rs.risk_score >= CRIT].groupby("hcode").time_id.nunique()

    meta = json.load(open(META_J, encoding="utf-8"))
    nm = {o["id"]: o.get("name") for o in meta["orgs"]}
    pv = {o["id"]: o.get("prov") for o in meta["orgs"]}
    lvl = {h["hcode"]: h.get("risk") for h in json.load(open(EXEC_J, encoding="utf-8"))["hosp"]}

    def past(df, i):
        if i not in df.index: return 0.0
        r = df.loc[i]
        return float(r[[c for c in r.index if c != fy_cur]].sum())

    def now(df, i):
        return float(df.loc[i, fy_cur]) if i in df.index else 0.0

    rows = []
    for i in sorted(nm):
        rows.append({
            "hcode": i, "รพ.": nm[i], "จว.": pv.get(i), "ระดับปัจจุบัน": lvl.get(i),
            "งวดที่มีคะแนน": int(n_per.get(i, 0)), "งวดวิกฤต": int(crit.get(i, 0)),
            "รับก่อนปีนี้": round(past(R, i), 1), "ให้ก่อนปีนี้": round(past(G, i), 1),
            "รับปีนี้": round(now(R, i), 1), "ให้ปีนี้": round(now(G, i), 1),
            "สสจ.จัดสรรปีนี้": round(now(A, i), 1),
        })
    df = pd.DataFrame(rows)
    df["สุทธิก่อนปีนี้"] = df["รับก่อนปีนี้"] - df["ให้ก่อนปีนี้"]
    df["%วิกฤต"] = (df["งวดวิกฤต"] / df["งวดที่มีคะแนน"].clip(lower=1) * 100).round(0)
    os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
    df.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")

    pd.set_option("display.width", 250)
    print("=== ยอดรวมทั้งเขต (ลบ.) ===")
    print(pd.DataFrame({"รับ .117": R.sum().round(1), "ให้ .114": G.sum().round(1)}).to_string())
    print(f"\nแห่งที่เคยรับ {(df['รับก่อนปีนี้'] + df['รับปีนี้'] > .05).sum()}/{len(df)}"
          f" · เคยให้ {(df['ให้ก่อนปีนี้'] + df['ให้ปีนี้'] > .05).sum()}/{len(df)}")

    print("\n=== เฉลี่ยต่อแห่ง แบ่งตามความถี่วิกฤต ===")
    df["กลุ่ม"] = pd.cut(df["%วิกฤต"], [-1, 0, 25, 50, 101],
                         labels=["ไม่เคยวิกฤต", "1-25%", "26-50%", ">50%"])
    print(df.groupby("กลุ่ม", observed=True).agg(
        แห่ง=("hcode", "count"), รับก่อนปีนี้=("รับก่อนปีนี้", "mean"),
        ให้ก่อนปีนี้=("ให้ก่อนปีนี้", "mean"), เคยรับ=("รับก่อนปีนี้", lambda s: int((s > .05).sum())),
    ).round(1).to_string())

    sub = df[df["งวดที่มีคะแนน"] > 0]
    print(f"\nสหสัมพันธ์ %วิกฤต ↔ สุทธิ = {sub['%วิกฤต'].corr(sub['สุทธิก่อนปีนี้']):.3f}"
          f" · ↔ ยอดรับ = {sub['%วิกฤต'].corr(sub['รับก่อนปีนี้']):.3f}")

    c = ["รพ.", "จว.", "ระดับปัจจุบัน", "งวดวิกฤต", "รับก่อนปีนี้", "ให้ก่อนปีนี้",
         "สุทธิก่อนปีนี้", "รับปีนี้", "สสจ.จัดสรรปีนี้"]
    print("\n=== 10 แห่งที่วิกฤตบ่อยที่สุด ===")
    print(df.sort_values("งวดวิกฤต", ascending=False).head(10)[c].to_string(index=False))
    hi = df[df["ระดับปัจจุบัน"].fillna(0) >= 6]
    print(f"\n=== ระดับปัจจุบัน 6-7 ({len(hi)} แห่ง) ===")
    print(hi.sort_values("ระดับปัจจุบัน", ascending=False)[c].to_string(index=False))
    print(f"\nรวม {len(hi)} แห่ง: รับ .117 = {hi['รับปีนี้'].sum():.1f} ลบ."
          f" · สสจ. จัดสรร .119 = {hi['สสจ.จัดสรรปีนี้'].sum():.1f} ลบ.")

    pool_by_prov(R, G, df)
    screen_parking(R, G, rs, nm)


def pool_by_prov(A, B, df):
    """กองกลาง สสจ. ราย จว. — ฝากเข้า (.114) vs ถอนกลับ (.117) · สสจ. ไม่มีใน master.parquet
    จึงเห็นได้แค่ 'เงินที่หายไปจากผลรวม' = คงอยู่ที่ สสจ. + เงินอุ้ม รพ.สต. (แยกไม่ได้ — ข้อจำกัด ①)"""
    print("\n\n=== กองกลาง สสจ. ราย จว. สะสมทุกปี (ลบ.) ===")
    prov = df.set_index("hcode")["จว."]
    d = pd.DataFrame({
        "ฝากเข้า(ให้)": B.sum(axis=1).groupby(prov).sum(),
        "ถอน/รับ": A.sum(axis=1).groupby(prov).sum(),
    }).fillna(0)
    d["คงอยู่ที่ สสจ."] = d["ฝากเข้า(ให้)"] - d["ถอน/รับ"]
    d["%ถอนกลับ"] = (d["ถอน/รับ"] / d["ฝากเข้า(ให้)"] * 100).round(0)
    print(d.sort_values("ฝากเข้า(ให้)", ascending=False).round(1).to_string())
    print(f"รวมเขต: ฝาก {d['ฝากเข้า(ให้)'].sum():.1f} · ถอน {d['ถอน/รับ'].sum():.1f}"
          f" · คงอยู่ {d['คงอยู่ที่ สสจ.'].sum():.1f} ลบ.")

    print("\nสหสัมพันธ์ *ในจังหวัด*: %วิกฤต ↔ ยอดที่ได้รับ (ติดลบ = เงินไปที่แห่งที่ไม่ค่อยวิกฤต)")
    print("  ⚠️ อ่านได้สองทาง — ดู RISK_EXEC_MODEL.md หัวข้อ 3.7 ข้อจำกัด ③")
    tot = A.sum(axis=1).reindex(df.hcode).fillna(0).values
    df = df.assign(รับสะสม=tot)
    for p, g in df.groupby("จว."):
        g = g[(g["รับสะสม"] > 0) | (g["ให้ก่อนปีนี้"] > 0)]
        if len(g) < 4: continue
        print(f"  {p:12s} n={len(g):3d}  r = {g['%วิกฤต'].corr(g['รับสะสม']):+.2f}")


def screen_parking(A, B, rs, nm):
    """คัดกรอง 'ยอดรับก้อนโตที่น่าจะเป็นการฝากเงิน ไม่ใช่การช่วยเพราะวิกฤต' (หัวข้อ 3.7 ข้อจำกัด ②)

    เกณฑ์หยาบ 3 ข้อ ใช้ประกอบกัน — GL ลำพังแยกไม่ได้ ต้องรอทะเบียนการโอนของ สสจ.:
      ① ก้อนโดดปีเดียว   ② รับ ≈ ให้ ในปีเดียวกัน (round-trip)   ③ risk ปีนั้นแค่ 0-1
    """
    print("\n\n=== คัดกรอง 'ฝากเงิน?' — ยอดรับ >= 5 ลบ. เทียบ risk สูงสุดของปีนั้น ===")
    rs = rs.copy(); rs["fy"] = rs.time_id.astype(int) // 100
    mxy = rs.groupby(["hcode", "fy"]).risk_score.max()
    rows = []
    for i in A.index:
        for fy in A.columns:
            v = float(A.loc[i, fy])
            if v < 5: continue
            g = float(B.loc[i, fy]) if i in B.index else 0.0
            rows.append({"รพ.": nm.get(i, i), "ปี": fy, "รับ": round(v, 1), "ให้ปีเดียวกัน": round(g, 1),
                         "round-trip": "✓" if g > 1 and abs(v - g) / max(v, g) < .2 else "",
                         "risk สูงสุดปีนั้น": int(mxy.get((i, fy), -1))})
    d = pd.DataFrame(rows).sort_values("รับ", ascending=False)
    print(d.to_string(index=False))
    known = d[d["risk สูงสุดปีนั้น"] >= 0]
    lo = known[known["risk สูงสุดปีนั้น"] <= 1]
    print(f"\nเคสรับก้อนโตแต่ปีนั้น risk แค่ 0-1 (ไม่ได้วิกฤต) = {len(lo)}/{len(known)} เคส"
          f" · {lo['รับ'].sum():.1f} จาก {d['รับ'].sum():.1f} ลบ."
          f" ({100 * lo['รับ'].sum() / d['รับ'].sum():.0f}% ของยอด)")
    print("⚠️ ห้ามอ่านยอดรับเป็นหลักฐานว่าแห่งนั้น 'ถูกช่วยเหลือ' — ดู RISK_EXEC_MODEL.md หัวข้อ 3.7 ②")


if __name__ == "__main__":
    main()
