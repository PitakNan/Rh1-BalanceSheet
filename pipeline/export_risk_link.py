# -*- coding: utf-8 -*-
"""
export_risk_link.py — เชื่อม Risk Score ↔ งบทดลอง (Phase 1, RISK_BS_LINK_DESIGN.md)
คำนวณ CR/QR/Cash/NWC/NI/EBITDA/Reserve จากงบทดลองตามผัง ratio_formula/ratio_items
(พิสูจน์ตรง 100% กับ risk_scores ที่ รพ. รายงาน — ดู Balance Sheet\\RISK_BS_LINK_DESIGN.md)
ใช้ค่า GL เป็นฐานคำนวณ decomposition/waterfall เสมอ (risk_scores ไม่มีรายละเอียดหมวดบัญชี)
ค่า cr/qr/cash/.../risk ที่แสดงใน summary ใช้ค่า "รายงานจริง" ก่อน ถ้าไม่มีค่อย fallback เป็นค่าจาก GL

output:
  docs/data/risk/summary.json   — ภาพรวมทั้งเขต งวดล่าสุด (สำหรับ L0/L1)
  docs/data/risk/h/{hcode}.json — รายละเอียดราย รพ. (เทรนด์/decomposition/waterfall/topAccounts) (L2-L4)
"""
import sys, json, os
import numpy as np
import pandas as pd
import pymysql

sys.stdout.reconfigure(encoding="utf-8")

REPO   = r"D:\Github\Rh1-BalanceSheet"
MASTER = os.path.join(REPO, "master.parquet")
META_J = os.path.join(REPO, "docs", "data", "meta.json")
OUT_DIR = os.path.join(REPO, "docs", "data", "risk")
OUT_H   = os.path.join(OUT_DIR, "h")
os.makedirs(OUT_H, exist_ok=True)

