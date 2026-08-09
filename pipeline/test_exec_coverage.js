// ⭐ ล็อกบั๊กชุด "ตรวจแดชบอร์ดทั้งหน้า 9 ส.ค. 69" ไม่ให้กลับมา — 4 ข้อ
//   ① บรรทัดสรุปแผนโยกเงินต้องไม่ขึ้นกับตัวกรอง (เดิมคิดจาก items ที่กรองแล้ว → ค่าเริ่มต้น
//      "เฉพาะวิกฤต 6-7" ตัดผู้ให้ทิ้งเกือบหมด หน้าจอบอก "ขาดต้นทาง 114M ต้องเป็นเงินนอกเขต"
//      ทั้งที่ทั้งเขตยกให้ได้ 2.61B และขาดต้นทางจริงแค่ ~23M)
//   ② คำตัดสิน ✅/⛔ ต้องตรงกับผลของปุ่ม ⚡ จัดสรรอัตโนมัติ (ซึ่งโยกในจังหวัดเท่านั้น · กติกาข้อ ①)
//   ③ ช่อง ✎ ลูกหนี้: พิมพ์ค่าที่ไม่ใช่ตัวเลข ต้องไม่ทำให้ยอดกลายเป็น 0
//   ④ คำเตือน "จัดสรรในจังหวัดไม่ครบ" ต้องกระทบยอดกับคอลัมน์ส่วนขาดจริง (ไม่บวก buffer 100K)
// รันได้ทั้งจาก repo root และจาก pipeline/
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const SRC=process.env.RD_SRC||path.join(ROOT,'docs','risk_drill.html');
const code=[...fs.readFileSync(SRC,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const mkEl=()=>({innerHTML:'',textContent:'',scrollTop:0,scrollLeft:0,value:'',
  classList:{toggle(){},add(){},remove(){},contains:()=>false},dataset:{},querySelectorAll:()=>[],
  addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}});
const els={};
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),querySelectorAll:()=>[],addEventListener(){},
  documentElement:mkEl(),createElement:mkEl,body:mkEl()};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null}; global.confirm=()=>true;
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exRender,exCoverage,exXferAuto,exXferList,exXferClear,exSimPath,
  exTopUp,exMoeLeft,exRows,exArIn,exArRaw,exSetArOvr,EXXF_SHORT:()=>EXXF_SHORT,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
const j=JSON.parse(fs.readFileSync(path.join(ROOT,'docs','data','risk','exec.json'),'utf8'));
const ST=o=>({mmo:3,crisis:'67',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,
  moeVer:'69',payPct:50,moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},
  ovr:{},tj:{mode:'off',scope:'crisis'},inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false,
  clGrow:true,seas:true,provSort:{col:'prov',dir:1},...o});
