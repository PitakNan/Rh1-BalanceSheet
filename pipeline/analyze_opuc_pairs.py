# -*- coding: utf-8 -*-
"""
analyze_opuc_pairs.py — จับคู่ "เจ้าหนี้ ↔ ลูกหนี้" ค่ารักษา OP-UC นอก CUP รายคู่โรงพยาบาล
เจ้าของงานสั่ง 12 ส.ค. 69

ที่มาของข้อมูล: ตาราง DataIn ใน .mdb ของ HFO โดยตรง (ไม่ใช่ master.parquet)
  เพราะ parquet เก็บแค่ acc/bs — **ชื่อบัญชีที่ รพ. ตั้งเอง (AccName) อยู่ใน mdb เท่านั้น**
  และชื่อคู่สัญญาถูกเขียนต่อท้ายชื่อบัญชี เช่น
      2101020199.20201  "เจ้าหนี้ค่ารักษา OP-UC นอก CUP (ในจังหวัดสังกัด สธ.)-รพ.น่าน"

⚠️ ตาราง `DataInterAccount` ใน mdb (pDate/FromOrgID/AccCode/ToOrgID/ToDr/ToCr) ออกแบบมา
   เพื่อการนี้โดยตรง แต่ **ว่างเปล่า 0 แถว** — ต้นทางไม่ได้กรอก จึงต้องแกะจากชื่อบัญชีเอง

บัญชีที่ดู (ตรงกับ export_exec.py):
  เจ้าหนี้ 2101020199.202 (ในจังหวัด สธ.) · .203 (ต่างจังหวัด สธ.)
  ลูกหนี้  1102050101.203 + 1102050194.204 (ในจังหวัด) · .204/.205 (ต่างจังหวัด)
รหัสย่อยที่ รพ. แตกเองต่อท้าย มีทั้งแบบ .20201 / .202001 / .2021 / .202.01 — ต้องรับทุกแบบ

ผลลัพธ์: pipeline/out/opuc_pairs.csv (รายคู่) + opuc_report.txt (สรุปอ่านคน)
"""
import io, os, re, sys, json, collections, difflib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import pyodbc

MDB = os.environ.get("OPUC_MDB", r"D:\OneDrive\Share Rh1-New\0 Claude Cowork\Dashboard AI"
                                 r"\Balance Sheet\incoming\D5317_2026-08.mdb")
PDATE = os.environ.get("OPUC_PDATE", "2026-07-31")      # งวดล่าสุดในไฟล์
EXEC_J = r"D:\Github\Rh1-BalanceSheet\docs\data\risk\exec.json"
OUT_DIR = r"D:\Github\Rh1-BalanceSheet\pipeline\out"

PAY_IN, PAY_OUT = "2101020199.202", "2101020199.203"
AR_IN  = ("1102050101.203", "1102050194.204")
AR_OUT = ("1102050101.204", "1102050194.205")

# ── ตัดคำอธิบายมาตรฐานหน้าชื่อคู่สัญญาออก ────────────────────────────────────
# ชื่อบัญชีมีหลายทรง: "...(ในจังหวัดสังกัด สธ.)-รพ.น่าน" · "...สังกัด สธ. รพ.น่าน" ·
# "ลูกหนี้ค่ารักษา UC - OP นอก CUP (รพ.บ่อเกลือ)" · บางแห่งใส่แค่ "เวียงสา" เปล่า ๆ
RE_TAIL = re.compile(r'^.*?(?:\(?\s*(?:ใน|ต่าง)จังหวัด[^)]*\)?)\s*[-–]?\s*')
RE_PAREN_ONLY = re.compile(r'^.*นอก\s*CUP\s*\((.+?)\)\s*$')
RE_DASH_TAIL = re.compile(r'^.*(?:สป\.?สธ\.?|CUP)\s*[-–]\s*(.+)$')
# คำที่ไม่ใช่ชื่อ รพ. — เป็นการแตกบัญชีตามประเภทบริการ ไม่ใช่ตามคู่สัญญา
NOT_HOSP = re.compile(r'^(ER|CT|Refer|Anywhere|ยา\s|OPD|IPD|LAB|X-?RAY)', re.I)

