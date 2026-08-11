// ชุดตรวจตัวเลือก "นิยาม MOE" 3 แบบ ในตารางผลจำลอง #exec (เพิ่ม 6 ส.ค. 69 · RISK_EXEC_MODEL.md 3.14)
//   Ver69 (ค่าเริ่มต้น 59 บัญชี) · Ver68 (ชุดเดิม 62 บัญชี) · Ver69 + จ่ายหนี้การค้า X%
// ศัพท์ที่ใช้ (เจ้าของงานสั่ง 6 ส.ค. 69): เลิกใช้คำ "ยืดได้/ยืดไม่ได้" ที่ผู้ช่วยตั้งเอง
//   ธง cash = "ต้องชำระตามกำหนด (ไม่มีเครดิตเทอม)" · ที่เหลือ = "ค้างเป็นเจ้าหนี้การค้าได้"
// หัวใจที่ต้องล็อกไว้: สลับเวอร์ชัน/ปรับ % แล้ว **NI จำลองต้องไม่ขยับ** (ค่าใช้จ่ายรวมเท่าเดิม
// เปลี่ยนแค่ว่าก้อนไหนอยู่ใน MOE และก้อนไหนจ่ายเงินสดเดือนนี้) — ถ้าข้อนี้พัง = โมเดลผิดหลักบัญชี
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const code=[...fs.readFileSync(SRC,'utf8')
  .matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const mkEl=()=>({innerHTML:'',textContent:'',scrollTop:0,classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}});
const els={};
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),querySelectorAll:()=>[],addEventListener(){},
  documentElement:mkEl(),createElement:mkEl,body:mkEl()};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {fmtM,exRender,exSimPath,exSolveFor,exNiMo,exMoeMo,exMoeAccMo,exMoeStretchMo,
  exMoeGrpRaw,exMoeCashMo,exXmoeMo,exMoeVer,exPayPct,exMoeVerLab,exMoeLeft,exTopUp,SHOW_TJAR:EX_SHOW_TJAR,SHOW_GIVE:EX_SHOW_GIVE,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXTJ:v=>{EXTJ=v},setEXBRK:v=>{EXBRK=v},setEXOPEN:v=>{EXOPEN=v},setEXSORT:v=>{EXSORT=v}};`)();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const S=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/summary.json','utf8'));
const ST=(moeVer,payPct)=>({crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,mmo:3,
  moeVer,payPct,moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{}});
const M=v=>v==null?'—':(v/1e6).toFixed(2)+'M';
let fail=[];
const chk=(ok,msg,extra)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}${extra?' — '+extra:''}`); if(!ok) fail.push(msg); };
A.setEX(j); A.setEXTJ({debtors:new Set(),shares:{},refund:{},total:0,uncovered:0});
A.setEXBRK({}); A.setEXOPEN({}); A.setEXSORT({col:null,dir:-1});
const mo=j.monthsElapsed;
const tot=f=>j.hosp.reduce((s,h)=>s+f(h),0);

console.log('━━ 0) ข้อมูลจาก pipeline ครบทั้ง 3 ชุด ━━');
chk(!!j.moeVers && j.moeVers.def==='69', `exec.json มี meta moeVers และค่าเริ่มต้น = Ver69`,
    j.moeVers?`n69=${j.moeVers.n69} n68=${j.moeVers.n68} nP9=${j.moeVers.nP9}`:'ไม่มี');
chk(j.moeVers.n69===59 && j.moeVers.n68===62 && j.moeVers.nP9===9, 'จำนวนบัญชี 59 / 62 / 9 ตรงตามที่ CFO กำหนด');
chk(j.hosp.every(h=>h.moe68 && h.moeP9), 'ทุกแห่งมี moe68 + moeP9');
const nRent=j.moeGroups.filter(g=>g.id==='rent').length;
chk(nRent===1, 'มีกลุ่ม "ค่าเช่า" (rent) แยกออกมาตามที่เจ้าของงานสั่ง');
const rentG=j.moeGroups.find(g=>g.id==='rent');
chk(rentG && rentG.accs.length===1 && rentG.accs[0].a==='5104030212.101' && (rentG.accs68||[]).length===0,
    'ค่าเช่าเบ็ดเตล็ด 5104030212.101 อยู่ใน Ver69 เท่านั้น (Ver68 ไม่มี)');
