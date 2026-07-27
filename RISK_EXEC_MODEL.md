# คู่มือวิเคราะห์โมเดล Risk Score + แท็บผู้บริหาร (#exec)

เอกสารนี้เป็น **คู่มือทำงาน** สำหรับ `docs/risk_drill.html#exec` และ `pipeline/export_exec.py`
เขียนไว้ให้ session ถัดไป (คนหรือ AI) ตรวจสอบ/ต่อยอดได้โดยไม่ต้องไล่โค้ดใหม่ทั้งหมด
บันทึกครั้งแรก 27 ก.ค. 2569 หลังไล่ตรวจสมการทั้งชุดและแก้บั๊ก 1 ตัว

> ⚠️ ไฟล์นี้อยู่ที่ **root ของ repo** ไม่ใช่ใน `docs/` — เพราะ `docs/` คือตัวเว็บที่ GitHub Pages
> เผยแพร่จริง ห้ามวางไฟล์บันทึกไว้ที่นั่น (ดู `D:\Github\CLAUDE.md`)

---

## 1. สูตร Risk Score — 7 คะแนนเต็ม

โค้ดต้นทาง: `scoreOf(ca, cl, qn, cn, ni, mo)` ใน `docs/risk_drill.html`

| กลุ่ม | เกณฑ์ | ผ่านเมื่อ | คะแนนถ้าไม่ผ่าน |
|---|---|---|---|
| LI | CR = สินทรัพย์หมุนเวียน (1001X) ÷ หนี้สินหมุนเวียน (1001Y) | ≥ 1.50 | 1 |
| LI | QR = สินทรัพย์เร็ว (1002X) ÷ หนี้สินหมุนเวียน | ≥ 1.00 | 1 |
| LI | Cash ratio = เงินสด+เทียบเท่า (1003X) ÷ หนี้สินหมุนเวียน | ≥ 0.80 | 1 |
| ST | NWC = สินทรัพย์หมุนเวียน − หนี้สินหมุนเวียน | ≥ 0 | 1 |
| ST | NI = รายได้รวม (3006Y) − ค่าใช้จ่ายรวม (3010X) สะสมปีงบ | ≥ 0 | 1 |
| SU | 4-quadrant จาก NWC เทียบ NI | — | 0–2 |

**SU 4-quadrant** (ตัวเดียวที่ให้ได้ถึง 2 คะแนน — เป็นเหตุให้เต็ม 7 ไม่ใช่ 6):

```
NWC ≥ 0 และ NI ≥ 0                    → SU = 0  (ปลอดภัย)
NWC < 0 และ NI < 0                    → SU = 2  (แย่สุด)
NWC ≥ 0 แต่ NI < 0  → s = NWC ÷ (|NI|/mo)  → s<3 : 2 · s<6 : 1 · s≥6 : 0
NWC < 0 แต่ NI ≥ 0  → r = (−NWC) ÷ (NI/mo) → r<3 : 0 · r<6 : 1 · r≥6 : 2
```

`mo` = จำนวนเดือนงบที่ผ่านมา (`time_id % 100`, ต.ค. = 1 … ก.ย. = 12)

**การ anchor**: จุดตั้งต้นเดือน 0 ยึด Risk Score **ทางการ** (`h.risk` จาก `risk_scores`) ไม่ใช่ค่าที่
คำนวณจาก GL — โค้ดคิด `base = scoreOf(GL)` แล้วใช้ `anc(v) = clamp(h.risk + (v − base), 0, 7)`
กันกรณี boundary (เช่น QR ≈ 1.00) ที่ค่ารายงานกับ GL ต่างกันเล็กน้อยจนคะแนนต่างกัน 1
**อย่าเอา `inj` ไปบวกใน `base`** — จะทำให้ anchor เพี้ยน (เคยพลาดตอนประมาณผลกระทบ ได้ 41.75 ลบ.
ทั้งที่คำตอบจริงคือ 20.95 ลบ.)

---

## 2. สมการ NI จำลอง — จุดที่พลาดง่ายที่สุด

