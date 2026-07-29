# -*- coding: utf-8 -*-
"""
build_risk_score.py — สร้างตาราง Risk Score งวดใดก็ได้ "ในรูปแบบไฟล์ทางการของ HFO" จากงบทดลอง

ทำไมต้องมี: HFO ไม่แจกตารางคะแนนสำเร็จมาในไฟล์ .mdb — ทีมต้องเข้าเว็บ hfo.moph.go.th
กดเมนู risk score โหลด Excel มาเองทุกวันที่ 16 (ดู "ขั้นตอนการดึงข้อมูลบัญชีในระบบ HFO ของ กศภ.")
งวดใดที่ยังไม่มีใครโหลด (เช่น มิ.ย.69) จึงไม่มีไฟล์ — สคริปต์นี้สร้างขึ้นเองจากงบทดลองงวดนั้น

พิสูจน์แล้วว่าให้ผลเท่าไฟล์ทางการ (RISK_EXEC_MODEL.md หัวข้อ 3.11):
  งวด 256908 (พ.ค.69) ตรง 103/103 · งวด 256906 (มี.ค.69) ตรง 103/103
  งวด 256904 (ม.ค.69) ตรง 102/103 — ที่คลาดคือ รพ.ภูเพียง ส่งงบแก้ไขหลังไฟล์ทางการถูกดึง
  (CR ทางการ 2.02 vs งบปัจจุบัน 1.16) = ต่างที่ "รุ่นของข้อมูล" ไม่ใช่สูตร

⚠️ ต้องปัด CR/QR/Cash เป็น 2 ตำแหน่ง **ก่อน** เทียบเกณฑ์ — HFO ทำแบบนั้น
   (เชียงกลาง 256908 QR 0.996 → ทางการแสดง 1.00 ให้ 0 คะแนน · ไม่ปัดจะได้ 1 คะแนน)

รัน: python build_risk_score.py 256909            → พิมพ์สรุป + เขียน CSV
     python build_risk_score.py 256909 --validate <ไฟล์ทางการ.xlsx>   → เทียบกับไฟล์ทางการ
output: pipeline/out/risk_score_<time_id>.csv  (คอลัมน์เหมือนไฟล์ทางการของ HFO)
"""
import sys, os
import numpy as np
import pandas as pd
import pymysql

sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
MASTER = os.path.join(REPO, "master.parquet")
OUTDIR = os.path.join(HERE, "out")

TH_M = ["ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย."]
IDS = ("1001X", "1001Y", "1002X", "1003X", "3006Y", "3010X", "3330X", "3330Y", "1005X", "1005Y")


def acc_root(a):
    p, _, rest = a.partition(".")
    dd = rest.replace(".", "")
    return p + "." + dd[:3] if dd else a


def score_row(ca, cl, qn, cn, ni, mo):
    """คะแนน 7 ระดับตามสูตรทางการ — ปัด ratio 2 ตำแหน่งก่อนเทียบเกณฑ์ (เหมือน HFO)"""
    if not cl:
        return None
    cr, qr, cash = round(ca / cl, 2), round(qn / cl, 2), round(cn / cl, 2)
    nwc = ca - cl
    li = (1 if cr < 1.5 else 0) + (1 if qr < 1.0 else 0) + (1 if cash < 0.8 else 0)
    st = (1 if nwc < 0 else 0) + (1 if ni < 0 else 0)
    npos, ipos = nwc >= 0, ni >= 0
    if npos and ipos:
        su = 0
    elif not npos and not ipos:
        su = 2
    elif npos:                                   # NWC ≥ 0 แต่ NI < 0 → อยู่ได้อีกกี่เดือน
        a = abs(ni) / mo
        s = nwc / a if a else 1e9
        su = 2 if s < 3 else (1 if s < 6 else 0)
    else:                                        # NWC < 0 แต่ NI ≥ 0 → ใช้กี่เดือนถมหลุม
        a = ni / mo
        r = (-nwc) / a if a else 1e9
        su = 0 if r < 3 else (1 if r < 6 else 2)
    return dict(CR=cr, QR=qr, Cash=cash, NWC=nwc, NI=ni,
                LiI=li, StI=st, SuI=su, RiskScoring=li + st + su)