TH_M = ["ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย."]
tlab = lambda t: TH_M[t % 100 - 1] + str(t // 100 % 100)
TOPN_ACC = 20
HIST_N = 36  # จำนวนงวดล่าสุดที่เก็บใน trend/waterfall ราย รพ.

# ---------- 1) โหลดผังสูตร + ชื่อบัญชีจาก MySQL ----------
# 26xx/2600Y ฯลฯ = "7 Plus Efficiency Score" (AP ยา/AR UC-CS-SS/Inventory/Operating Margin/ROA)
# ตามชีท "7 Plus Efficiency Score" ใน รวมสูตร - พี่ตาล.xlsx — ไม่ผูกกับ Risk Score โดยตรง
# แต่เป็นตัวชี้ประสิทธิภาพเสริมที่ นพ.วัฒนชัยขอ (ข้อมูลพื้นฐาน+ประสิทธิภาพการดำเนินงาน)
EFF_IDS = ("2600X", "2600Y", "2610X", "2610Y", "2620X", "2620Y", "2630X", "2630Y",
           "2640X", "2640Y", "3200Y", "3210Y")
conn = pymysql.connect(host="localhost", user="root", db="rh1_health", charset="utf8mb4")
items = pd.read_sql(
    "SELECT RatioItemID, CodeL1 FROM ratio_items WHERE UseYN='Yes' AND RatioItemID IN "
    "('1001X','1001Y','1002X','1003X','1005X','1005Y','3006Y','3010X','3330X','3330Y'," +
    ",".join(f"'{x}'" for x in EFF_IDS) + ")", conn)
acc_names = pd.read_sql("SELECT CodeL1, Account1, CodeL2, Name2 FROM acc_hierarchy", conn)
rs = pd.read_sql(
    "SELECT hcode, time_id, cr, qr, cash, nwc, ni, li_score, st_score, su_score, "
    "risk_score, ebitda, reserve FROM risk_scores", conn)
conn.close()

acc_names = acc_names.drop_duplicates("CodeL1").set_index("CodeL1")
code_sets = {k: set(items.loc[items["RatioItemID"] == k, "CodeL1"]) for k in items["RatioItemID"].unique()}

rs["t"] = pd.to_numeric(rs["time_id"], errors="coerce").astype("int64")
rs["org5"] = rs["hcode"].astype(str).str.zfill(5)
for c in ["cr", "qr", "cash", "nwc", "ni", "ebitda", "reserve"]:
    rs[c] = pd.to_numeric(rs[c], errors="coerce")

# ---------- 2) org meta (จาก meta.json ที่ export_json.py สร้างไว้แล้ว) ----------
with open(META_J, encoding="utf-8") as f:
    meta = json.load(f)
orgs = {o["id"]: o for o in meta["orgs"]}
for o in orgs.values():
    o["level"] = (o.get("grp") or "").split(" ")[0] or None

# จำนวนเตียง — จาก รวมสูตร - พี่ตาล.xlsx (ไฟล์เดียวกับที่ใช้แบ่งกลุ่ม grp อยู่แล้ว ครบ 901/901 แถว)
bed_df = pd.read_excel(r"D:\Hospital\รวมสูตรและหลักเกณฑ์ต่างๆ\รวมสูตร - พี่ตาล.xlsx", sheet_name="รายชื่อ รพ")
bed_df = bed_df[bed_df["Ket"] == 1].copy()
bed_df["org5"] = bed_df["OrgID"].astype(int).astype(str).str.zfill(5)
bed_map = bed_df.set_index("org5")["Bed"].to_dict()
type_map = bed_df.set_index("org5")["TypeSer"].to_dict()
for k, o in orgs.items():
    o["bed"] = int(bed_map[k]) if k in bed_map and pd.notna(bed_map[k]) else None
    o["typeSer"] = type_map.get(k)

# ---------- 3) งบทดลอง → ค่า GL ราย รพ./งวด ----------
def acc_root(acc):
    p, _, rest = acc.partition(".")
    digits = rest.replace(".", "")
    return p + "." + digits[:3] if digits else acc

m = pd.read_parquet(MASTER, columns=["org5", "t", "acc", "bs", "inc"])
m = m[m["org5"].isin(orgs.keys())].copy()
m["root"] = m["acc"].map(acc_root)

# HowTo='Sum,Cr' (เช่น 2600Y เจ้าหนี้การค้ารวม) ต้องรวมยอดด้าน Cr ดิบ ไม่ใช่ยอดสุทธิ (bs)
# — คอลัมน์ 'inc' ใน master.parquet คือด้านเพิ่มตามธรรมชาติบัญชีอยู่แล้ว (Cr สำหรับหมวด 2/3/4)
SUM_CR_IDS = {"2600Y"}
# HowTo='Avg' (X-side ของ AP/AR/Inventory) ต้องเฉลี่ยยอดคงเหลือต้นงวด-ปลายงวด
AVG_END_IDS = {"2600X", "2610X", "2620X", "2630X", "2640X"}

agg = {}
for k, codes in code_sets.items():
    col = "inc" if k in SUM_CR_IDS else "bs"
    agg[k] = m[m["root"].isin(codes)].groupby(["org5", "t"])[col].sum()
gl = pd.DataFrame(agg).fillna(0.0).reset_index()
gl["cr_gl"]  = gl["1001X"] / gl["1001Y"].where(gl["1001Y"] != 0)
gl["qr_gl"]  = gl["1002X"] / gl["1001Y"].where(gl["1001Y"] != 0)
gl["cash_gl"] = gl["1003X"] / gl["1001Y"].where(gl["1001Y"] != 0)
gl["nwc_gl"] = gl["1001X"] - gl["1001Y"]
gl["ni_gl"]  = gl["3006Y"] - gl["3010X"]
gl["ebitda_gl"] = gl["3330X"] - gl["3330Y"]
gl["reserve_gl"] = gl["1005X"] - gl["1005Y"]

# ---------- 3b) เฉลี่ยยอดคงเหลือต้น-ปลายงวด (Avg) สำหรับ AP/AR/Inventory ----------
gl = gl.sort_values(["org5", "t"]).reset_index(drop=True)
for k in AVG_END_IDS:
    prev = gl.groupby("org5")[k].shift(1)
    gl[k + "_avg"] = np.where(prev.isna(), gl[k], (gl[k] + prev) / 2)

# ---------- 3c) 7 Plus Efficiency Score: APP/ACP/Inventory (วัน) + Operating Margin/ROA (%) ----------
def days_in_period(t):
    """จำนวนวันตามปฏิทินของเดือนงวด (ต.ค.=1..ก.ย.=12) — ไม่ปรับปีอธิกสุรทิน (ผลกระทบเล็กน้อยต่อ ก.พ.)"""
    m_ = t % 100
    cal_month = m_ + 9 if m_ <= 3 else m_ - 3   # 1(ต.ค.)->10, ... 4(ม.ค.)->1, ... 12(ก.ย.)->9
    return [31, 30, 31, 31, 28, 31, 30, 31, 30, 31, 31, 30][cal_month - 1]

days = gl["t"].map(days_in_period)
gl["app_gl"]    = (gl["2600X_avg"] / gl["2600Y"].where(gl["2600Y"] != 0)) * days
gl["acpUc_gl"]  = (gl["2610X_avg"] / gl["2610Y"].where(gl["2610Y"] != 0)) * days
gl["acpCs_gl"]  = (gl["2620X_avg"] / gl["2620Y"].where(gl["2620Y"] != 0)) * days
gl["acpSs_gl"]  = (gl["2630X_avg"] / gl["2630Y"].where(gl["2630Y"] != 0)) * days
gl["invDays_gl"] = (gl["2640X_avg"] / gl["2640Y"].where(gl["2640Y"] != 0)) * days
# หมายเหตุ: 3200X/3210X ใน ratio_items รวมบัญชีรายได้(หมวด4)+ค่าใช้จ่าย(หมวด5) ปนกันเป็น
# RatioItemID เดียว (Rate=1 ทั้งคู่ ไม่มีตัวคูณแยกส่วน) หาก sum ตรงๆ จะเป็นการ "บวก" ไม่ใช่ "ลบ"
# ทำให้ EBITDA/NI เพี้ยน — ใช้ ebitda_gl/ni_gl ที่คำนวณแยกฝั่งแล้วพิสูจน์ตรง 100% แทน
gl["opMargin_gl"] = (gl["ebitda_gl"] / gl["3200Y"].where(gl["3200Y"] != 0)) * 100
gl["roa_gl"]      = (gl["ni_gl"] / gl["3210Y"].where(gl["3210Y"] != 0)) * 100

# LI/ST คำนวณจากเกณฑ์ที่ยืนยันแล้ว (ตรง 100% กับรายงานจริง) — ใช้เป็น fallback + ใช้โชว์ trigger เสมอ
month_of = gl["t"] % 100
gl["li_gl"] = (gl["cr_gl"] < 1.5).astype(int) + (gl["qr_gl"] < 1.0).astype(int) + (gl["cash_gl"] < 0.8).astype(int)
gl["st_gl"] = (gl["nwc_gl"] < 0).astype(int) + (gl["ni_gl"] < 0).astype(int)

# SU (Survival Index) — สูตรทางการฉบับเต็ม 4 quadrant (ยืนยันจากชีท "7 Risk Scoring plus"
# ใน รวมสูตร - พี่ตาล.xlsx, พิสูจน์กับข้อมูลจริง 3,398 รพ.-งวด ตรง 99.3% — เหลือคลาดเฉพาะงวด ก.ย.
# ที่มีปัญหางวดปรับปรุงบัญชีอยู่แล้ว (ดู caveat ข้อ 1 ใน RISK_BS_LINK_DESIGN.md):
#   NWC>=0 & NI>=0  → SU=0 (ปลอดภัย)
#   NWC<0  & NI<0   → SU=2 (แย่สุด)
#   NWC>=0 & NI<0   → เวลาที่ NWC จะหมด = NWC/(|NI|/เดือน)  → <3mo:2, 3-6mo:1, >=6mo:0
#   NWC<0  & NI>0   → เวลาที่กำไรจะดัน NWC กลับบวก = |NWC|/(NI/เดือน) → <3mo:0, 3-6mo:1, >=6mo:2
m_safe = month_of.where(month_of > 0, 12)
ani_loss = gl["ni_gl"].abs() / m_safe
surv_deplete = gl["nwc_gl"] / ani_loss.where(ani_loss != 0)
ani_profit = gl["ni_gl"] / m_safe
surv_recover = (-gl["nwc_gl"]) / ani_profit.where(ani_profit != 0)

nwc_pos, ni_pos = gl["nwc_gl"] >= 0, gl["ni_gl"] >= 0
gl["su_gl"] = np.select(
    [nwc_pos & ni_pos, ~nwc_pos & ~ni_pos, nwc_pos & ~ni_pos, ~nwc_pos & ni_pos],
    [0, 2,
     np.where(surv_deplete < 3, 2, np.where(surv_deplete < 6, 1, 0)),
     np.where(surv_recover < 3, 0, np.where(surv_recover < 6, 1, 2))],
    default=0)
gl["risk_gl"] = gl["li_gl"] + gl["st_gl"] + gl["su_gl"]

# ---------- 4) รวมค่า "รายงานจริง" (ใช้ก่อน) กับ GL (fallback) ----------
j = gl.merge(rs[["org5", "t", "cr", "qr", "cash", "nwc", "ni", "li_score", "st_score",
                  "su_score", "risk_score", "ebitda", "reserve"]], on=["org5", "t"], how="left")

def coalesce(rep_col, gl_col, out_col, df):
    df[out_col] = df[rep_col]
    use_gl = df[out_col].isna()
    df[out_col] = df[out_col].where(~use_gl, df[gl_col])
    df["src_" + out_col] = np.where(use_gl, "gl", "reported")

for rep, glc, out in [("cr", "cr_gl", "cr"), ("qr", "qr_gl", "qr"), ("cash", "cash_gl", "cash"),
                       ("nwc", "nwc_gl", "nwc"), ("ni", "ni_gl", "ni"), ("ebitda", "ebitda_gl", "ebitda"),
                       ("reserve", "reserve_gl", "reserve")]:
    coalesce(rep, glc, out, j)
for rep, glc, out in [("li_score", "li_gl", "li"), ("st_score", "st_gl", "st"),
                       ("su_score", "su_gl", "su"), ("risk_score", "risk_gl", "risk")]:
    coalesce(rep, glc, out, j)

# 7 Plus Efficiency Score — คำนวณจาก GL เสมอ (ไม่มีค่า "รายงานจริง" คู่กันใน risk_scores)
for col in ("app", "acpUc", "acpCs", "acpSs", "invDays", "opMargin", "roa"):
    j[col] = j[col + "_gl"]

j = j.sort_values(["org5", "t"]).reset_index(drop=True)

# ---------- 5) peer percentile ต่องวด (grp / level / prov) ----------
j["prov"] = j["org5"].map(lambda o: orgs.get(o, {}).get("prov"))
j["grp"] = j["org5"].map(lambda o: orgs.get(o, {}).get("grp"))
j["level"] = j["org5"].map(lambda o: orgs.get(o, {}).get("level"))

def peer_stats(dim):
    g = j.groupby([dim, "t"])[["cr", "qr", "cash", "opMargin", "roa"]]
    q = g.quantile([0.25, 0.5, 0.75]).unstack()
    q.columns = [f"{c}_{int(p*100)}" for c, p in q.columns]
    return q.reset_index()

peer_by = {dim: peer_stats(dim) for dim in ("grp", "level", "prov")}

# ---------- 6) trigger flags (L1) งวดล่าสุด ----------
T = int(j["t"].max())
TPREV3 = sorted(j["t"].unique())
TPREV3 = TPREV3[-4] if len(TPREV3) >= 4 else TPREV3[0]

def triggers(row):
    t = []
    if pd.notna(row["cr"]) and row["cr"] < 1.5: t.append("cr")
    if pd.notna(row["qr"]) and row["qr"] < 1.0: t.append("qr")
    if pd.notna(row["cash"]) and row["cash"] < 0.8: t.append("cash")
    if pd.notna(row["nwc"]) and row["nwc"] < 0: t.append("nwc")
    if pd.notna(row["ni"]) and row["ni"] < 0: t.append("ni")
    if pd.notna(row["su"]) and row["su"] >= 1: t.append("survival")
    return t

latest = j[j["t"] == T].set_index("org5")
prev3 = j[j["t"] == TPREV3].set_index("org5")["risk"]

rnd = lambda v, n=2: None if pd.isna(v) else round(float(v), n)
summary_rows = []
for o, r in latest.iterrows():
    org = orgs.get(o, {})
    summary_rows.append({
        "hcode": o, "name": org.get("name", o), "prov": org.get("prov"), "grp": org.get("grp"),
        "level": org.get("level"), "bed": org.get("bed"), "typeSer": org.get("typeSer"),
        "risk": rnd(r["risk"], 0), "li": rnd(r["li"], 0), "st": rnd(r["st"], 0), "su": rnd(r["su"], 0),
        "riskPrev3": rnd(prev3.get(o), 0),
        "cr": rnd(r["cr"]), "qr": rnd(r["qr"]), "cash": rnd(r["cash"]),
        "nwc": rnd(r["nwc"], 0), "ni": rnd(r["ni"], 0), "ebitda": rnd(r["ebitda"], 0), "reserve": rnd(r["reserve"], 0),
        "triggers": triggers(r),
        "source": r["src_risk"],
        "app": rnd(r["app"], 1), "acpUc": rnd(r["acpUc"], 1), "acpCs": rnd(r["acpCs"], 1),
        "acpSs": rnd(r["acpSs"], 1), "invDays": rnd(r["invDays"], 1),
        "opMargin": rnd(r["opMargin"], 1), "roa": rnd(r["roa"], 1),
    })
summary_rows.sort(key=lambda x: (-(x["risk"] or 0), x["hcode"]))
summary_by_org = {r["hcode"]: r for r in summary_rows}

# ---------- 7) ราย รพ.: trend + decomposition + waterfall + topAccounts ----------
CA_CODES  = code_sets["1001X"]
CL_CODES  = code_sets["1001Y"]
REV_CODES = code_sets["3006Y"]   # รายได้รวม — ตัวตั้งของ NI (ดู RISK_BS_LINK_DESIGN.md ข้อ 3.2)
EXP_CODES = code_sets["3010X"]   # ค่าใช้จ่ายรวม — ตัวหักของ NI

name2_map = acc_names["Name2"].to_dict()
acc1_map = acc_names["Account1"].to_dict()

def subgroup_name(root):
    return name2_map.get(root) or "อื่นๆ นอกผัง"

def account_name(root):
    return acc1_map.get(root) or root

def decompose(cur_row, base_row, x_key, y_key):
    """Δratio แยกจากตัวเศษ (X) / ตัวส่วน (Y) — ใช้ Y ของงวดฐานคุมตัวเศษ"""
    x1, y1 = cur_row[x_key], cur_row[y_key]
    x0, y0 = base_row[x_key], base_row[y_key]
    if y0 in (0, None) or pd.isna(y0) or y1 in (0, None) or pd.isna(y1):
        return None
    from_x = (x1 - x0) / y0
    from_y = x0 * (1 / y1 - 1 / y0)
    return {"total": round(float(x1/y1 - x0/y0), 4), "fromNumerator": round(float(from_x), 4),
            "fromDenominator": round(float(from_y), 4)}

def ni_bridge(cur_row, base_row):
    """ΔNI = Δรายได้(3006Y) − Δค่าใช้จ่าย(3010X) — สะพานกำไร/ขาดทุน (ไม่ใช่ ratio จึงไม่หาร)"""
    rev1, rev0 = cur_row["3006Y"], base_row["3006Y"]
    exp1, exp0 = cur_row["3010X"], base_row["3010X"]
    if pd.isna(rev1) or pd.isna(rev0) or pd.isna(exp1) or pd.isna(exp0):
        return None
    d_rev, d_exp = rev1 - rev0, exp1 - exp0
    return {"total": round(float(d_rev - d_exp), 0), "fromRevenue": round(float(d_rev), 0),
            "fromExpense": round(float(-d_exp), 0)}

# ---- ตัดข้อมูลให้เหลือเฉพาะบัญชีที่ใช้จริงใน waterfall/topAccounts (CA/CL/รายได้/ค่าใช้จ่าย)
# แล้วแยกตาม รพ. ครั้งเดียว (แทนการ filter ข้อมูลทั้งภูมิภาค 4M แถวซ้ำนับร้อยครั้ง — เดิมช้ามาก ~5 นาที/รพ.ใหญ่)
BUCKET_CODES = {"CA": CA_CODES, "CL": CL_CODES, "REV": REV_CODES, "EXP": EXP_CODES}
ALL_BUCKET_CODES = CA_CODES | CL_CODES | REV_CODES | EXP_CODES
m_buckets = m[m["root"].isin(ALL_BUCKET_CODES)].copy()
bucket_of = {c: b for b, codes in BUCKET_CODES.items() for c in codes}
m_buckets["bucket"] = m_buckets["root"].map(bucket_of)
m_by_org = {o: sub for o, sub in m_buckets.groupby("org5")}

def waterfall(org_df, t_cur, t_base, bucket):
    """Δมูลค่าตามหมวดย่อย (Name2) ระหว่าง 2 งวด สำหรับ รพ. org5"""
    sub = org_df[(org_df["bucket"] == bucket) & (org_df["t"].isin((t_cur, t_base)))]
    cur = sub[sub["t"] == t_cur]
    base = sub[sub["t"] == t_base]
    cur_g = cur.groupby(cur["root"].map(subgroup_name))["bs"].sum()
    base_g = base.groupby(base["root"].map(subgroup_name))["bs"].sum()
    allk = sorted(set(cur_g.index) | set(base_g.index))
    rows = []
    for k in allk:
        v1, v0 = cur_g.get(k, 0.0), base_g.get(k, 0.0)
        if abs(v1) < 1 and abs(v0) < 1:
            continue
        rows.append({"name": k, "value": round(float(v1), 0), "delta": round(float(v1 - v0), 0)})
    rows.sort(key=lambda r: -abs(r["delta"]))
    return rows

def top_accounts(org_df, t_cur, t_base, bucket, cls_label):
    sub = org_df[(org_df["bucket"] == bucket) & (org_df["t"].isin((t_cur, t_base)))]
    cur_g = sub[sub["t"] == t_cur].groupby("root")["bs"].sum()
    base_g = sub[sub["t"] == t_base].groupby("root")["bs"].sum()
    allk = set(cur_g.index) | set(base_g.index)
    out = []
    for k in allk:
        v1, v0 = cur_g.get(k, 0.0), base_g.get(k, 0.0)
        d = v1 - v0
        if abs(d) < 1:
            continue
        out.append({"acc": k, "name": account_name(k), "cls": cls_label,
                     "value": round(float(v1), 0), "delta": round(float(d), 0)})
    return out

periods_all = sorted(j["t"].unique().tolist())
empty_org_df = m_buckets.iloc[0:0]

for idx, org5 in enumerate(sorted(orgs.keys())):
    hj = j[j["org5"] == org5].sort_values("t")
    if hj.empty:
        continue
    hperiods = [t for t in periods_all if t in set(hj["t"])][-HIST_N:]
    hj = hj[hj["t"].isin(hperiods)]

    trend = []
    for _, r in hj.iterrows():
        trend.append({
            "t": int(r["t"]), "cr": rnd(r["cr"]), "qr": rnd(r["qr"]), "cash": rnd(r["cash"]),
            "nwc": rnd(r["nwc"], 0), "ni": rnd(r["ni"], 0), "ebitda": rnd(r["ebitda"], 0),
            "reserve": rnd(r["reserve"], 0), "li": rnd(r["li"], 0), "st": rnd(r["st"], 0),
            "su": rnd(r["su"], 0), "risk": rnd(r["risk"], 0), "source": r["src_risk"],
            # ค่าดิบตัวเศษ/ตัวส่วนตามผัง (GL) — ใช้ให้ Gap-to-Target Solver คำนวณช่องว่างเชิงบาทแม่นระดับบาท
            # ca=สินทรัพย์หมุนเวียน(1001X) cl=หนี้สินหมุนเวียน(1001Y, ตัวส่วนทุก ratio)
            # qn=ตัวเศษ Quick(1002X) cn=ตัวเศษ Cash(1003X) rev=รายได้รวม(3006Y) exp=ค่าใช้จ่ายรวม(3010X)
            "ca": rnd(r["1001X"], 0), "cl": rnd(r["1001Y"], 0),
            "qn": rnd(r["1002X"], 0), "cn": rnd(r["1003X"], 0),
            "rev": rnd(r["3006Y"], 0), "exp": rnd(r["3010X"], 0),
            "app": rnd(r["app"], 1), "acpUc": rnd(r["acpUc"], 1), "acpCs": rnd(r["acpCs"], 1),
            "acpSs": rnd(r["acpSs"], 1), "invDays": rnd(r["invDays"], 1),
            "opMargin": rnd(r["opMargin"], 1), "roa": rnd(r["roa"], 1),
        })

    org = orgs.get(org5, {})
    peer = {}
    for dim, key in [("grp", org.get("grp")), ("level", org.get("level")), ("prov", org.get("prov"))]:
        if not key:
            peer[dim] = []
            continue
        pdf = peer_by[dim]
        sub = pdf[(pdf[dim] == key) & (pdf["t"].isin(hperiods))].sort_values("t")
        peer[dim] = [
            {"t": int(r["t"]),
             "cr_p25": rnd(r["cr_25"]), "cr_med": rnd(r["cr_50"]), "cr_p75": rnd(r["cr_75"]),
             "qr_p25": rnd(r["qr_25"]), "qr_med": rnd(r["qr_50"]), "qr_p75": rnd(r["qr_75"]),
             "cash_p25": rnd(r["cash_25"]), "cash_med": rnd(r["cash_50"]), "cash_p75": rnd(r["cash_75"]),
             "opMargin_med": rnd(r["opMargin_50"], 1), "roa_med": rnd(r["roa_50"], 1)}
            for _, r in sub.iterrows()
        ]

    tcur = hperiods[-1]
    tmom = hperiods[-2] if len(hperiods) >= 2 else None
    tyoy_candidates = [t for t in hperiods if t == tcur - 100]
    tyoy = tyoy_candidates[0] if tyoy_candidates else None

    org_df = m_by_org.get(org5, empty_org_df)
    cur_row = hj[hj["t"] == tcur].iloc[0]
    decomp = {}
    wf = {}
    topacc = {}
    topaccPL = {}
    for label, base_t in [("mom", tmom), ("yoy", tyoy)]:
        if base_t is None:
            continue
        base_row = hj[hj["t"] == base_t].iloc[0]
        decomp[label] = {
            "baseT": int(base_t),
            "cr": decompose(cur_row, base_row, "1001X", "1001Y"),
            "qr": decompose(cur_row, base_row, "1002X", "1001Y"),
            "cash": decompose(cur_row, base_row, "1003X", "1001Y"),
            "ni": ni_bridge(cur_row, base_row),
        }
        wf[label] = {
            "baseT": int(base_t),
            "ca": waterfall(org_df, tcur, base_t, "CA"),
            "cl": waterfall(org_df, tcur, base_t, "CL"),
            "rev": waterfall(org_df, tcur, base_t, "REV"),
            "exp": waterfall(org_df, tcur, base_t, "EXP"),
        }
        acc_ca = top_accounts(org_df, tcur, base_t, "CA", "CA")
        acc_cl = top_accounts(org_df, tcur, base_t, "CL", "CL")
        combo = sorted(acc_ca + acc_cl, key=lambda r: -abs(r["delta"]))[:TOPN_ACC]
        topacc[label] = {"baseT": int(base_t), "accounts": combo}

        acc_rev = top_accounts(org_df, tcur, base_t, "REV", "REV")
        acc_exp = top_accounts(org_df, tcur, base_t, "EXP", "EXP")
        comboPL = sorted(acc_rev + acc_exp, key=lambda r: -abs(r["delta"]))[:TOPN_ACC]
        topaccPL[label] = {"baseT": int(base_t), "accounts": comboPL}

    # เก็บ "สาเหตุหลัก" (top mover MoM ต่อหมวด) ไว้ใน summary.json ด้วย — ใช้ประกอบ Watchlist
    # (ไม่ต้อง fetch ไฟล์ราย รพ. เพิ่มตอนแสดงตาราง Watchlist ทั้งเขต)
    if org5 in summary_by_org and "mom" in wf:
        top1 = lambda rows: (rows[0]["name"], rows[0]["delta"]) if rows else (None, None)
        ca_n, ca_d = top1(wf["mom"]["ca"]); cl_n, cl_d = top1(wf["mom"]["cl"])
        exp_n, exp_d = top1(wf["mom"]["exp"]); rev_n, rev_d = top1(wf["mom"]["rev"])
        summary_by_org[org5]["topCause"] = {
            "ca": {"name": ca_n, "delta": ca_d}, "cl": {"name": cl_n, "delta": cl_d},
            "rev": {"name": rev_n, "delta": rev_d}, "exp": {"name": exp_n, "delta": exp_d},
        }

    out = {
        "hcode": org5, "name": org.get("name"), "prov": org.get("prov"),
        "grp": org.get("grp"), "level": org.get("level"),
        "bed": org.get("bed"), "typeSer": org.get("typeSer"),
        "period": int(tcur), "periodLabel": tlab(int(tcur)),
        "trend": trend, "peer": peer, "decomp": decomp, "waterfall": wf,
        "topAccounts": topacc, "topAccountsPL": topaccPL,
    }
    path = os.path.join(OUT_H, f"{org5}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    if (idx + 1) % 20 == 0 or idx == len(orgs) - 1:
        print(f"  ... {idx+1}/{len(orgs)} รพ.")

with open(os.path.join(OUT_DIR, "summary.json"), "w", encoding="utf-8") as f:
    json.dump({
        "period": T, "periodLabel": tlab(T), "periodPrev3": int(TPREV3),
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d"),
        "nHosp": len(summary_rows), "hospitals": summary_rows,
    }, f, ensure_ascii=False, separators=(",", ":"))
print(f"WROTE {os.path.join(OUT_DIR, 'summary.json')} ({os.path.getsize(os.path.join(OUT_DIR, 'summary.json'))/1024:.1f} KB)")

total = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fs in os.walk(OUT_DIR) for fn in fs)
print(f"\nWROTE {len(orgs)} ไฟล์ h/*.json | รวมขนาด docs/data/risk: {total/1024/1024:.2f} MB")