```
NI จำลอง/เดือน (exNiMo)
  = รายรับกองทุน (exRevMo)          Σ ราย P-code × op/ip/pp/oth × (1 + %ปรับ)
  − MOE (exMoeMo)                   59 บัญชีนิยามกองเศรษฐกิจสุขภาพ × (1 + %ปรับ)
  − ค่าใช้จ่ายนอกนิยาม (exXmoeMo)    (คชจ.รวม − MOE − non-cash) ÷ mo
  − non-cash (bs.depMo)             ค่าเสื่อม/ตัดจำหน่าย + หนี้สูญ

กระแสเงินสด/เดือน = NI จำลอง + non-cash        (บวกกลับรายการที่ไม่ใช่เงินสด)
```

### กติกาเหล็ก: non-cash ต้องเป็น "ชุดเดียวกัน" ทั้งสองที่

`EX_NONCASH` (JS) ต้องตรงกับ `NONCASH_P` (`export_exec.py`) **เป๊ะ** — ปัจจุบันคือ `P24 + P241`

เหตุผลเชิงพีชคณิต: แทน `exXmoeMo` ลงในสมการจะได้

```
NI = รายรับ − คชจ.รวม/mo + (non-cash ที่ xmoe หักออก)/mo − (non-cash ที่หักจาก NI)
```

จะเท่ากับนิยาม NI ทางการ (`3006Y − 3010X`) **เมื่อสองชุดเท่ากันเท่านั้น** ถ้าต่างกัน = หักซ้ำ/หักขาด

### ⛔ ห้ามใช้ `(exp − e33y)` เป็น non-cash (บั๊กที่แก้แล้ว 27 ก.ค. 69, commit `33ecad1`)

`e33y` = RatioItemID **3330Y** "ค่าใช้จ่ายไม่รวมค่าเสื่อม" ตามผังทางการ — แต่ผลต่าง `3010X − 3330Y`
**ไม่ใช่ค่าเสื่อมล้วน** ตรวจ `ratio_items` แล้วพบว่าผลต่าง 59 บัญชี มีของแปลกปนอยู่:

| กลุ่มบัญชีในผลต่าง | ยอดทั้งเขต สะสม 9 ด. (256909) | สัดส่วน |
|---|---|---|
| **ค่าใช้จ่ายระหว่างหน่วยงาน 5209*/5210*** (→ P251/P25) | **13,014.5 ลบ.** | **87%** |
| ค่าเสื่อม/ตัดจำหน่าย 5105* (→ P24) | 1,934.6 ลบ. | 13% |
| งบลงทุน UC 5104030299.204 (→ P24) | 5.0 ลบ. | — |

บัญชี 5209/5210 map เป็น P251/P25 ซึ่ง `exXmoeMo` นับเป็น **ค่าใช้จ่ายเงินสด** อยู่แล้ว → หักสองรอบ

พิสูจน์ที่ลำปาง: `depMo×mo 1,780 ลบ. − (P24+P241) 198.8 ลบ. = 1,581 ลบ.` ≈ `P251 1,583 ลบ.` พอดี

อาการที่เห็น: รพศ.เชียงรายประชานุเคราะห์ แสดง NI **−486.65 ลบ./เดือน** ทั้งที่ GL กำไร
**+59.69 ลบ./เดือน** และดันระดับวิกฤต ณ ก.ย. สูงเกินไป **1 ระดับใน 7 แห่ง**
(เชียงรายฯ/นครพิงค์/แพร่/พะเยา/เชียงคำ 1→0 · จอมทอง/ฝาง 2→1)

หมายเหตุ: `EADJ` ที่เคยอยู่ใน `EX_NONCASH` **ไม่มีอยู่จริงในข้อมูล** (ยอด 0 ทุกแห่ง) ถอดออกแล้ว

> ผลข้างเคียงที่ต้องรู้: การแก้นี้ **ไม่กระทบกระแสเงินสดเลย** เพราะสูตรลบ `depMo` ออกจาก NI
> แล้วบวกกลับตอนคิดเงินสด — หักล้างกันพอดี จึงกระทบแค่ NI/SU และคะแนนที่ตามมา

---

## 3. เงินสนับสนุน (`inj`) — รับรู้เป็นรายได้

ตัดสินใจโดย CFO 27 ก.ค. 2569 (commit `2b5d3e4`):

```js
let st={cca:bs.ca+inj, ccl:bs.cl, cqn:bs.qn+inj, ccn:bs.cn+inj, ni:bs.ni+inj, mo:bs.mo};
```