// เจ้าของงานยืนยัน 6 ส.ค. 69: "ค่าเช่าค้างไม่ได้" → ต้องติดธง cash = เข้าฐานเงินสำรอง MOE × 3 เดือน
chk(!!(rentG && rentG.cash), 'ค่าเช่าติดธง cash (ต้องชำระตามกำหนด) → นับเข้าเงินสำรอง MOE');
chk(j.moeGroups.every(g=>!g.cash || !(g.p9||[]).length),
    'กลุ่มที่ต้องชำระตามกำหนด (ธง cash) ไม่มีบัญชีในชุด 9 ตัว → เลือกจ่ายกี่ % เงินสำรองไม่ขยับ');

console.log('\n━━ 1) ยอด MOE แต่ละเวอร์ชัน ━━');
A.setEXST(ST('69',100)); const v69=tot(A.exMoeMo);
A.setEXST(ST('68',100)); const v68=tot(A.exMoeMo);
console.log(`  Ver69 ${M(v69)}/ด. · Ver68 ${M(v68)}/ด. · ต่าง ${M(v69-v68)}`);
// ⚠️ 3 ค่านี้ผูกกับงวดข้อมูล ต้องอัปเดตทุกครั้งที่เดินงวด (ล่าสุด: งวด 256910 ก.ค. 69 — 11 ส.ค. 69)
//    งวด 256909 เดิม: Ver69 1,409.1 · Ver68 1,391.4 · เงินสำรอง 1,613.56 ลบ.
chk(Math.abs(v69-1408.04e6)<1e5, 'Ver69 = 1,408.04 ลบ./เดือน (ยันไว้กับงวด 256910)', M(v69));
chk(Math.abs(v68-1391.81e6)<1e5, 'Ver68 = 1,391.81 ลบ./เดือน (ยันไว้กับงวด 256910)', M(v68));
// ผลต่างต้องอธิบายได้ครบด้วยบัญชีที่ต่างกันเท่านั้น: +ค่าเช่า (Ver69) − ค่าจ้างชั่วคราว(บริการ) (Ver68)
A.setEXST(ST('69',100));
const rentMo=tot(h=>A.exMoeGrpRaw(h,'rent'))/mo;
A.setEXST(ST('68',100));
const laborDiff=tot(h=>A.exMoeGrpRaw(h,'labor'))/mo-(A.setEXST(ST('69',100)),tot(h=>A.exMoeGrpRaw(h,'labor'))/mo);
chk(Math.abs((v69-v68)-(rentMo-laborDiff))<1e3,
    'ผลต่างสองเวอร์ชัน = ค่าเช่า − ค่าจ้างชั่วคราว(บริการ) พอดี (ไม่มีบัญชีอื่นหลุดเข้า/ออก)',
    `${M(rentMo)} − ${M(laborDiff)} = ${M(rentMo-laborDiff)}`);

console.log('\n━━ 2) ⭐ NI จำลองต้องไม่ขยับทุกเวอร์ชัน/ทุก % (หัวใจของแบบ A) ━━');
A.setEXST(ST('69',100)); const ni69=j.hosp.map(A.exNiMo);
let dNi=0, dGl=0;
for(const [ver,pct] of [['68',100],['69',100],['69p',100],['69p',50],['69p',0]]){
  A.setEXST(ST(ver,pct));
  j.hosp.forEach((h,i)=>{
    dNi=Math.max(dNi,Math.abs(A.exNiMo(h)-ni69[i]));
    dGl=Math.max(dGl,Math.abs(A.exNiMo(h)-h.bs.ni/h.bs.mo));   // ต้องตรง run-rate จริงจากงบทดลองด้วย
  });
}
chk(dNi<1, 'NI จำลองรายแห่งเท่ากันทุกเวอร์ชัน/ทุก % (คลาดสูงสุด <1 บาท)', M(dNi));
chk(dGl<1e5, 'NI จำลอง = NI run-rate จากงบทดลอง (identity ข้อ 2) ในทุกเวอร์ชัน', M(dGl));

