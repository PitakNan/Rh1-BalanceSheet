// ชุดตรวจ 🏦 เงินของเขตที่ฝากไว้กับ รพ. — RISK_EXEC_MODEL.md 7.27
// (หักออกจากเงินสดตั้งแต่ต้น + กลไกเลือกเติมให้ รพ. อื่น)
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const code=[...fs.readFileSync(SRC,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const mkEl=()=>({innerHTML:'',textContent:'',scrollTop:0,style:{},value:'',classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){}});
const els={};
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),querySelectorAll:()=>[],addEventListener(){},
  documentElement:mkEl(),createElement:()=>mkEl(),body:{appendChild(e){if(e&&e.id)els[e.id]=e}}};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exSimPath,exNetAfterDebt,exRgDep,exRgHolders,exRgPool,exRgIn,exRgLeft,
  exRgLeftAll,exRgAdd,exRgDel,exRgClear,exRgAuto,exRgList,exTopUp,exRender,exSolveFor,fmtM,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXTJ:v=>{EXTJ=v},setEXBRK:v=>{EXBRK=v},setEXOPEN:v=>{EXOPEN=v},
  setEXSORT:v=>{EXSORT=v},getEXST:()=>EXST};`)();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=o=>Object.assign({mmo:2,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,
  moeVer:'69',payPct:50,moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{},xfer:[],rgAlloc:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true},o);
A.setEX(j); A.setEXST(ST({})); A.setEXTJ({debtors:new Set(),shares:{},refund:{},total:0,uncovered:0});
A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
const M=v=>(v/1e6).toFixed(2);
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};

console.log('━━ ① ยอดเงินฝากมาจาก exec.json ครบ 3 แห่ง ━━');
const hold=A.exRgHolders();
chk(hold.length===3, `มีผู้ถือเงินฝาก 3 แห่ง (ได้ ${hold.length})`);
const want={'10713':47.4e6,'10672':57.4e6,'10674':57.4e6};
for(const k in want){
  const h=j.hosp.find(x=>x.hcode===k);
  chk(h&&Math.abs(A.exRgDep(h)-want[k])<1, `${h?h.name:k} = ${M(want[k])} ลบ.`);
}
chk(Math.abs(A.exRgPool()-162.2e6)<1, `ก้อนรวม 162.20 ลบ. (ได้ ${M(A.exRgPool())})`);
// ห้าม hardcode ยอดซ้ำในหน้าเว็บ — ต้องอ่านจาก EX.regionDep เท่านั้น
const raw=fs.readFileSync(SRC,'utf8');
chk(!/57[,_.]?4(00[,_]?000|\s*e6)/.test(raw.replace(/\s/g,'')), 'ไม่ hardcode ยอด 57.4 ลบ. ซ้ำในหน้าเว็บ (อ่านจาก exec.json อย่างเดียว)');

console.log('\n━━ ② หักออกจากเงินสดตั้งแต่ต้น (ไม่แตะหนี้สิน · ไม่กระทบ NI) ━━');
// ⚠️ ห้ามยืนยันด้วย "net < cn" — ลูกหนี้ตามจ่าย (arIn) อาจมากกว่าเงินฝากจนสุทธิยังบวก
//    ต้องเทียบกับ instance ที่ไม่มี regionDep แล้วดูว่าต่างกันเท่ากับยอดฝากเป๊ะ
const noDep=JSON.parse(JSON.stringify(j)); delete noDep.regionDep;
const B=new Function(code+`;return {exSimPath,exNetAfterDebt,setEX:v=>{EX=v},setEXST:v=>{EXST=v},
  setEXTJ:v=>{EXTJ=v},setEXBRK:v=>{EXBRK=v}};`)();
B.setEX(noDep); B.setEXST(ST({})); B.setEXTJ({debtors:new Set(),shares:{},refund:{},total:0,uncovered:0});
for(const k of hold){
  const h=j.hosp.find(x=>x.hcode===k), h2=noDep.hosp.find(x=>x.hcode===k);
  A.setEXST(ST({}));
  const net=A.exNetAfterDebt(h), net2=B.exNetAfterDebt(h2), dep=A.exRgDep(h);
  chk(Math.abs((net2-net)-dep)<1, `${h.name}: สุทธิลดลงเท่ากับยอดฝากเป๊ะ ${M(net2)} − ${M(net)} = ${M(net2-net)} (ฝาก ${M(dep)})`);
  const b=A.exSimPath(h,0).sepBreak, b2=B.exSimPath(h2,0).sepBreak;
  chk(Math.abs(b.cl-b2.cl)<1, `${h.name}: หนี้สินหมุนเวียนเท่าเดิมเป๊ะ (ไม่แตะฝั่งหนี้สิน)`);
  chk(b.cash<b2.cash, `${h.name}: Cash ratio ต่ำลงจริง (${b.cash.toFixed(3)} < ${b2.cash.toFixed(3)})`);
}
// NI ต้องไม่ขยับจากการหักเงินฝาก (ไม่ใช่รายได้/ค่าใช้จ่าย)
{
  const h=j.hosp.find(x=>x.hcode==='10672');
  const b=A.exSimPath(h,0).sepBreak;
  const b2=B.exSimPath(noDep.hosp.find(x=>x.hcode==='10672'),0).sepBreak;
  chk(Math.abs(b.ni-b2.ni)<1, `NI ไม่ขยับจากการหักเงินฝาก (มีฝาก ${M(b.ni)} vs ไม่มี ${M(b2.ni)})`);
  chk(b.cash<b2.cash, `Cash ratio ต่ำลงจริงเมื่อหักเงินฝาก (${b.cash.toFixed(3)} < ${b2.cash.toFixed(3)})`);
  chk(Math.abs(b.cl-b2.cl)<1, 'หนี้สินหมุนเวียนเท่าเดิมเป๊ะ (ยืนยันว่าไม่แตะฝั่งหนี้สิน)');
}

console.log('\n━━ ③ จัดสรรเองได้ + ให้เกินก้อนไม่ได้ ━━');
A.setEXST(ST({}));
const tgt=j.hosp.find(h=>hold.indexOf(h.hcode)<0);
A.exRgAdd('10672', tgt.hcode, 20e6);
chk(Math.abs(A.exRgIn(tgt)-20e6)<1, `เติมให้ ${tgt.name} 20.00 ลบ. สำเร็จ (ได้ ${M(A.exRgIn(tgt))})`);
chk(Math.abs(A.exRgLeft('10672')-37.4e6)<1, `ก้อนลำปางเหลือ 37.40 ลบ. (ได้ ${M(A.exRgLeft('10672'))})`);
A.exRgAdd('10672', tgt.hcode, 999e6);
chk(Math.abs(A.exRgIn(tgt)-57.4e6)<1, `ขอเกินก้อนถูกตัดเหลือเท่าที่มี 57.40 ลบ. (ได้ ${M(A.exRgIn(tgt))})`);
chk(A.exRgLeft('10672')===0, 'ก้อนลำปางเหลือ 0 หลังใช้เต็ม');
A.exRgDel('10672', tgt.hcode);
chk(A.exRgIn(tgt)===0 && Math.abs(A.exRgLeft('10672')-57.4e6)<1, 'ลบรายการแล้วก้อนคืนเต็ม');

console.log('\n━━ ④ เงินที่ได้รับต้องช่วยสภาพคล่องจริง ━━');
A.setEXST(ST({}));
const shortHosp=j.hosp.filter(h=>hold.indexOf(h.hcode)<0)
  .map(h=>({h,need:A.exTopUp({h,r0:A.exSimPath(h,0)})})).filter(x=>x.need>0)
  .sort((a,b)=>b.need-a.need)[0];
if(shortHosp){
  const before=shortHosp.need;
  A.exRgAdd('10674', shortHosp.h.hcode, Math.min(before, 57.4e6));
  const after=A.exTopUp({h:shortHosp.h,r0:A.exSimPath(shortHosp.h,0)});
  console.log(`     ${shortHosp.h.name}: ขาด ${M(before)} → หลังเติม ${M(after)} ลบ.`);
  chk(after<before, 'ส่วนขาดสภาพคล่องลดลงจริงหลังได้รับเงินเขต');
  A.exRgClear();
}

console.log('\n━━ ⑤ ⚡ จัดสรรอัตโนมัติ ━━');
A.setEXST(ST({}));
A.exRgAuto();
const plan=A.exRgList();
const tot=plan.reduce((s,x)=>s+x.a,0);
console.log(`     จัดสรร ${plan.length} รายการ รวม ${M(tot)} ลบ. · เหลือ ${M(A.exRgLeftAll())} ลบ.`);
chk(plan.length>0, 'จัดสรรอัตโนมัติได้อย่างน้อย 1 รายการ');
chk(tot<=A.exRgPool()+1, `ยอดจัดสรรไม่เกินก้อนรวม (${M(tot)} ≤ ${M(A.exRgPool())})`);
chk(plan.every(x=>hold.indexOf(x.t)<0), '⚠️ ไม่เติมให้ผู้ถือเงินฝากเอง');
chk(hold.every(f=>A.exRgLeft(f)>=-1), 'ไม่มีก้อนไหนติดลบ');

console.log('\n━━ ⑥ แผงเรนเดอร์ได้ ไม่มี undefined/NaN ━━');
A.exRender();
const box=els['exRgBox'];
chk(!!(box&&box.innerHTML), 'แผง exRgBox มีเนื้อหา');
if(box&&box.innerHTML){
  chk(!/undefined|NaN/.test(box.innerHTML), 'ไม่มี undefined/NaN ในแผง');
  const t=box.innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  chk(t.includes('เงินของเขตที่ฝากไว้'), 'มีหัวข้อแผง');
  chk(t.includes('ไม่ใช่ของ รพ. ที่ถือไว้'), 'อธิบายว่าไม่ใช่เงินของ รพ.');
  chk(t.includes('ไม่มีบัญชีเงินรับฝากคู่กันฝั่งหนี้สิน'), 'ระบุเหตุผลที่หักฝั่งเงินสดอย่างเดียว');
  chk(t.includes('ไม่เติมให้ผู้ถือเงินฝากเอง'), 'ระบุกติกาไม่เติมให้ผู้ถือเอง');
}

console.log('\n━━ สรุป ━━');
if(fail.length){ console.log(`❌ ไม่ผ่าน ${fail.length} ข้อ`); fail.forEach(f=>console.log('   '+f)); process.exit(1); }
console.log('✅ ผ่านทุกข้อ');