เงินที่หน่วยงานภาครัฐโอนให้ = **"รายได้เงินอุดหนุนจากหน่วยงานภาครัฐ"** ตามผัง MOPH จึงเข้า NI
— หลักเดียวกับ Option ยกหนี้ที่รับรู้เป็นรายได้ (4301020105.256) อยู่ก่อนแล้ว
เดิมสองมาตรการนี้ปฏิบัติต่างกัน ซึ่งไม่สอดคล้อง

`inj` ติดลบ (โหมดเพดาน) = ใช้เงินเกินแผน → เป็นค่าใช้จ่าย NI ลด — ถูกหลักทั้งสองทิศทาง

**ผลต่อตัวเลขแผนจัดสรร**: เงินสนับสนุนรวมเป้าระดับ 6 ลดจาก **51.70 → 20.95 ลบ.** (6 แห่ง)
และเคส "เงินก้อนอย่างเดียวไม่พอ" หายไปหมด (24 → 0 เคส) เพราะเงินก้อนช่วยเกณฑ์ NI ได้แล้ว

---

## 4. ปุ่มเลือกระดับในแผงเกณฑ์ 7 คะแนน — 3 โหมด

เทียบเป้า `L` กับ `sep0` = ระดับที่จะเป็น ณ ก.ย. **ถ้าไม่ช่วยอะไรเลย** (ไม่ใช่ระดับปัจจุบัน)
semantic เดียวกับ `solveTargetFor` ของ Simulator เดิม (`atlevel`/`ceiling`/`already`)

| เงื่อนไข | โหมด | แสดงอะไร |
|---|---|---|
| `L < sep0` | `plan` | เงินก้อนขั้นต่ำจาก `exSolveFor(h,L)` |
| `L = sep0` | `atlevel` | **ไม่ต้องเติมเงิน** + ตารางปัจจัยที่จะทำให้ตกระดับ |
| `L > sep0` | `ceiling` | เพดาน: ใช้เงินเกินแผนได้เท่าไหร่ก่อนตกถึง `L` (ค่าติดลบ) |

⚠️ กับดักเดิม: `exSolveFor` มีเงื่อนไข `cashOut == null` (เงินสดต้องไม่หมด) รวมอยู่ด้วย ทำให้
กด 7 ที่ระดับ 7 อยู่แล้วยังเรียกเงินก้อนมากันเงินสดติดลบ — แก้โดยแยกโหมดก่อนเรียก solver
(ยังคงเตือนเรื่องเงินสดติดลบไว้ในกล่อง `atlevel` เพราะเป็นข้อมูลที่ต้องรู้ แม้ระดับไม่เปลี่ยน)

---

## 5. ปัจจัยที่ทำให้ตกระดับ — 3 ช่องทางบัญชี ให้ผลไม่เท่ากัน

`exSolveDown(h, L, ch)` · `exSimPath(h, inj, sc)` รับ `sc = {ap}` / `{ar}`

| ช่องทาง | ความหมาย | ผลต่องบดุล |
|---|---|---|
| `cash` (ค่าเริ่มต้น) | ใช้จ่ายเกินเป้า / รายได้เงินสดไม่เข้า | CA, QN, **เงินสด** ลด · NI ลด |
| `ap` | ค่าใช้จ่ายเพิ่มแบบ**ก่อหนี้ค้างจ่าย** | **หนี้สินหมุนเวียน (ตัวส่วน) เพิ่ม** · NI ลด · เงินสดคงเดิม |
| `ar` | รายได้หายแบบ**ตัดลูกหนี้ที่เก็บไม่ได้** | CA, QN ลด · NI ลด · **เงินสดคงเดิม** |

ตัวอย่างจริง รพศ.ลำปาง (ระดับ ณ ก.ย. = 1) จะตกเป็นระดับ 2 ต้องเกิด:
**① 197.1 ลบ. · ② 246.4 ลบ. · ③ 595.0 ลบ.** — ต่างกันมีนัยสำคัญ

หลักที่อธิบายความต่าง:
- `ap` ทำให้**ตัวส่วน**โต → ทุก ratio แย่พร้อมกัน บางเคสตกเร็วกว่า
- `ar` ไม่แตะเงินสด → Cash ratio ไม่แย่ลง จึงต้องใช้มากกว่า และบางเคส**ไม่ตกถึงระดับ 7 เลย**
- เมื่อเกณฑ์ที่พลิกอยู่ในกลุ่ม NWC/NI/SU ทั้ง 3 ช่องทางจะให้ตัวเลข**เท่ากัน** (ลดเท่ากันหมด)
  เช่น แม่อาย ระดับ 5 → ตกเป็น 6 ที่ 550K เท่ากันทั้งสาม