console.log('\n━━ 3) โหมด Ver69 + จ่ายหนี้การค้า X% ━━');
A.setEXST(ST('69',100)); const acc69=tot(A.exMoeAccMo), p9Mo=tot(h=>Object.values(h.moeP9||{}).reduce((s,v)=>s+v,0))/mo;
for(const pct of [100,75,50,25,0]){
  A.setEXST(ST('69p',pct));
  const cash=tot(A.exMoeMo), str=tot(A.exMoeStretchMo), acc=tot(A.exMoeAccMo);
  const want=acc69-p9Mo*(1-pct/100);
  const ok=Math.abs(cash-want)<1e3 && Math.abs(acc-acc69)<1e3 && Math.abs(cash+str-acc)<1e3;
  chk(ok, `จ่าย ${String(pct).padStart(3)}% → MOE เงินสด ${M(cash)} (คงค้าง ${M(acc)} − ยืด ${M(str)})`,
      ok?'':`ควรได้ ${M(want)}`);
}
A.setEXST(ST('69p',100));
chk(Math.abs(tot(A.exMoeMo)-v69)<1e3, 'จ่าย 100% ให้ผลเท่า Ver69 เป๊ะ (ไม่มีผลข้างเคียงแอบแฝง)');
A.setEXST(ST('69p',0));
chk(Math.abs(tot(A.exMoeMo)-(v69-p9Mo))<1e3, 'จ่าย 0% = ตัดยอด 9 บัญชีออกจากเงินสดทั้งก้อน', M(v69-p9Mo));
// เงินสำรอง MOE (กลุ่มยืดไม่ได้ × 3 + ค้างจ่าย) ต้องไม่ขยับตาม %
A.setEXST(ST('69',100)); const res100=tot(h=>A.exSimPath(h,0).resNeed0);
A.setEXST(ST('69p',0));  const res0=tot(h=>A.exSimPath(h,0).resNeed0);
chk(Math.abs(res100-res0)<1, 'เงินสำรอง MOE ไม่ขยับตาม %จ่ายหนี้การค้า (ค่าแรง/ค่าน้ำค่าไฟ/ค่าเช่า ต้องชำระตามกำหนด)', M(res100));
chk(Math.abs(res100-1634.50e6)<1e5, 'เงินสำรอง MOE ทั้งเขต = 1,634.50 ลบ. (รวมค่าเช่าแล้ว · ถ้าไม่รวม 1,466.44) — งวด 256910', M(res100));

console.log('\n━━ 4) ค้างชำระหนี้ต้องมีต้นทุน — เจ้าหนี้การค้าโต + CR/QR/Cash แย่ลง ━━');
A.setEXST(ST('69',100));
const base=j.hosp.map(h=>A.exSimPath(h,0));
A.setEXST(ST('69p',0));
const strch=j.hosp.map(h=>A.exSimPath(h,0));
let badAp=0, badCash=0, badRatio=0, nWorse=0, dNiSim=0;
j.hosp.forEach((h,i)=>{
  const b=base[i], s=strch[i];
  const months=(12-h.bs.mo);
  if(Math.abs(s.apStretch-s.stretchMo*months)>1) badAp++;              // กองขึ้นเดือนละครั้งตามช่วงจำลอง
  if(!(s.cnEnd>=b.cnEnd-1)) badCash++;                                 // เงินสดปลายงวดต้องไม่แย่ลง
  if(!(s.clEnd>=b.clEnd-1)) badRatio++;                                // หนี้สินหมุนเวียนต้องโตขึ้น
  if(b.sepBreak&&s.sepBreak){
    dNiSim=Math.max(dNiSim,Math.abs(s.sepBreak.ni-b.sepBreak.ni));      // NI สะสม ณ ก.ย. ต้องเท่าเดิม
    if(s.sepBreak.cr<b.sepBreak.cr-1e-9) nWorse++;
  }
});
chk(badAp===0, 'ยอดเจ้าหนี้ที่ยืด = ส่วนที่ยืด/เดือน × จำนวนเดือนถึง ก.ย. ทุกแห่ง', `ผิด ${badAp}`);
chk(badCash===0, 'เงินสดปลายงวดไม่แย่ลงเมื่อยืดหนี้ (ผิด '+badCash+' แห่ง)');
chk(badRatio===0, 'หนี้สินหมุนเวียนปลายงวดโตขึ้นจริงเมื่อยืดหนี้ (ผิด '+badRatio+' แห่ง)');
chk(dNiSim<1, 'NI สะสม ณ ก.ย. เท่าเดิมทุกแห่ง — ยืดหนี้ไม่กลายเป็นกำไร', M(dNiSim));
chk(nWorse>0, `CR ณ ก.ย. แย่ลงจริงในบางแห่ง = ค้างชำระหนี้มีต้นทุน (${nWorse} แห่ง)`);
console.log(`   ค้างชำระ 100% ของ 9 บัญชี: ${M(tot(A.exMoeStretchMo))}/ด. → เจ้าหนี้เพิ่มถึง ก.ย. ${M(strch.reduce((s,r)=>s+r.apStretch,0))}`);