# เศษคำนำหน้าที่หลุดมาติดกับชื่อ รพ. เช่น "ในจังหวัด รพช.เวียงสา" · "เขตรอยต่อ รพ.น่าน"
RE_LEAD = re.compile(r'^(?:ใน|ต่าง)จังหวัด(?:สังกัด)?\s*(?:สธ\.?)?\s*|^เขตรอยต่อ\s*|^สังกัด\s*สธ\.?\s*')

def cp_text(name):
    s = str(name or "").strip()
    m = RE_PAREN_ONLY.match(s)
    t = m.group(1).strip() if m else None
    if t is None:
        t = RE_TAIL.sub("", s).strip(" -–")
        if t == s:                               # ไม่เจอวงเล็บ (ใน/ต่าง)จังหวัด
            m = RE_DASH_TAIL.match(s)
            if m: t = m.group(1).strip()
    for _ in range(3):                           # ลอกเศษคำนำหน้าซ้อนกันได้หลายชั้น
        t2 = RE_LEAD.sub("", t).strip(" -–")
        if t2 == t: break
        t = t2
    return t.strip(" -–")

# ── ทำชื่อให้เทียบกันได้ ─────────────────────────────────────────────────────
PFX = ("โรงพยาบาลสมเด็จพระยุพราช", "โรงพยาบาล", "รพร.", "รพศ.", "รพท.", "รพช.", "รพ.", "รพ")
def norm(s):
    s = str(s or "").strip()
    yupparat = s.startswith("รพร.") or s.startswith("โรงพยาบาลสมเด็จพระยุพราช") or "สมเด็จพระยุพราช" in s
    for p in PFX:
        if s.startswith(p): s = s[len(p):]; break
    s = s.replace("สมเด็จพระยุพราช", "")
    s = re.sub(r'[\s\.\(\)ฯ]', "", s)
    if yupparat: s = "สมเด็จพระยุพราช" + s
    return s