"เกิดหลายปัจจัยพร้อมกัน" ในช่องทางเดียวกัน **บวกกันได้ตรงๆ** (จ่ายเกิน 350K + รายได้ขาด 200K
= 550K ให้ผลเท่ากับจ่ายเกิน 550K ทีเดียว)

---

## 6. Identity ที่ต้องผ่านเสมอ — ใช้เป็นชุดตรวจถดถอย

รันชุดนี้ทุกครั้งที่แก้สมการ ถ้าข้อใดพลาด = มีบั๊ก

| # | Identity | ค่าที่ยอมรับ |
|---|---|---|
| 1 | `Σrev − Σexp == bs.ni` ทุกแห่ง | ต่าง ≤ 5 บาท (pipeline พิมพ์ `✅ Σrev−Σexp = NI ตรงทุกแห่ง`) |
| 2 | `exNiMo(h) == bs.ni / bs.mo` | ต่าง ≈ 0 (คลาดสูงสุดเคยเป็น 546 ลบ. ตอนมีบั๊ก) |
| 3 | `MOE + xmoe + non-cash == คชจ.รวม/เดือน` | ต่าง ≤ 1 บาท (พิสูจน์ว่า MOE ไม่ถูกนับซ้ำ) |
| 4 | `ΔCR == ΔQR == ΔCash == inj ÷ cl` เมื่อเติมเงิน | ต่าง ≤ 1e-9 (floating point) |
| 5 | `ΔNWC == inj` และ `ΔNI == inj` | ต่าง ≤ 1 บาท |
| 6 | `exSolveFor(h,L)` แล้ว `sepRisk ≤ L` | ต้องจริงทุกแห่งที่ solver คืนค่า |
| 7 | เป้าเข้มขึ้น → เงินก้อนไม่ลดลง (monotonic) | ต้องจริง |
| 8 | ratio ทุกตัวหลังเติมเงินไม่แย่ลงกว่าก่อนเติม | ต้องจริง |

### 🪤 กับดักการปัดเศษ (เคยถูกเข้าใจว่าเป็นบั๊ก)

ข้อ 4 เป็นจริงเป๊ะ แต่**หน้าเว็บปัด 2 ตำแหน่งจึงอ่านได้ต่างกัน 0.01** เช่นแม่วาง:

```
CR   0.5563 → 1.0009   แสดง 0.56 → 1.00   อ่านได้ +0.44
Cash 0.1821 → 0.6266   แสดง 0.18 → 0.63   อ่านได้ +0.45  ← ดูเหมือนไม่สอดคล้อง
Δ จริงทั้งสาม = 0.4445 = 20.85M ÷ 46.90M
```

แก้ที่การนำเสนอ: แสดง Δ ที่คำนวณจากค่าจริงก่อนปัด (`cellD` ใน `exBrkHtml`) **ไม่ใช่แก้สูตร**

---

## 7. วิธีทดสอบ — headless ไม่ต้องเปิดเบราว์เซอร์

โค้ดคำนวณทั้งหมดอยู่ใน inline `<script>` ของ `risk_drill.html` ดึงออกมารันใน node ได้ตรงๆ
คุ้มมาก: รัน 103 รพ. × เป้า 0–7 = 824 เคส ใน ~3 วินาที (3.4 ms/เคส)

```js
const fs=require('fs');
const code=[...fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/risk_drill.html','utf8')
  .matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));

// stub DOM ขั้นต่ำ — ต้องมี getAttribute/getComputedStyle ไม่งั้น theme helper จะ throw
const el={innerHTML:'',textContent:'',scrollTop:0,classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}};
global.document={getElementById:()=>el,querySelectorAll:()=>[],addEventListener(){},
  documentElement:el,createElement:()=>el,body:el};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);

// export ฟังก์ชันที่ต้องใช้ + setter ของ global state
const A=new Function(code+`;return {exSimPath,exSolveFor,exSolveDown,exBrkHtml,exNiMo,scoreOf,EX_CRIT,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXTJ:v=>{EXTJ=v},setEXBRK:v=>{EXBRK=v}};`)();

A.setEX(JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8')));
A.setEXST({crisis:'67',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{}});
A.setEXTJ({debtors:new Set(),shares:{},refund:{},total:0,uncovered:0});
```

