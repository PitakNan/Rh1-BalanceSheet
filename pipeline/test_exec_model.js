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
let d2=0,d4=0,d5=0,ok6=true,mono=true;
for(const h of j.hosp){
  d2=Math.max(d2,Math.abs(A.exNiMo(h)-h.bs.ni/h.bs.mo));
  const v=A.exSolveFor(h,6); if(v==null||v<=0) continue;
  const b0=A.exSimPath(h,0).sepBreak,b1=A.exSimPath(h,v).sepBreak; if(!b0||!b1) continue;
  d4=Math.max(d4,Math.abs((b1.cr-b0.cr)-v/h.bs.cl),Math.abs((b1.qr-b0.qr)-v/h.bs.cl),Math.abs((b1.cash-b0.cash)-v/h.bs.cl));
  d5=Math.max(d5,Math.abs((b1.nwc-b0.nwc)-v),Math.abs((b1.ni-b0.ni)-v));
  const s=A.exSimPath(h,v).sepRisk; if(s!=null&&s>6) ok6=false;
  let prev=null; for(const L of [7,6,5,4,3,2,1,0]){const n=A.exSolveFor(h,L);
    if(n!=null&&prev!=null&&n<prev-1) mono=false; if(n!=null) prev=n;}
}
console.log('  ข้อ 2 |NI จำลอง − GL run-rate| =',M(d2), d2<1e5?'✅':'⚠️');
console.log('  ข้อ 4 |Δratio − inj/cl| =',d4.toExponential(2), d4<1e-9?'✅':'⚠️');
console.log('  ข้อ 5 |ΔNWC−inj| , |ΔNI−inj| =',M(d5), d5<1?'✅':'⚠️');
console.log('  ข้อ 6 solver ได้ระดับ ≤ เป้า:',ok6?'✅':'⚠️');
console.log('  ข้อ 7 monotonic:',mono?'✅':'⚠️');

console.log('\n════ 3) ตัวเลขที่ใช้ตัดสินใจ ════');
let sum=0,n=0,rows=[];
for(const h of j.hosp){const v=A.exSolveFor(h,6); if(v!=null){sum+=v; if(v>0){n++;rows.push([h.name,v]);}}}
console.log('  เงินสนับสนุนรวม (เป้า 6):',M(sum),'·',n,'แห่ง  (ต้องเท่า 21.05M/6 แห่ง)',
  Math.abs(sum-21.05e6)<1e5&&n===6?'✅':'⚠️ เปลี่ยน');
rows.sort((a,b)=>b[1]-a[1]).forEach(r=>console.log('   ',r[0].padEnd(18),M(r[1])));
const hist={}; j.hosp.forEach(h=>{const s=A.exSimPath(h,0).sepRisk; if(s!=null)hist[s]=(hist[s]||0)+1;});
console.log('  ระดับ ณ ก.ย. baseline:',[0,1,2,3,4,5,6,7].filter(l=>hist[l]).map(l=>l+'×'+hist[l]).join(' '));
console.log('   (ต้องเท่าเดิม: 0×53 1×12 2×10 3×11 4×3 5×2 6×6 7×6)');
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
console.log('  เงินสำรองรวมทั้งเขต:',M(resTot),'(ต้องเท่า 1613.60M · เดิม MOE ทั้งก้อน×3 = 4227.35M)',
  Math.abs(resTot-1613.60e6)<1e5?'✅':'⚠️ เปลี่ยน');
console.log('  แห่งที่ใช้จ่ายอย่างอื่นได้ 0 บาท:',stuck.length,'(ต้องเป็น 4: ทุ่งหัวช้าง เทิง ขุนตาล เวียงเชียงรุ้ง)',
  stuck.length===4?'✅':'⚠️ เปลี่ยน — '+stuck.join(' '));
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

console.log('\n════ สรุป ════');
if(fail.length){ console.log('  ⚠️ พบปัญหา',fail.length,'รายการ:'); fail.slice(0,10).forEach(f=>console.log('   ',f)); }
else console.log('  ✅ ผ่านทุกข้อ');