def main():
    ex = json.load(io.open(EXEC_J, encoding="utf-8"))
    HOSP = {h["hcode"]: h for h in ex["hosp"]}
    # ดัชนีชื่อ → hcode แยกตามจังหวัด (คู่สัญญาส่วนใหญ่อยู่จังหวัดเดียวกัน จึงเทียบในจังหวัดก่อน)
    by_prov = collections.defaultdict(dict)
    all_nm = {}
    for h in ex["hosp"]:
        n = norm(h["name"])
        by_prov[h.get("prov", "")][n] = h["hcode"]
        all_nm.setdefault(n, h["hcode"])

    def match(cp, prov):
        """คืน (hcode, วิธีจับคู่) — None ถ้าจับไม่ได้"""
        n = norm(cp)
        if not n: return None, "ว่าง"
        if NOT_HOSP.match(cp.strip()): return None, "ไม่ใช่ชื่อ รพ."
        for scope, tag in ((by_prov.get(prov, {}), "ในจังหวัด"), (all_nm, "ข้ามจังหวัด")):
            if n in scope: return scope[n], tag
            # ชื่อในบัญชีถูกตัดท้าย (ช่อง AccName สั้น) → ยอมให้เป็น prefix กันได้ ถ้าไม่กำกวม
            cand = [hc for k, hc in scope.items() if k.startswith(n) or n.startswith(k)]
            if len(set(cand)) == 1: return cand[0], tag + " (ชื่อถูกตัด)"
            if len(set(cand)) > 1: return None, "กำกวม"
            # รพร.: บัญชีเขียนแค่ชื่ออำเภอ ("รพ.ปัว") แต่ชื่อทางการคือ "สมเด็จพระยุพราชปัว"
            cand = [hc for k, hc in scope.items() if k.startswith("สมเด็จพระยุพราช")
                    and (k.endswith(n) or n.endswith(k.replace("สมเด็จพระยุพราช", "")))]
            if len(set(cand)) == 1: return cand[0], tag + " (รพร.)"
            # พิมพ์ตกหล่นเล็กน้อย เช่น "รพร.ด่นชัย" → "เด่นชัย" · คุมด้วย cutoff สูงกันจับมั่ว
            base = {k.replace("สมเด็จพระยุพราช", ""): hc for k, hc in scope.items()}
            close = difflib.get_close_matches(n, list(base), n=2, cutoff=0.85)
            if len(close) == 1: return base[close[0]], tag + " (สะกดต่าง)"
        return None, "ไม่พบในชุด 103"

    c = pyodbc.connect(r"Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=" + MDB)
    cur = c.cursor()
    like = " OR ".join(f"AccCode LIKE '{p}%'" for p in
                       (PAY_IN, PAY_OUT) + AR_IN + AR_OUT)
    cur.execute(f"SELECT OrgID, AccCode, AccName, EndDr, EndCr FROM [DataIn] "
                f"WHERE PDate=#{PDATE}# AND ({like})")
    raw = [(str(o).zfill(5), str(a), str(n or ""), float(dr or 0), float(cr or 0))
           for o, a, n, dr, cr in cur.fetchall()]
    c.close()

    # ── แยกเป็น 4 ถัง แล้วจับคู่ ────────────────────────────────────────────
    pay, ar = collections.defaultdict(list), collections.defaultdict(list)   # org -> [(cp, amt, acc, root)]
    lump = collections.defaultdict(lambda: collections.defaultdict(float))   # org -> root -> ยอดที่ไม่แตกย่อย
    unmatched = []
    for org, acc, nm, dr, cr in raw:
        root = next((p for p in (PAY_IN, PAY_OUT) + AR_IN + AR_OUT if acc.startswith(p)), None)
        if root is None: continue
        side = "pay" if root.startswith("2101") else "ar"
        amt = (cr - dr) if side == "pay" else (dr - cr)      # ให้เป็นบวก = ยอดคงค้าง
        if acc == root:                                       # ไม่แตกย่อย = ก้อนรวม
            lump[org][root] += amt
            continue
        cp = cp_text(nm)
        hc, how = match(cp, HOSP.get(org, {}).get("prov", ""))
        # scope ตามผังบัญชี: .202 / .203+.204(ลูกหนี้) = ในจังหวัด · ที่เหลือ = ต่างจังหวัด
        scope = "in" if root in (PAY_IN,) + AR_IN else "out"
        rec = dict(org=org, acc=acc, root=root, scope=scope,
                   cp=cp, cp_hcode=hc, how=how, amt=amt)
        (pay if side == "pay" else ar)[org].append(rec)
        if hc is None: unmatched.append(rec)

    # คู่ A→B: A ตั้งเจ้าหนี้ให้ B  ↔  B ตั้งลูกหนี้จาก A
    # ⚠️ รพ. เดียวกันอาจแตกหลายบัญชีย่อยไปที่คู่สัญญาเดียวกัน (เช่นแยก Refer/Anywhere แล้วยัง
    #    แยกราย รพ. ด้วย) → ต้องรวมยอด ไม่ใช่ทับกัน ไม่งั้นยอดหายเงียบ
    pairs = {}
    def put(key, side, r):
        d = pairs.setdefault(key, {})
        if side in d: d[side] = {**d[side], "amt": d[side]["amt"] + r["amt"], "acc": d[side]["acc"] + "+"}
        else: d[side] = dict(r)
    for org, rs in pay.items():
        for r in rs:
            if r["cp_hcode"]: put((org, r["cp_hcode"]), "pay", r)
    for org, rs in ar.items():
        for r in rs:
            if r["cp_hcode"]: put((r["cp_hcode"], org), "ar", r)

    os.makedirs(OUT_DIR, exist_ok=True)
    nm_of = lambda hc: HOSP.get(hc, {}).get("name", "(นอกชุด 103)")
    pv_of = lambda hc: HOSP.get(hc, {}).get("prov", "")
    with io.open(os.path.join(OUT_DIR, "opuc_pairs.csv"), "w", encoding="utf-8-sig") as f:
        # 🪤 หัวคอลัมน์ห้ามซ้ำกัน — เคยใช้ "ชื่อ"/"จังหวัด" ทั้งสองฝั่ง แล้ว csv.DictReader
        #    ยุบคีย์ซ้ำเหลือค่าหลังสุด อ่านกลับมาได้ชื่อผู้รับทั้งสองช่อง (เจอจริง 12 ส.ค. 69)
        f.write("ผู้จ่าย(hcode),ผู้จ่าย,จังหวัดผู้จ่าย,ผู้รับ(hcode),ผู้รับ,จังหวัดผู้รับ,"
                "ยอดที่ผู้จ่ายบันทึก,ยอดที่ผู้รับบันทึก,ผลต่าง,สถานะ\n")
        for (a, b), d in sorted(pairs.items(), key=lambda x: -(max(
                x[1].get("pay", {}).get("amt", 0), x[1].get("ar", {}).get("amt", 0)))):
            p = d.get("pay", {}).get("amt"); r = d.get("ar", {}).get("amt")
            st = "จับคู่ได้ 2 ทาง" if p is not None and r is not None else (
                 "มีเฉพาะฝั่งลูกหนี้(ผู้รับ)" if p is None else "มีเฉพาะฝั่งเจ้าหนี้(ผู้จ่าย)")
            diff = (p - r) if (p is not None and r is not None) else ""
            f.write(f"{a},{nm_of(a)},{pv_of(a)},{b},{nm_of(b)},{pv_of(b)},"
                    f"{'' if p is None else round(p,2)},{'' if r is None else round(r,2)},"
                    f"{'' if diff=='' else round(diff,2)},{st}\n")

    # ── รายงานอ่านคน ────────────────────────────────────────────────────────
    both = {k: v for k, v in pairs.items() if "pay" in v and "ar" in v}
    only_p = {k: v for k, v in pairs.items() if "pay" in v and "ar" not in v}
    only_r = {k: v for k, v in pairs.items() if "ar" in v and "pay" not in v}
    tot_pay_sub = sum(r["amt"] for rs in pay.values() for r in rs)
    tot_ar_sub  = sum(r["amt"] for rs in ar.values() for r in rs)
    tot_pay_lump = sum(v[PAY_IN] + v[PAY_OUT] for v in lump.values() for _ in [0]) if lump else 0
    tot_pay_lump = sum(v.get(PAY_IN, 0) + v.get(PAY_OUT, 0) for v in lump.values())
    tot_ar_lump  = sum(sum(v.get(k, 0) for k in AR_IN + AR_OUT) for v in lump.values())
    # ✅ ตรวจความถูกต้องของการดึง: ยอด .202 (ในจังหวัด) ที่รวมเองต้องเท่ากับ tj.payIn ใน exec.json
    #    ที่แดชบอร์ดใช้จริง — ถ้าไม่ตรงแปลว่าอ่าน mdb ผิดงวด/ผิดบัญชี ห้ามเชื่อผลจับคู่
    mine = collections.defaultdict(float)
    for org, acc, nm, dr, cr in raw:
        if acc.startswith(PAY_IN): mine[org] += (cr - dr)
    diff = [(o, round(mine.get(o, 0), 2), round(h.get("tj", {}).get("payIn", 0), 2))
            for o, h in HOSP.items()
            if abs(mine.get(o, 0) - h.get("tj", {}).get("payIn", 0)) > 1]

    L = []
    L.append(f"งวด {PDATE} · ไฟล์ {os.path.basename(MDB)}")
    L.append(f"ตรวจยอดกับ exec.json (คอลัมน์เจ้าหนี้ในแดชบอร์ด): "
             + ("✅ ตรงทุกแห่ง" if not diff else f"❌ ไม่ตรง {len(diff)} แห่ง {diff[:5]}"))
    L.append(f"รพ. ที่แตกรหัสย่อยรายคู่สัญญา: เจ้าหนี้ {len(pay)} แห่ง · ลูกหนี้ {len(ar)} แห่ง "
             f"(จากทั้งหมด {len(HOSP)} แห่ง)")
    L.append(f"ยอดที่แตกย่อยได้: เจ้าหนี้ {tot_pay_sub:,.0f} · ลูกหนี้ {tot_ar_sub:,.0f}")
    L.append(f"ยอดที่ยังเป็นก้อนรวม: เจ้าหนี้ {tot_pay_lump:,.0f} · ลูกหนี้ {tot_ar_lump:,.0f}")
    cov_p = tot_pay_sub / (tot_pay_sub + tot_pay_lump) * 100 if (tot_pay_sub + tot_pay_lump) else 0
    cov_a = tot_ar_sub / (tot_ar_sub + tot_ar_lump) * 100 if (tot_ar_sub + tot_ar_lump) else 0
    L.append(f"สัดส่วนที่ระบุคู่สัญญาได้: เจ้าหนี้ {cov_p:.1f}% · ลูกหนี้ {cov_a:.1f}%")
    L.append("")
    L.append(f"คู่ที่ **จับได้ทั้งสองทาง** {len(both)} คู่ · มีเฉพาะฝั่งผู้จ่าย {len(only_p)} คู่ "
             f"· มีเฉพาะฝั่งผู้รับ {len(only_r)} คู่")
    if both:
        sp = sum(v['pay']['amt'] for v in both.values()); sr = sum(v['ar']['amt'] for v in both.values())
        L.append(f"  รวมยอดคู่สองทาง: ผู้จ่ายบันทึก {sp:,.0f} · ผู้รับบันทึก {sr:,.0f} "
                 f"· ต่างกัน {sp-sr:+,.0f} ({abs(sp-sr)/max(sp,1)*100:.1f}%)")
        agree = sum(1 for v in both.values() if abs(v['pay']['amt'] - v['ar']['amt']) < 1)
        L.append(f"  ตรงกันเป๊ะ (ต่างกัน < 1 บาท) {agree}/{len(both)} คู่")
    L.append("")
    # ══ เทียบรายจังหวัด: จับคู่ได้แค่ไหน + หักกลบภายในจังหวัดได้เท่าไหร่ ══════════
    # ⚠️ ส่วนนี้ดู **เฉพาะบัญชีในจังหวัด** (.202 ฝั่งเจ้าหนี้ · .203/.204 ฝั่งลูกหนี้)
    #    เพราะการหักกลบทำได้จริงแค่ในจังหวัดเดียวกัน (กติกาจัดสรร ข้อ ① — ดู 7.10 ③)
    #    ตัวหารของ % ความครอบคลุมใช้ tj.payIn / tj.arIn จาก exec.json = ยอดทางการที่แดชบอร์ดใช้
    nprov = collections.Counter(h.get("prov", "?") for h in HOSP.values())
    prov_pairs = collections.defaultdict(dict)          # prov -> {(a,b): d}  เฉพาะคู่ในจังหวัดเดียวกัน
    for (a, b), d in pairs.items():
        pa, pb = pv_of(a), pv_of(b)
        if pa and pa == pb: prov_pairs[pa][(a, b)] = d
    def scoped(bucket, prov, sc):
        return sum(r["amt"] for o, rs in bucket.items() if pv_of(o) == prov
                   for r in rs if r["scope"] == sc and r["cp_hcode"])
    rows_pv = []
    for prov in nprov:
        hs = [o for o in HOSP if pv_of(o) == prov]
        pay_off = sum(HOSP[o].get("tj", {}).get("payIn", 0) for o in hs)     # ยอดทางการในจังหวัด
        ar_off  = sum(HOSP[o].get("tj", {}).get("arIn", 0) for o in hs)
        n_pay = sum(1 for o in hs if any(r["scope"] == "in" for r in pay.get(o, [])))
        n_ar  = sum(1 for o in hs if any(r["scope"] == "in" for r in ar.get(o, [])))
        m_pay, m_ar = scoped(pay, prov, "in"), scoped(ar, prov, "in")
        P = prov_pairs.get(prov, {})
        nb = sum(1 for v in P.values() if "pay" in v and "ar" in v)
        n1 = len(P) - nb
        ok = sum(1 for v in P.values() if "pay" in v and "ar" in v
                 and abs(v["pay"]["amt"] - v["ar"]["amt"]) < 1)
        # ยอดที่ยึดใช้จริง = ค่าสูงสุดของสองฝั่ง (ระมัดระวัง: ฝั่งไหนบันทึกมากกว่าใช้ตัวนั้น)
        flow = sum(max(v.get("pay", {}).get("amt", 0), v.get("ar", {}).get("amt", 0)) for v in P.values())
        net = collections.defaultdict(float)
        for (a, b), v in P.items():
            x = max(v.get("pay", {}).get("amt", 0), v.get("ar", {}).get("amt", 0))
            net[a] -= x; net[b] += x
        rows_pv.append(dict(prov=prov, n=nprov[prov], n_pay=n_pay, n_ar=n_ar,
                            pay_off=pay_off, ar_off=ar_off, m_pay=m_pay, m_ar=m_ar,
                            npair=len(P), nb=nb, n1=n1, ok=ok, flow=flow, net=dict(net)))
    rows_pv.sort(key=lambda r: -r["flow"])
    with io.open(os.path.join(OUT_DIR, "opuc_prov.csv"), "w", encoding="utf-8-sig") as f:
        # 🪤 หัวคอลัมน์ห้ามซ้ำ (บทเรียนเดียวกับ opuc_pairs.csv) — "ที่ระบุคู่ได้" เคยมี 2 ช่อง
        #    ทั้งฝั่งเจ้าหนี้/ลูกหนี้ แล้ว DictReader ยุบเหลือค่าหลังสุด รวมยอดได้ต่ำกว่าจริง 3 เท่า
        f.write("จังหวัด,รพ.ทั้งหมด,แตกย่อยฝั่งเจ้าหนี้,แตกย่อยฝั่งลูกหนี้,"
                "เจ้าหนี้ในจังหวัด(ทางการ),เจ้าหนี้ที่ระบุคู่ได้,%ครอบคลุมเจ้าหนี้,"
                "ลูกหนี้ในจังหวัด(ทางการ),ลูกหนี้ที่ระบุคู่ได้,%ครอบคลุมลูกหนี้,"
                "คู่ทั้งหมด,คู่สองทาง,คู่ข้างเดียว,คู่ที่ตรงกันเป๊ะ,ยอดที่ไหลในจังหวัด,ระดับความพร้อม\n")
        for r in rows_pv:
            cp = r["m_pay"] / r["pay_off"] * 100 if r["pay_off"] else 0
            ca = r["m_ar"] / r["ar_off"] * 100 if r["ar_off"] else 0
            ready = ("หักกลบได้ทั้งจังหวัด" if r["n_pay"] == r["n"] and r["n_ar"] == r["n"]
                     else "หักกลบได้บางส่วน" if r["nb"] else
                     ("มีข้อมูลข้างเดียว" if r["npair"] else "ยังไม่มีข้อมูลรายคู่"))
            f.write(f"{r['prov']},{r['n']},{r['n_pay']},{r['n_ar']},"
                    f"{round(r['pay_off'])},{round(r['m_pay'])},{cp:.1f},"
                    f"{round(r['ar_off'])},{round(r['m_ar'])},{ca:.1f},"
                    f"{r['npair']},{r['nb']},{r['n1']},{r['ok']},{round(r['flow'])},{ready}\n")
    L.append("══ เทียบรายจังหวัด (เฉพาะบัญชี 'ในจังหวัด' — ที่หักกลบกันเองได้) ══")
    L.append(f"{'จังหวัด':12}{'รพ.':>5}{'แตกจน.':>8}{'แตกลห.':>8}"
             f"{'เจ้าหนี้ทางการ':>16}{'ระบุคู่ได้':>14}{'%':>7}"
             f"{'ลูกหนี้ทางการ':>16}{'ระบุคู่ได้':>14}{'%':>7}"
             f"{'คู่':>5}{'2ทาง':>6}{'เป๊ะ':>6}{'ไหลในจว.':>14}  ความพร้อม")
    for r in rows_pv:
        cp = r["m_pay"] / r["pay_off"] * 100 if r["pay_off"] else 0
        ca = r["m_ar"] / r["ar_off"] * 100 if r["ar_off"] else 0
        ready = ("✅ ครบทั้งจังหวัด" if r["n_pay"] == r["n"] and r["n_ar"] == r["n"]
                 else "🟡 บางส่วน" if r["nb"] else ("🟠 ข้างเดียว" if r["npair"] else "⛔ ไม่มีข้อมูล"))
        L.append(f"{r['prov']:12}{r['n']:>5}{r['n_pay']:>8}{r['n_ar']:>8}"
                 f"{r['pay_off']:>16,.0f}{r['m_pay']:>14,.0f}{cp:>6.1f}%"
                 f"{r['ar_off']:>16,.0f}{r['m_ar']:>14,.0f}{ca:>6.1f}%"
                 f"{r['npair']:>5}{r['nb']:>6}{r['ok']:>6}{r['flow']:>14,.0f}  {ready}")
    L.append("")
    L.append("── หักกลบภายในจังหวัด รายแห่ง (บวก = ควรได้รับสุทธิ · ลบ = ควรจ่ายสุทธิ) ──")
    L.append("   ⚠️ ยึด 'ยอดที่มากกว่า' ของสองฝั่งเมื่อบันทึกไม่ตรงกัน · จังหวัดที่ยังไม่ครบทุกแห่ง")
    L.append("      ตัวเลขนี้เป็นแค่ส่วนที่มองเห็น ไม่ใช่ภาระจริงทั้งหมด")
    for r in rows_pv:
        if not r["net"]: continue
        tag = "ครบทั้งจังหวัด" if r["n_pay"] == r["n"] and r["n_ar"] == r["n"] else \
              f"เห็นแค่ {max(r['n_pay'], r['n_ar'])}/{r['n']} แห่ง"
        L.append(f"\n  ▸ {r['prov']} ({tag}) — ไหลกันในจังหวัด {r['flow']:,.0f} บาท จาก {r['npair']} คู่")
        for hc, v in sorted(r["net"].items(), key=lambda x: -x[1]):
            L.append(f"      {nm_of(hc):>24} {v:>+16,.0f}")
        L.append(f"      {'ผลรวมต้องเป็น 0':>24} {sum(r['net'].values()):>16,.2f}")
    L.append("")
    L.append("── คู่ที่จับได้ทั้งสองทาง (เรียงตามยอดผู้จ่าย) ──")
    L.append(f"{'ผู้จ่าย(ลูกหนี้ค้างจ่าย)':28} {'ผู้รับ(เจ้าหนี้)':24} {'ผู้จ่ายบันทึก':>16} {'ผู้รับบันทึก':>16} {'ต่าง':>14}")
    for (a, b), v in sorted(both.items(), key=lambda x: -x[1]['pay']['amt']):
        p, r = v['pay']['amt'], v['ar']['amt']
        L.append(f"{nm_of(a)[:26]:28} {nm_of(b)[:22]:24} {p:>16,.2f} {r:>16,.2f} {p-r:>+14,.2f}")
    L.append("")
    L.append("── ชื่อที่ไม่ใช่คู่สัญญา: แตกบัญชีตาม**ประเภทบริการ**แทน (คนละปัญหากับจับคู่ไม่ได้) ──")
    for u in sorted([x for x in unmatched if x["how"]=="ไม่ใช่ชื่อ รพ."], key=lambda x:-x["amt"]):
        L.append(f"  {nm_of(u['org']):22} {u['acc']:22} {u['amt']:>14,.2f}  {u['cp']!r}")
    L.append("")
    L.append("── ชื่อคู่สัญญาที่จับคู่ไม่ได้ ──")
    uc = collections.Counter((u["cp"], u["how"]) for u in unmatched)
    for (cp, how), n in uc.most_common():
        amt = sum(u["amt"] for u in unmatched if u["cp"] == cp and u["how"] == how)
        L.append(f"  {n:3} รายการ · {amt:>14,.2f} · [{how}] {cp!r}")
    txt = "\n".join(L)
    io.open(os.path.join(OUT_DIR, "opuc_report.txt"), "w", encoding="utf-8").write(txt)
    print(txt)

if __name__ == "__main__":
    main()
