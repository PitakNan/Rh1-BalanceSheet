// regression เต็ม: ratio ไม่ติดลบ · identity ครบ · เงินสนับสนุน/ระดับ · 824 เคส
const fs=require('fs');
const code=[...fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/risk_drill.html','utf8')
  .matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const el={innerHTML:'',textContent:'',scrollTop:0,classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}};
global.document={getElementById:()=>el,querySelectorAll:()=>[],addEventListener(){},documentElement:el,createElement:()=>el,body:el};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exSimPath,exSolveFor,exSolveDown,exBrkHtml,exNiMo,exMoeMo,scoreOf,EX_CRIT,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXTJ:v=>{EXTJ=v},setEXBRK:v=>{EXBRK=v}};`)();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=()=>({crisis:'67',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{}});
A.setEX(j); A.setEXST(ST());
A.setEXTJ({debtors:new Set(),shares:{},refund:{},total:0,uncovered:0});
const M=v=>v==null?'—':(v/1e6).toFixed(2)+'M';
let fail=[];

console.log('════ 1) ratio ต้องไม่ติดลบในทุกสถานการณ์ ════');
let neg=0, chk=0;
for(const h of j.hosp){
  const s=A.exSimPath(h,0).sepRisk;
  // baseline + เงินสนับสนุนทุกเป้า + เพดานทุกระดับ + ทุกช่องทาง
  const cases=[A.exSimPath(h,0)];
  for(let L=0;L<=7;L++){ const v=A.exSolveFor(h,L); if(v!=null) cases.push(A.exSimPath(h,v)); }
  if(s!=null&&s<7) for(let L=s+1;L<=7;L++){
    for(const ch of [undefined,'ap','ar']){
      const d=A.exSolveDown(h,L,ch); if(d==null) continue;
      cases.push(ch==='ap'?A.exSimPath(h,0,{ap:d}):ch==='ar'?A.exSimPath(h,0,{ar:d}):A.exSimPath(h,-d));
    }
  }
  for(const r of cases){ const b=r.sepBreak; if(!b) continue; chk++;
    if(b.cr<0||b.qr<0||b.cash<0){ neg++; if(neg<=5) fail.push(`ติดลบ ${h.name}: CR ${b.cr.toFixed(3)} QR ${b.qr.toFixed(3)} Cash ${b.cash.toFixed(3)}`); }
    if(b.qr>b.cr+1e-9){ fail.push(`QR>CR ${h.name}: QR ${b.qr.toFixed(3)} > CR ${b.cr.toFixed(3)}`); }
    if(r.cnEnd<0) fail.push(`เงินสดปลายงวดติดลบ ${h.name}: ${M(r.cnEnd)}`);
  }
}
console.log(`  ตรวจ ${chk} สถานการณ์ · ติดลบ ${neg}`, neg===0?'✅':'⚠️');

console.log('\n════ 2) identity ที่ต้องผ่านเสมอ ════');
let d2=0,d4=0,d5=0,ok6=true,mono=true; const d4cl=[];
for(const h of j.hosp){
  d2=Math.max(d2,Math.abs(A.exNiMo(h)-h.bs.ni/h.bs.mo));
  const v=A.exSolveFor(h,6); if(v==null||v<=0) continue;
  const b0=A.exSimPath(h,0).sepBreak,b1=A.exSimPath(h,v).sepBreak; if(!b0||!b1) continue;
  // ⚠️ ตัวหารต้องเป็น CL ณ เดือนที่วัดคะแนน (ก.ย.) ไม่ใช่ CL ตั้งต้นของงวด — ดูคำอธิบายที่ผลลัพธ์
  const r0=A.exSimPath(h,0), r1=A.exSimPath(h,v), clS=r1.clEnd;
  if(Math.abs(r0.clEnd-r1.clEnd)>1) d4cl.push(h.name);   // เส้นทาง CL ต้องเหมือนกันสองรอบ (เงินอุดหนุนไม่แตะ CL)
  d4=Math.max(d4,Math.abs((b1.cr-b0.cr)-v/clS),Math.abs((b1.qr-b0.qr)-v/clS),Math.abs((b1.cash-b0.cash)-v/clS));
  d5=Math.max(d5,Math.abs((b1.nwc-b0.nwc)-v),Math.abs((b1.ni-b0.ni)-v));
  const s=A.exSimPath(h,v).sepRisk; if(s!=null&&s>6) ok6=false;
  let prev=null; for(const L of [7,6,5,4,3,2,1,0]){const n=A.exSolveFor(h,L);
    if(n!=null&&prev!=null&&n<prev-1) mono=false; if(n!=null) prev=n;}
}
console.log('  ข้อ 2 |NI จำลอง − GL run-rate| =',M(d2), d2<1e5?'✅':'⚠️');
// 🐞 ข้อ 4 เคยขึ้น ⚠️ ค้างมานาน (256909 = 7.71e-3 · 256910 = 5.16e-2) แล้วถูกมองข้ามว่า
//    "เป็นธรรมชาติของโมเดล" — ตรวจจริง 11 ส.ค. 69 พบว่า **ตัวเทสต์เองผิด ไม่ใช่โมเดล**
//    ใช้ h.bs.cl (หนี้สินหมุนเวียน ณ งวดตั้งต้น) เป็นตัวหาร ทั้งที่คะแนนวัดที่ ก.ย.
//    ซึ่ง CL เดินไปแล้วตาม clMo/clYE (ตั้งแต่ 6 ส.ค. โมเดลเลิกตรึง CL) → ตัวหารคนละจุดเวลา
//    เปลี่ยนเป็น r1.clEnd แล้วได้ 3.19e-16 = เป๊ะระดับ floating point ทั้ง 15 แห่ง
//    ⛔ ห้ามกลับไปใช้ bs.cl · และห้ามปล่อยข้อไหนขึ้น ⚠️ ค้างโดยไม่หาสาเหตุอีก (เป็น fail จริงแล้ว)
console.log('  ข้อ 4 |Δratio − inj/clEnd| =',d4.toExponential(2), d4<1e-9?'✅':'❌');
if(d4>=1e-9) fail.push('ข้อ 4 เอกลักษณ์ Δratio = inj/clEnd ไม่ผ่าน: '+d4.toExponential(2));
if(d4cl.length) fail.push('เส้นทาง CL ต่างกันระหว่างรอบมี/ไม่มีเงินอุดหนุน '+d4cl.length+' แห่ง: '+d4cl.slice(0,3).join(' '));
console.log('  ข้อ 5 |ΔNWC−inj| , |ΔNI−inj| =',M(d5), d5<1?'✅':'⚠️');
console.log('  ข้อ 6 solver ได้ระดับ ≤ เป้า:',ok6?'✅':'⚠️');
console.log('  ข้อ 7 monotonic:',mono?'✅':'⚠️');

console.log('\n════ 3) ตัวเลขที่ใช้ตัดสินใจ ════');
let sum=0,n=0,rows=[];
for(const h of j.hosp){const v=A.exSolveFor(h,6); if(v!=null){sum+=v; if(v>0){n++;rows.push([h.name,v]);}}}
// ⚠️ ค่าฐานใหม่ 6 ส.ค. 69 — หลังใส่ปัจจัยฤดูกาลปลายปีงบ + หนี้สินเดินตามจริง (RISK_EXEC_MODEL.md 7.10)
//    ของเดิม 21.05M/6 แห่ง มาจากโมเดลที่ตรึง CL + ลาก NI ต้นปี ซึ่ง backtest พบว่าทำนายผิดทิศ
//    เปลี่ยนจาก console เตือนเฉย ๆ เป็น chk จริง — ไม่งั้นตัวเลขเลื่อนต่อโดยไม่มีใครจับได้
// ⚠️ ค่าฐานงวด 256910 (ก.ค. 69) = 79.90M/15 แห่ง — ของเดิม 57.25M/11 เป็นงวด 256909
//    ตัวเลขขยับด้วย 4 เหตุพร้อมกัน อย่าเข้าใจผิดว่ามาจากข้อมูลเดือนใหม่อย่างเดียว:
//    ① ข้อมูลเดินไป ก.ค. (ขาดทุนเดือนเดียว 299.8 ลบ.) · ② เหลือพยากรณ์ 2 เดือนแทน 3
//    ③ คืน bs.niYE/clYE ที่หายไปตอนเดินงวด + ตัวคูณกันนับซ้ำ exYeAdj (0.9 ที่ ด.10) → 80.00M
//    ④ ซ่อมข้อมูล ก.ย. ปีก่อน (import_month_mdb.py กัน Dr/Cr=NULL + fix_sep_months.py)
//       → cl ของ ด.12 ปี 67/68 ขยับ 18 แห่ง → clYE เปลี่ยนตาม → 80.00M → 79.90M
{ const ok=Math.abs(sum-79.90e6)<1e5&&n===15;
  console.log('  เงินสนับสนุนรวม (เป้า 6):',M(sum),'·',n,'แห่ง  (ต้องเท่า 79.90M/15 แห่ง)',ok?'✅':'❌');
  if(!ok) fail.push(`เงินสนับสนุนรวมเปลี่ยน: ได้ ${M(sum)}/${n} แห่ง ควรเป็น 79.90M/15 แห่ง`); }
rows.sort((a,b)=>b[1]-a[1]).forEach(r=>console.log('   ',r[0].padEnd(18),M(r[1])));
const hist={}; j.hosp.forEach(h=>{const s=A.exSimPath(h,0).sepRisk; if(s!=null)hist[s]=(hist[s]||0)+1;});
console.log('  ระดับ ณ ก.ย. baseline:',[0,1,2,3,4,5,6,7].filter(l=>hist[l]).map(l=>l+'×'+hist[l]).join(' '));
{ const want='0×26 1×20 2×11 3×14 4×5 5×3 6×9 7×15';   // งวด 256910 (เดิมงวด 256909: 0×36 1×17 2×14 3×13 4×5 5×3 6×4 7×11)
  const got=[0,1,2,3,4,5,6,7].filter(l=>hist[l]).map(l=>l+'×'+hist[l]).join(' ');
  console.log('   (ต้องเท่า: '+want+')',got===want?'✅':'❌');
  if(got!==want) fail.push('การกระจายระดับ ณ ก.ย. เปลี่ยน: ได้ '+got+' ควรเป็น '+want); }
// ⚠️ ค่าคาดหวังเปลี่ยน 29 ก.ค. 69 จากงานค้างข้อ 10 (หักรายได้รับบริจาคสินทรัพย์ออกจากกระแสเงินสด)
//    เดิม 20.95M · 0×55 1×11 2×13 3×9 4×2 5×1 6×6 7×6 — 6 แห่งที่ระดับ ณ ก.ย. แย่ลง:
//    เชียงกลาง 0→3 · วังชิ้น 2→4 · เทิง 3→5 · เวียงสา 2→3 · แม่ออน 2→3 · เด่นชัย 0→1
//    (ดู RISK_EXEC_MODEL.md 3.10/3.12) ถ้าเลขนี้ขยับอีกโดยไม่ตั้งใจ = มีของพัง

console.log('\n════ 3.5) เงินสำรอง MOE — กันตามรอบจ่ายจริง แยกชนิดเจ้าหนี้ (3.13) ════');
// สูตร: (MOE กลุ่มที่ต้องชำระตามกำหนด = ธง cash ใน moeGroups) × 3 + คชจ.ค้างจ่าย (bs.apAccr)
// ⛔ ไม่รวมเจ้าหนี้การค้า (bs.apTrade) — ผู้ขายให้เครดิต + ถูกนับเป็นตัวส่วน CR/QR แล้ว
let resTot=0, stuck=[], dRes=0;
const cashG=j.moeGroups.filter(g=>g.cash).map(g=>g.id);
for(const h of j.hosp){
  const r=A.exSimPath(h,0);
  const want=cashG.reduce((s,g)=>s+(h.moe[g]||0)/h.bs.mo,0)*3+(h.bs.apAccr||0);
  dRes=Math.max(dRes,Math.abs(r.resNeed0-want));
  resTot+=r.resNeed0;
  if(h.bs.cn<r.resNeed0) stuck.push(h.name);
}
console.log('  ธง cash ใน moeGroups:',cashG.join(',')||'⚠️ ไม่มี — pipeline ไม่ได้ส่งธงมา');
console.log('  |resNeed0 − (ต้องชำระตามกำหนด×3 + ค้างจ่าย)| =',M(dRes), dRes<1?'✅':'⚠️ สูตรไม่ตรง');
// ⚠️ ค่าคาดหวังเปลี่ยน 6 ส.ค. 69 จาก 2 เรื่องพร้อมกัน (ดูคู่มือ 3.14):
//    ① ค่าเริ่มต้นเปลี่ยนเป็น MOE.Ver69 (59 บัญชี) → กลุ่ม labor เสีย 5101010113.103
//       ค่าจ้างชั่วคราว(บริการ) ซึ่งอยู่ในกลุ่มที่ต้องชำระตามกำหนด → เงินสำรองลด (1560.46M → 1443.07M)
//    ② เจ้าของงานยืนยันว่า "ค่าเช่าค้างไม่ได้" → กลุ่ม rent เข้าธง cash ด้วย → เงินสำรองเพิ่มเป็น 1613.60M
// ⚠️ ค่าคาดหวังอัปเดตเป็นงวด 256910 (11 ส.ค. 69) — งวด 256909 คือ 1613.60M / 4 แห่ง
//    สองบรรทัดนี้ขยับตามข้อมูลงวดใหม่ล้วน ๆ ไม่เกี่ยวกับการแก้ niYE/clYE (ตรวจแล้วก่อน-หลังเท่ากัน)
console.log('  เงินสำรองรวมทั้งเขต:',M(resTot),'(ต้องเท่า 1634.50M · เดิม MOE ทั้งก้อน×3 = 4224.05M)',
  Math.abs(resTot-1634.50e6)<1e5?'✅':'⚠️ เปลี่ยน');
console.log('  แห่งที่ใช้จ่ายอย่างอื่นได้ 0 บาท:',stuck.length,'(ต้องเป็น 7: ทุ่งหัวช้าง เทิง เวียงแก่น ขุนตาล เวียงเชียงรุ้ง สบเมย วัดจันทร์ฯ)',
  stuck.length===7?'✅':'⚠️ เปลี่ยน — '+stuck.join(' '));
if(!cashG.length) fail.push('moeGroups ไม่มีธง cash → เงินสำรองจะเป็น 0 ทุกแห่ง (รัน export_exec.py ใหม่)');
if(dRes>=1) fail.push('สูตรเงินสำรองไม่ตรงนิยาม 3.13 คลาด '+M(dRes));

console.log('\n════ 4) แผง 824 เคส + คอลัมน์ครบ ════');
let runs=0,threw=0,badcol=0; const t0=Date.now();
for(const h of j.hosp){
  const r0=A.exSimPath(h,0), n6=A.exSolveFor(h,6);
  const x={h,inj:n6||0,r0,r1:A.exSimPath(h,n6||0),need:n6};
  for(const L of [0,1,2,3,4,5,6,7]){ A.setEXBRK({[h.hcode]:L});
    try{ const o=A.exBrkHtml(x,'ก.ย.69'); runs++;
      const t1=o.split('risktbl')[0];
      const c1=[...t1.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>(m[1].match(/<t[hd]/g)||[]).length).filter(v=>v>0);
      if(c1.some(v=>v!==6)){ badcol++; if(badcol<=3) fail.push(`ตารางเกณฑ์คอลัมน์ไม่ครบ ${h.name} L=${L}: ${c1.join(',')}`); }
      const seg=o.split('risktbl')[1];
      if(seg){ const c2=[...('<t'+seg.split('</table>')[0]).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>(m[1].match(/<t[hd]/g)||[]).length).filter(v=>v>0);
        if(c2.some(v=>v!==6)){ badcol++; if(badcol<=3) fail.push(`ตารางปัจจัยคอลัมน์ไม่ครบ ${h.name} L=${L}: ${c2.join(',')}`); } }
    }catch(e){ threw++; fail.push(`THREW ${h.name} L=${L}: ${e.message}`); } }
}
console.log(`  รัน ${runs} เคส · exception ${threw} · คอลัมน์ผิด ${badcol} · ${Date.now()-t0}ms`);

// ══ 5) 🔒 ล็อกโครงสร้าง exec.json — กันบั๊กชนิด "ฟิลด์หายเงียบตอนเดินงวด" ทั้งตระกูล ══
// เคสจริง 11 ส.ค. 69: bs.niYE/bs.clYE ถูกใส่ด้วยมือในงวด 256909 ไม่ได้อยู่ในไพป์ไลน์
// พอ export งวดใหม่ก็หายไปเฉย ๆ โมเดลถอยกลับรุ่นเก่าโดยไม่มีอะไรฟ้อง
// ⛔ เพิ่มฟิลด์ใหม่ใน exec.json ต้อง (ก) เขียนใน export_exec.py เท่านั้น ห้ามแก้ไฟล์ JSON ด้วยมือ
//    (ข) เติมชื่อฟิลด์ลงรายการนี้ทุกครั้ง — รายการนี้คือสัญญาระหว่างไพป์ไลน์กับหน้าเว็บ
console.log('\n════ 5) โครงสร้าง exec.json ครบทุกแห่ง ════');
{ const NEED_TOP=['period','periodLabel','monthsElapsed','pn','revOrder','expOrder','moeGroups','moeVers','cashDef','hosp'];
  const NEED_H=['hcode','name','prov','grp','type','risk','src','bs','rev','exp','moe','moe68','moeP9','tj','trf'];
  const NEED_BS=['t','mo','ca','cl','qn','cn','ni','depMo','clMo','niYE','clYE','donMo','apAccr','apTrade'];
  const miss=k=>j.hosp.filter(h=>!(k in h)).length, missB=k=>j.hosp.filter(h=>!(k in h.bs)).length;
  const badTop=NEED_TOP.filter(k=>!(k in j)), badH=NEED_H.filter(k=>miss(k)), badB=NEED_BS.filter(k=>missB(k));
  console.log('  ระดับไฟล์',NEED_TOP.length-badTop.length+'/'+NEED_TOP.length,
              '· ราย รพ.',NEED_H.length-badH.length+'/'+NEED_H.length,
              '· ใน bs',NEED_BS.length-badB.length+'/'+NEED_BS.length,
              (badTop.length+badH.length+badB.length)?'❌':'✅');
  [...badTop.map(k=>'ระดับไฟล์ '+k),...badH.map(k=>`ราย รพ. ${k} (ขาด ${miss(k)} แห่ง)`),
   ...badB.map(k=>`bs.${k} (ขาด ${missB(k)} แห่ง)`)].forEach(m=>fail.push('exec.json ขาดฟิลด์ '+m+' — รัน export_exec.py ใหม่'));
  // ฟิลด์ที่ "มีบางแห่ง ขาดบางแห่ง" = สัญญาณของการแก้ไฟล์ด้วยมือ ตรวจแยกอีกชั้น
  const allB=new Set(); j.hosp.forEach(h=>Object.keys(h.bs).forEach(k=>allB.add(k)));
  const partial=[...allB].filter(k=>{const n=missB(k); return n>0&&n<j.hosp.length;});
  console.log('  ฟิลด์ที่มีไม่ครบทุกแห่ง:',partial.length?partial.join(' '):'ไม่มี', partial.length?'❌':'✅');
  partial.forEach(k=>fail.push(`bs.${k} มีบางแห่งไม่มีบางแห่ง = ร่องรอยการแก้ JSON ด้วยมือ`));
}

console.log('\n════ สรุป ════');
if(fail.length){ console.log('  ⚠️ พบปัญหา',fail.length,'รายการ:'); fail.slice(0,10).forEach(f=>console.log('   ',f)); }
else console.log('  ✅ ผ่านทุกข้อ');
