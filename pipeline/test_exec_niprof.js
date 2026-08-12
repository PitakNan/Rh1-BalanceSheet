// ชุดตรวจ: โปรไฟล์ NI รายเดือน (bs.niProf) — เจ้าของงานสั่ง 12 ส.ค. 69
// "NI ต้องไม่ใช่เฉลี่ยต่อเดือน ต้องไปเอามาจากงบทดลอง แล้วถ้าเลือกตัวกรองเป็นเดือนไหน
//  ต้องเทียบสัดส่วนเพิ่มหรือลดให้เป็นไปตามทิศทาง"
// จับ regression แบบเดียวกับที่ niYE เคยโดน: คีย์หายแล้วหน้าเว็บ "ไม่พังให้เห็น" แต่กลับไปแบนเงียบ ๆ
const fs=require('fs'), path=require('path');
const REPO='D:/Github/Rh1-BalanceSheet';
const code=[...fs.readFileSync(REPO+'/docs/risk_drill.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const el={innerHTML:'',textContent:'',scrollTop:0,classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}};
global.document={getElementById:()=>el,querySelectorAll:()=>[],addEventListener(){},documentElement:el,createElement:()=>el,body:el};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exSimPath,exNiMo,exMoeMonths,setEX:v=>{EX=v},setEXST:v=>{EXST=v},
  setEXTJ:v=>{EXTJ=v},setEXBRK:v=>{EXBRK=v}};`)();
const j=JSON.parse(fs.readFileSync(REPO+'/docs/data/risk/exec.json','utf8'));
const ST=(o={})=>Object.assign({crisis:'67',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{}},o);
A.setEX(j); A.setEXST(ST()); A.setEXTJ({debtors:new Set(),shares:{},refund:{},total:0,uncovered:0});
const TH=['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.'];
const M=v=>(v/1e6).toFixed(2)+'M';
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m);};

console.log('━━ ① โครงสร้าง niProf ใน exec.json ━━');
const withP=j.hosp.filter(h=>Array.isArray(h.bs.niProf)&&h.bs.niProf.length===12);
chk(withP.length===j.hosp.length, `มี niProf ครบ 12 ช่องทุกแห่ง (${withP.length}/${j.hosp.length})`);
const badSum=j.hosp.filter(h=>{const p=h.bs.niProf||[]; return Math.abs(p.reduce((a,b)=>a+b,0))>Math.max(1000,Math.abs(h.bs.ni)*1e-4);});
chk(badSum.length===0, `ผลรวม 12 เดือนของทุกแห่ง = 0 (เป็นการกระจายตัว ไม่ใช่เพิ่มยอดทั้งปี) — ผิด ${badSum.length} แห่ง`);
const tot=new Array(12).fill(0); j.hosp.forEach(h=>(h.bs.niProf||[]).forEach((v,i)=>tot[i]+=v));
console.log('     โปรไฟล์ทั้งเขต: '+TH.map((t,i)=>t+'='+(tot[i]/1e6).toFixed(0)).join(' '));
chk(tot[0]>0 && tot[10]<0, 'ทิศทางตรงกับงบจริง: ต.ค. เป็นบวก (เดือนดีสุด) · ส.ค. เป็นลบ (ช่วงปิดบัญชี)');

console.log('\n━━ ② niProf สร้างซ้ำได้จาก trend (ไม่ใช่ตัวเลขยัดมือ) ━━');
// NI ใน trend เป็นยอดสะสมในปีงบ → NI เดือน m = ผลต่างกับเดือนก่อน (เดือน 1 = ยอดเอง)
let rep=0, repBad=[];
for(const h of j.hosp.slice(0,25)){
  const t=JSON.parse(fs.readFileSync(path.join(REPO,'docs/data/risk/h',h.hcode+'.json'),'utf8')).trend||[];
  const rows=[];
  for(const fy of [2567,2568]){
    const y={}; t.forEach(r=>{ if(r.ni!=null&&Math.floor(r.t/100)===fy) y[r.t%100]=r.ni; });
    if(Object.keys(y).length<12) continue;
    const mm=[y[1]]; for(let m=2;m<=12;m++) mm.push(y[m]-y[m-1]);
    const avg=mm.reduce((a,b)=>a+b,0)/12; rows.push(mm.map(v=>v-avg));
  }
  if(!rows.length) continue;
  const want=rows[0].map((_,i)=>Math.round(rows.reduce((s,r)=>s+r[i],0)/rows.length));
  const got=h.bs.niProf;
  const d=want.map((v,i)=>Math.abs(v-got[i])).reduce((a,b)=>Math.max(a,b),0);
  rep++; if(d>2) repBad.push(`${h.name} ต่างสูงสุด ${d.toFixed(0)} บาท`);
}
chk(rep>0 && repBad.length===0, `คำนวณซ้ำจาก trend ตรงกับ exec.json (${rep} แห่งที่สุ่มตรวจ · ผิด ${repBad.length})`);
if(repBad.length) console.log('     '+repBad.slice(0,3).join(' · '));

console.log('\n━━ ③ NI ที่ใช้จำลองต้องไม่แบน + เดินตามทิศทางของเดือนจริง ━━');
// อ่าน NI สะสมที่เดือนเป้า k แล้ว diff = NI ของเดือนนั้นที่โมเดลใช้จริง
function niByMonth(h, n){
  const out=[]; let prev=null;
  for(let k=1;k<=n;k++){
    A.setEXST(ST({mmo:k}));
    const b=A.exSimPath(h,0).sepBreak; if(!b) return null;
    if(prev!=null) out.push(b.ni-prev);
    else out.push(b.ni-h.bs.ni);
    prev=b.ni;
  }
  return out;
}
const big=j.hosp.slice().sort((a,b)=>Math.abs(b.bs.ni)-Math.abs(a.bs.ni))[0];
const seq=niByMonth(big,3);   // ส.ค. · ก.ย. · ต.ค.(ปีงบใหม่ NI รีเซ็ต จึงข้าม)
console.log(`     ${big.name}: NI ที่โมเดลใช้ ส.ค. ${M(seq[0])} · ก.ย. ${M(seq[1])}`);
chk(Math.abs(seq[0]-seq[1])>1, 'NI ของ ส.ค. กับ ก.ย. ต้องไม่เท่ากัน (ของเดิม niYE ใช้ค่าเดียวทั้ง 3 เดือน)');
// ทั้งเขต: ส.ค. ต้องแย่กว่า ก.ย. ตามโปรไฟล์จริง (ส.ค. −485 · ก.ย. −445 เทียบค่าเฉลี่ย)
let s8=0,s9=0;
for(const h of j.hosp){ const q=niByMonth(h,2); if(q){s8+=q[0]; s9+=q[1];} }
console.log(`     ทั้งเขต: ส.ค. ${M(s8)} · ก.ย. ${M(s9)}`);
chk(s8<s9, 'ทั้งเขต ส.ค. ต้องแย่กว่า ก.ย. — ตรงทิศกับโปรไฟล์ที่วัดจากงบจริง');

console.log('\n━━ ④ ปิดสวิตช์ 📉 ฤดูกาล = โปรไฟล์ต้องหยุดทำงานจริง ━━');
let dOn=0,dOff=0;
for(const h of j.hosp){
  A.setEXST(ST({mmo:2,seas:true}));  dOn +=A.exSimPath(h,0).sepBreak.ni;
  A.setEXST(ST({mmo:2,seas:false})); dOff+=A.exSimPath(h,0).sepBreak.ni;
}
console.log(`     NI สะสม ณ ก.ย.: เปิดฤดูกาล ${M(dOn)} · ปิด ${M(dOff)}`);
chk(dOn<dOff, 'เปิดฤดูกาลแล้ว NI ต้องต่ำกว่าปิด (ช่วงปิดบัญชีขาดทุน) = โปรไฟล์ถึงหน้าเว็บจริง');

console.log('\n━━ ⑤ กันนับซ้ำ: ฤดูกาลของเดือนที่ผ่านมาแล้วต้องไม่ถูกบวกซ้ำ ━━');
// niM คิดจากยอดสะสม ด.1..mo ซึ่งซึมซับฤดูกาลไปแล้ว → ต้องหักค่าเฉลี่ยโปรไฟล์ ด.1..mo ออก
const mo=j.monthsElapsed;
const h0=j.hosp[0], p0=h0.bs.niProf;
const off=p0.slice(0,mo).reduce((a,b)=>a+b,0)/mo;
A.setEXST(ST({mmo:1,seas:true}));  const n1=A.exSimPath(h0,0).sepBreak.ni-h0.bs.ni;
A.setEXST(ST({mmo:1,seas:false})); const n0=A.exSimPath(h0,0).sepBreak.ni-h0.bs.ni;
const applied=n1-n0, want=p0[mo]-off;         // เดือนถัดไป = index mo (0-based)
console.log(`     ${h0.name}: ปรับจริง ${applied.toFixed(0)} · ตามสูตร niProf[${mo}]−ค่าเฉลี่ย ด.1-${mo} = ${want.toFixed(0)}`);
chk(Math.abs(applied-want)<2, 'ค่าที่ปรับ = niProf[เดือนนั้น] − ค่าเฉลี่ยโปรไฟล์ของเดือนที่ผ่านมา (รูปทั่วไปของ exYeAdj เดิม)');

console.log('\n━━ ⑥ ข้ามรอยต่อปีงบ: ต.ค. ต้องได้ฤดูกาลของ ต.ค. ไม่ใช่ตัวคูณค้างจากปีนี้ ━━');
// จุดที่ exYeAdj เดิมทำไม่ได้ — ปีงบหน้าไม่มีการปรับเลยทั้งที่ ต.ค. เป็นเดือน NI ดีสุดของปี
let o3on=0,o3off=0;
for(const h of j.hosp){
  A.setEXST(ST({mmo:3,seas:true}));  o3on +=A.exSimPath(h,0).sepBreak.ni;
  A.setEXST(ST({mmo:3,seas:false})); o3off+=A.exSimPath(h,0).sepBreak.ni;
}
console.log(`     NI สะสม ณ ต.ค.70 (ปีงบใหม่ เริ่มนับใหม่): เปิด ${M(o3on)} · ปิด ${M(o3off)}`);
chk(o3on>o3off, 'ต.ค. เปิดฤดูกาลต้องดีกว่าปิด (+866 ลบ. เหนือค่าเฉลี่ย) — ของเดิมไม่ปรับปีงบหน้าเลย');

console.log('\n━━ สรุป ━━');
if(fail.length){ console.log(`❌ ไม่ผ่าน ${fail.length} ข้อ:`); fail.forEach(f=>console.log('   '+f)); process.exit(1); }
console.log('✅ ผ่านทุกข้อ');
