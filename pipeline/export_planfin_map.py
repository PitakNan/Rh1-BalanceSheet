# -*- coding: utf-8 -*-
"""
export_planfin_map.py — ดึง "ผัง GL → P-code ทางการ" ออกจากไฟล์ M*.mdb ของ HFO มาเก็บใน repo

ที่มา: ตาราง `AccCode` ใน M5317.mdb (ไฟล์เดียวกับที่ให้งบรูปแบบบริหารรายเดือน)
       คอลัมน์ CodeL1 = รหัสบัญชี · GroupID = P-code · Rate = ตัวคูณ · UseYN = ยังใช้อยู่หรือไม่
พบ 29 ก.ค. 69 — ก่อนหน้านี้เข้าใจว่าไม่มีผังทางการ ต้องร่างเอง (ดู RISK_EXEC_MODEL.md หัวข้อ 3.8)

⚠️ GroupID ในตารางมีทั้ง "กลุ่มปลายทาง" (P04…P251) และ "ยอดรวม" (P13S/P26S/P27S/P29S/P291/P292)
   กับ "กลุ่มงบดุล" (P40 NWC/P50 เงินบำรุงคงเหลือ/P60 หนี้สิน/P70 เงินบำรุงสุทธิ) — เราเก็บแค่กลุ่มปลายทาง
   เพราะ 1 รหัสอยู่ได้หลายยอดรวมพร้อมกัน (เงินสดอยู่ทั้ง P40+P50+P70) แต่มีกลุ่มปลายทางเดียว

รัน: python export_planfin_map.py [path ของ M5317.mdb หรือ .zip]
     ไม่ใส่ path → ใช้ไฟล์ล่าสุดที่ประกาศใน SRC_DEFAULT
output: pipeline/planfin_map_official.csv  (ใช้โดย export_planfin.planfin_code)
"""
import sys, os, csv
import win32com.client

sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "planfin_map_official.csv")
SRC_DEFAULT = (r"D:\OneDrive\Share Rh1-New\hfo\2569"
               r"\9. เรียกรายงานวันที่ 14 ก.ค. 69\M5317_25690714_2040.zip")

# GroupID ที่เป็นยอดรวม/กลุ่มงบดุล ไม่ใช่กลุ่มปลายทางของรหัสบัญชี
AGG = {"P13S", "P26S", "P27S", "P29S", "P291", "P292", "P40", "P50", "P60", "P70"}


def resolve_src(path):
    """รับได้ทั้ง .mdb ตรง ๆ และ .zip (แตกไฟล์ .mdb ข้างในไปที่ temp)"""
    if path.lower().endswith(".mdb"):
        return path, None
    import zipfile, tempfile
    tmp = tempfile.mkdtemp(prefix="planfinmap_")
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".mdb")]
        if not names:
            sys.exit(f"ไม่พบ .mdb ใน {path}")
        z.extract(names[0], tmp)
        return os.path.join(tmp, names[0]), tmp


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    if not os.path.exists(src):
        sys.exit(f"ไม่พบไฟล์: {src}")
    mdb, tmp = resolve_src(src)
    print(f"อ่าน: {os.path.basename(mdb)}")

    dao = win32com.client.Dispatch("DAO.DBEngine.120")
    db = dao.OpenDatabase(mdb, False, True)
    rs = db.OpenRecordset("SELECT CodeL1, Account1, GroupID, PlanName, Rate, UseYN "
                          "FROM AccCode WHERE GroupID IS NOT NULL ORDER BY CodeL1")
    rows, seen = [], {}
    while not rs.EOF:
        code = str(rs.Fields("CodeL1").Value or "").strip()
        gid = str(rs.Fields("GroupID").Value or "").strip()
        if code and gid and gid not in AGG:
            rate = rs.Fields("Rate").Value
            rows.append({
                "CodeL1": code, "PCode": gid,
                "PlanName": str(rs.Fields("PlanName").Value or "").strip(),
                "Account1": str(rs.Fields("Account1").Value or "").strip(),
                "Rate": float(rate) if rate is not None else 1.0,
                "UseYN": str(rs.Fields("UseYN").Value or "").strip(),
            })
            seen.setdefault(code, set()).add(gid)
        rs.MoveNext()
    rs.Close()
    db.Close()

    multi = {k: v for k, v in seen.items() if len(v) > 1}
    if multi:
        print(f"⚠️ รหัสที่อยู่หลายกลุ่มปลายทาง {len(multi)} รายการ (ต้องตรวจ): "
              f"{list(multi.items())[:5]}")

    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["CodeL1", "PCode", "PlanName", "Account1", "Rate", "UseYN"])
        w.writeheader()
        w.writerows(rows)
    use = sum(1 for r in rows if r["UseYN"] == "Yes")
    print(f"เขียน {OUT}\n  {len(rows)} แถว | UseYN=Yes {use} | รหัสไม่ซ้ำ {len(seen)}")

    # เทียบกับ Mapping_Clean.xlsx (แหล่งเดิมที่ฝ่ายบัญชียืนยัน) ให้เห็นจุดต่างทุกครั้งที่รัน
    try:
        sys.path.insert(0, HERE)
        from export_planfin import load_planfin_map
        mp = load_planfin_map()
        off = {r["CodeL1"]: r["PCode"] for r in rows if r["UseYN"] == "Yes"}
        both = set(mp) & set(off)
        diff = [(k, mp[k], off[k]) for k in sorted(both) if mp[k] != off[k]]
        print(f"\nเทียบ Mapping_Clean.xlsx: ร่วมกัน {len(both)} | ต่าง {len(diff)} | "
              f"เฉพาะ Mapping_Clean {len(set(mp)-set(off))} | เฉพาะผังทางการ {len(set(off)-set(mp))}")
        for k, a, b in diff:
            print(f"   {k:<20} Mapping_Clean={a:<6} ทางการ={b}  ← ใช้ค่าทางการ")
    except Exception as e:
        print("เทียบ Mapping_Clean ไม่ได้:", e)

    if tmp:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