**ตรวจ syntax ของทุก inline script** (ทำก่อน commit ทุกครั้ง):

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('docs/risk_drill.html','utf8');let ok=true,i=0;
for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){i++;if(m[1].includes('src='))continue;
  try{new Function(m[1])}catch(e){ok=false;console.log('ERR',i,e.message)}}
console.log(ok?'JS SYNTAX OK':'BROKEN');"
```

**วัดผลกระทบก่อน/หลังแก้ pipeline** — สำรอง `exec.json` เดิมไว้ก่อนรัน แล้วโหลดสองไฟล์เทียบกัน
ด้วย instance คนละตัว (อย่าลืมว่า `EX` เป็น global ต่อ instance)

**ตรวจผังบัญชีใน MySQL** (`rh1_health`) — จับบั๊ก non-cash ได้ด้วยวิธีนี้:

```python
# ผลต่างของ RatioItemID สองตัว ควรเป็นบัญชีอะไร
cur.execute("SELECT CodeL1 FROM ratio_items WHERE UseYN='Yes' AND RatioItemID=%s", ('3010X',))
# แล้วเทียบยอดจริงจาก master.parquet: m[m.acc.isin(diff)].groupby('org5')['bs'].sum()
# จัดกลุ่มตาม prefix 4 หลัก (5105 = ค่าเสื่อม, 5209/5210 = ระหว่างหน่วยงาน) จะเห็นของแปลกทันที
```

หมายเหตุ Windows: ตั้ง `sys.stdout.reconfigure(encoding="utf-8")` ทุกสคริปต์ Python
ไม่งั้น `·` และภาษาไทยจะ throw `UnicodeEncodeError` (console เป็น cp874)

---

## 8. ขั้นตอน deploy

1. แก้โค้ด → ตรวจ syntax (JS + `python -c "import ast; ast.parse(...)"`)
2. รันชุด identity ข้อ 6 ให้ผ่านครบ
3. ถ้าแก้ pipeline: สำรอง `exec.json` → `python pipeline/export_exec.py` → เทียบก่อน/หลัง
4. `git add` **เฉพาะไฟล์ที่แก้** (repo มีไฟล์ค้าง uncommitted อื่นอยู่ อย่า `git add -A`)
5. commit + push
6. **ยืนยันบน URL จริงเสมอ** — อย่าหยุดที่ local:

```bash
for i in $(seq 1 30); do
  curl -s "https://pitaknan.github.io/Rh1-BalanceSheet/risk_drill.html?nc=$i$(date +%s%N)" -o /tmp/live.html
  if grep -q "<ข้อความใหม่ที่เพิ่ม>" /tmp/live.html; then echo DEPLOYED; break; fi
  sleep 10
done
# แล้วเทียบ byte-identical กับ local + ตรวจ syntax ของไฟล์ที่ deploy จริง
```

GitHub Pages ใช้เวลา build ~50–80 วินาที · remote แจ้ง "repository moved" ไปที่
`github.com/PitakNan/...` (ตัว P ใหญ่) แต่ push ผ่าน remote เดิมยังสำเร็จ ไม่ต้องแก้

---

## 9. ค้างคา / ยังไม่ได้ตรวจ

- **`e33y` (3330Y) ยังใช้ใน NI Bridge** ของหน้า drill รายแห่ง (`export_risk_link.py` บรรทัด ~471)
  คำนวณ "NI ไม่มีค่าเสื่อม" (3006X = rev − e33y) และ EBITDA (333 = e33x − e33y)
  ตามผังทางการถูกต้อง แต่เพราะ 3330Y ไม่รวม 5209/5210 ตัวเลข EBITDA จึงอาจสูงกว่าที่ควรเป็น
  — **ยังไม่ได้ตรวจความสมเหตุสมผล**
- **mapping GL→P-code และ OP/IP** ใน `export_planfin.py`/`export_exec.py` ยังร่างเอง
  ไม่ได้ validate กับผัง MOPH ทางการ (มี checklist รอ CFO review ในไฟล์)
- ตาราง MOE 59 บัญชีตรวจกับผังชื่อบัญชีแล้ว 59/59 แต่ **สัดส่วน MOE 30.5% ของค่าใช้จ่ายรวม**
  ยังไม่ได้ cross-check กับตัวเลขที่กองเศรษฐกิจสุขภาพเผยแพร่