console.log('\n━━ 5) กติกาเหล็ก 3.6 — moeMo ใน summary.json = Ver69 (ค่าเริ่มต้น) ━━');
A.setEXST(ST('69',100));
const byHc=Object.fromEntries(j.hosp.map(h=>[h.hcode,h]));
let mism=[];
for(const h of S.hospitals){
  const e=byHc[h.hcode]; if(!e) continue;
  const want=Object.values(e.moe).reduce((s,v)=>s+v,0)/e.bs.mo;
  if(Math.abs(want-h.moeMo)>1) mism.push(`${h.name} ${Math.round(h.moeMo)} vs ${Math.round(want)}`);
}
chk(mism.length===0, 'summary.json.moeMo ตรงกับ MOE.Ver69 ใน exec.json ทุกแห่ง', mism.slice(0,3).join(' · '));

console.log('\n━━ 6) หน้าเว็บเรนเดอร์ได้ครบทั้ง 3 โหมด ━━');
for(const [ver,pct,lab] of [['69',100,'MOE.Ver69'],['68',100,'MOE.Ver68'],['69p',40,'MOE.Ver69 + จ่ายหนี้การค้า 40%']]){
  A.setEXST(ST(ver,pct)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
  let err=null; try{ A.exRender(); }catch(e){ err=e.message; }
  const html=(els.exResBox&&els.exResBox.innerHTML)||'', moeBox=(els.exMoeBox&&els.exMoeBox.innerHTML)||'';
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[0]);
  const nTh=((rows[0]||'').match(/<th\b/g)||[]).length;
  const main=rows.filter(r=>r.includes('class="ovtgl"'));
  const badTd=main.filter(r=>(r.match(/<td\b/g)||[]).length!==nTh).length;
  chk(!err && nTh===14+(A.SHOW_TJAR?1:0)-(A.SHOW_GIVE?0:1) && main.length===j.hosp.length && badTd===0 && !/undefined|NaN/.test(html+moeBox)
      && html.includes(`value="${ver}" selected`) && moeBox.includes(lab),
      `โหมด ${lab}: เรนเดอร์ครบ ${main.length} แถว × ${nTh} คอลัมน์ · dropdown ค้างค่าถูก · ไม่มี undefined/NaN`,
      err||(badTd?`td ไม่ครบ ${badTd} แถว`:''));
  // ตัวเลขในคอลัมน์ MOE/เดือน ต้องเป็น "เงินสดจ่ายจริง" ของโหมดนั้น
  const h0=j.hosp.find(h=>main[0].includes('<b>'+h.name+'</b>'))||j.hosp[0];
  const shown=(main.find(r=>r.includes('<b>'+h0.name+'</b>'))||'').match(/<td[^>]*>([\s\S]*?)<\/td>/g)||[];
  const want=A.exMoeMo(h0);
  const fmt=A.fmtM;   // ดึงจากหน้าเว็บ ห้ามลอกสูตรมาไว้ที่นี่ (ทศนิยมเปลี่ยนแล้วเทสต์จะฟ้องผิดเอง)
  chk((shown[3]||'').includes(fmt(want)), `  └ คอลัมน์ MOE/เดือน ของ ${h0.name} = ${fmt(want)} (เงินสดจ่ายจริงของโหมดนี้)`);
}

console.log('\n━━ สรุป ━━');
if(fail.length){ console.log('  ⚠️ ไม่ผ่าน '+fail.length+' ข้อ:'); fail.forEach(f=>console.log('   · '+f)); process.exitCode=1; }
else console.log('  ✅ ผ่านทุกข้อ');