A.setEX(j); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
const M=v=>(v/1e6).toFixed(2)+'M';
const txt=()=>els['exResBox'].innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
let fail=[];
const chk=(ok,msg)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}`); if(!ok) fail.push(msg); };

console.log(`ไฟล์: ${SRC}\nงวด: ${j.periodLabel} · รพ. ${j.hosp.length} แห่ง`);

// ══ ① ตัวเลขที่ใช้ตัดสินต้องนิ่ง ไม่ว่าตัวกรองจะเป็นอะไร ══════════════════════════════
console.log('\n━━ ① บรรทัดสรุปต้องไม่ขึ้นกับตัวกรอง ━━');
const cov={};
for(const st of [{crisis:'67'},{crisis:'all'},{crisis:'all',prov:j.hosp[0].prov},
                 {crisis:'67',types:{'รพช.':true,'รพศ.':false,'รพท.':false}}]){
  A.setEXST(ST({...st, xfer:[]})); A.exRender();
  const c=A.exCoverage();
  cov[JSON.stringify(st)]={cap:Math.round(c.cap), short:Math.round(c.short), gap:Math.round(c.gap),
                           nGap:c.gapProv.length};
  console.log(`  ${JSON.stringify(st).padEnd(52)} cap ${M(c.cap).padStart(9)} · short ${M(c.short).padStart(8)} · ขาดต้นทาง ${M(c.gap)}`);
}
const vals=[...new Set(Object.values(cov).map(v=>JSON.stringify(v)))];
chk(vals.length===1, `ทุกตัวกรองให้ตัวเลขตัดสินชุดเดียวกัน (ได้ ${vals.length} ชุด)`);

// ยอดที่ตัดสินต้องเป็น "ทั้งเขต" จริง ไม่ใช่ยอดของชุดที่กรอง
A.setEXST(ST({crisis:'67'})); A.exRender();
const c67=A.exCoverage();
const viewCap=A.exRows().map(h=>({h,r0:A.exSimPath(h,0)})).filter(x=>A.exMoeLeft(x)>0).length;
chk(c67.nCap>viewCap, `กำลังช่วยนับจากทั้งเขต (${c67.nCap} แห่ง) ไม่ใช่แค่ที่กรองอยู่ (${viewCap} แห่ง)`);
const t67=txt();
chk(!/ทั้งเขตยกให้ได้แค่ 300K/.test(t67), 'ไม่มีข้อความ "ทั้งเขตยกให้ได้แค่ 300K" (อาการของบั๊กเดิม)');
chk(/กำลังช่วยที่เหลือ\s*ทั้งเขต/.test(t67), 'บรรทัดสรุประบุชัดว่าเป็นยอด "ทั้งเขต"');

// ══ ② คำตัดสินต้องตรงกับผลของปุ่มจัดสรรอัตโนมัติ ═════════════════════════════════════
console.log('\n━━ ② ✅/⛔ ต้องตรงกับผลจริงของ ⚡ จัดสรรอัตโนมัติ ━━');
for(const crisis of ['67','all']){
  A.setEXST(ST({crisis, xfer:[]})); A.exRender();
  const c=A.exCoverage(), before=txt();
  const saysOk=/✅ ส่วนขาดที่เหลือทั้งเขต/.test(before);
  const saysNo=/⛔ ส่วนขาดที่เหลือทั้งเขต/.test(before);
  A.exXferAuto(); A.exRender();
  const after=A.exRows().map(h=>({h,r0:A.exSimPath(h,0)}));
  const rest=j.hosp.map(h=>({h,r0:A.exSimPath(h,0)})).reduce((s,x)=>s+A.exTopUp(x),0);
  console.log(`  crisis=${crisis}: หน้าจอบอก ${saysOk?'✅ ครบ':(saysNo?'⛔ ขาดต้นทาง '+M(c.gap):'(ไม่มีส่วนขาด)')} · กดจริงแล้วเหลือขาด ${M(rest)}`);
  chk(!(saysOk&&rest>1e6), `crisis=${crisis}: ไม่ขึ้น ✅ ทั้งที่กดจัดสรรแล้วยังเหลือขาด ${M(rest)}`);
  if(saysNo) chk(Math.abs(c.gap-rest)<c.gap*0.15+1e6,
    `crisis=${crisis}: ยอด "ขาดต้นทาง" ${M(c.gap)} ใกล้เคียงกับที่เหลือจริงหลังกด ${M(rest)}`);
  A.exXferClear();
}

// ══ ③ ช่อง ✎ ลูกหนี้ — ค่าที่ไม่ใช่ตัวเลขต้องไม่ทำให้ยอดเป็น 0 ══════════════════════════
console.log('\n━━ ③ ช่อง ✎ ลูกหนี้: ค่าที่พิมพ์ผิดต้องไม่ล้างยอด ━━');
A.setEXST(ST({crisis:'all'}));
const hAr=j.hosp.filter(h=>(h.tj&&h.tj.arIn)>0).sort((a,b)=>b.tj.arIn-a.tj.arIn)[0];
const base=A.exArIn(hAr);
for(const bad of ['abc','ห้าสิบ','-','1.2.3',' ']){
  A.exSetArOvr(hAr.hcode,bad);
  chk(Math.abs(A.exArIn(hAr)-base)<1, `พิมพ์ "${bad}" แล้วยอดคงเดิม ${M(base)}`);
}
A.exSetArOvr(hAr.hcode,'12.5');
chk(Math.abs(A.exArIn(hAr)-12.5e6)<1, 'พิมพ์ 12.5 → 12.50M (ตัวเลขปกติยังทำงาน)');
A.exSetArOvr(hAr.hcode,'1,234');
chk(Math.abs(A.exArIn(hAr)-Math.min(1234e6,A.exArRaw(hAr)))<1, 'พิมพ์ 1,234 (มีจุลภาค) อ่านเป็นตัวเลขได้ และไม่เกินยอดดิบ');
A.exSetArOvr(hAr.hcode,'');
chk(Math.abs(A.exArIn(hAr)-base)<1, 'พิมพ์ช่องว่าง = ล้างค่าที่กำหนดเอง กลับไปใช้การเกลี่ย');

// ══ ④ คำเตือนข้อ ④ ต้องกระทบยอดกับส่วนขาดจริง (ไม่บวก buffer 100K) ═══════════════════
console.log('\n━━ ④ คำเตือน "จัดสรรในจังหวัดไม่ครบ" ต้องกระทบยอดได้ ━━');
A.setEXST(ST({crisis:'all', xfer:[]})); A.exRender(); A.exXferAuto(); A.exRender();
const warnSum=A.EXXF_SHORT().reduce((s,x)=>s+x.left,0);
const realSum=j.hosp.map(h=>({h,r0:A.exSimPath(h,0)})).reduce((s,x)=>s+A.exTopUp(x),0);
console.log(`  คำเตือนรวม ${M(warnSum)} · ส่วนขาดจริงรวม ${M(realSum)} · ต่าง ${M(Math.abs(warnSum-realSum))}`);
chk(Math.abs(warnSum-realSum)<1e5, 'ยอดในคำเตือน = ยอดในคอลัมน์ส่วนขาด (ต่างไม่เกิน 100K)');
A.exXferClear();

console.log('\n━━ สรุป ━━');
console.log(fail.length?`❌ ไม่ผ่าน ${fail.length} ข้อ:\n - `+fail.join('\n - '):'✅ ผ่านทุกข้อ');
process.exit(fail.length?1:0);