def build(time_id):
    conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")
    items = pd.read_sql("SELECT RatioItemID, CodeL1 FROM ratio_items WHERE UseYN='Yes' "
                        "AND RatioItemID IN " + str(IDS), conn)
    org = pd.read_sql("SELECT OrgID, Org, Province, TypeID FROM org_tbl WHERE Ket=1", conn)
    conn.close()
    org["h"] = org["OrgID"].astype(str).str.zfill(5)
    sets = {k: set(g) for k, g in items.groupby("RatioItemID")["CodeL1"]}

    m = pd.read_parquet(MASTER, columns=["org5", "t", "acc", "bs"])
    m = m[m["t"] == int(time_id)].copy()
    if m.empty:
        sys.exit(f"ไม่มีข้อมูลงวด {time_id} ใน master.parquet")
    m["root"] = m["acc"].map(acc_root)
    g = pd.DataFrame({k: m[m["root"].isin(v)].groupby("org5")["bs"].sum()
                      for k, v in sets.items()}).fillna(0.0)

    mo = int(time_id) % 100
    rows = []
    for h, r in g.iterrows():
        s = score_row(abs(float(r["1001X"])), abs(float(r["1001Y"])), abs(float(r["1002X"])),
                      abs(float(r["1003X"])),
                      abs(float(r["3006Y"])) - abs(float(r["3010X"])), mo)
        if s is None:
            continue
        s["EBITDA"] = abs(float(r["3330X"])) - abs(float(r["3330Y"]))
        s["เงินบำรุงคงเหลือสุทธิ"] = abs(float(r["1005X"])) - abs(float(r["1005Y"]))
        rows.append({"รหัส": h, **s})
    df = pd.DataFrame(rows).merge(org[["h", "Org", "Province", "TypeID"]],
                                  left_on="รหัส", right_on="h", how="left").drop(columns="h")
    df.insert(0, "เขต", 1)
    df = df.rename(columns={"Org": "หน่วยงาน", "Province": "จังหวัด", "TypeID": "ประเภท"})
    df["TimeID"] = int(time_id)
    df["งวดเดือน"] = TH_M[mo - 1] + " " + str(int(time_id) // 100)
    cols = ["เขต", "จังหวัด", "รหัส", "หน่วยงาน", "ประเภท", "TimeID", "งวดเดือน",
            "CR", "QR", "Cash", "NWC", "NI", "LiI", "StI", "SuI", "RiskScoring",
            "EBITDA", "เงินบำรุงคงเหลือสุทธิ"]
    return df[cols].sort_values(["จังหวัด", "รหัส"]).reset_index(drop=True)


def validate(df, path):
    o = pd.read_excel(path, engine="calamine")
    if "เขต" in o.columns:
        o = o[o["เขต"] == 1]
    col_r = "รหัส" if "รหัส" in o.columns else "hcode"
    o = o.dropna(subset=[col_r]).copy()
    o["h"] = o[col_r].astype(int).astype(str).str.zfill(5)
    sc = [c for c in o.columns if "isk" in str(c)][0]
    j = o.set_index("h").join(df.set_index("รหัส"), how="inner", rsuffix="_calc")
    eq = (j[sc].astype(int) == j["RiskScoring"].astype(int)).sum()
    print(f"\nเทียบไฟล์ทางการ {os.path.basename(path)}: ตรง {eq}/{len(j)} = {eq/len(j)*100:.1f}%")
    bad = j[j[sc].astype(int) != j["RiskScoring"].astype(int)]
    for _, r in bad.iterrows():
        print(f"   ไม่ตรง {str(r['หน่วยงาน'])[:22]:<24} ทางการ {int(r[sc])} vs คำนวณ {int(r['RiskScoring'])}"
              f" | CR {r['CR']}/{r['CR_calc']} QR {r['QR']}/{r['QR_calc']} Cash {r['Cash']}/{r['Cash_calc']}")
    return eq, len(j)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    time_id = sys.argv[1]
    df = build(time_id)
    print(f"งวด {time_id} ({df['งวดเดือน'].iloc[0]}) — {len(df)} แห่ง")
    dist = df["RiskScoring"].value_counts().sort_index()
    print("   การกระจายคะแนน: " + " · ".join(f"{k}={v}" for k, v in dist.items()))
    print(f"   วิกฤต (≥5): {(df['RiskScoring']>=5).sum()} แห่ง | เต็ม 7: {(df['RiskScoring']==7).sum()} แห่ง")
    if "--validate" in sys.argv:
        validate(df, sys.argv[sys.argv.index("--validate") + 1])
    os.makedirs(OUTDIR, exist_ok=True)
    out = os.path.join(OUTDIR, f"risk_score_{time_id}.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"\nเขียน {out}")


if __name__ == "__main__":
    main()
