// ชุดตรวจป็อปอัป "ทำไมระดับถึงเปลี่ยน" (คลิก badge ระดับก่อนช่วย) — RISK_EXEC_MODEL.md 7.26
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const code=[...fs.readFileSync(SRC,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const mkEl=()=>({innerHTML:'',textContent:'',scrollTop:0,style:{},classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){}});
const els={};
// auto-สร้าง stub ต่อ id (เหมือน test_exec_columns) — โค้ด init ของหน้าเรียก getElementById หลายตัว
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),querySelectorAll:()=>[],addEventListener(){},
  documentElement:mkEl(),createElement:()=>mkEl(),body:{appendChild(e){if(e&&e.id)els[e.id]=e}}};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exWhyPop,exWhyClose,exSimPath,exSolveFor,exSepLab,exTopUp,exMoeLeft,fmtM,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXTJ:v=>{EXTJ=v},setEXBRK:v=>{EXBRK=v},getEXST:()=>EXST};`)();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=o=>Object.assign({mmo:2,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,
  moeVer:'69',payPct:50,moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true},o);
A.setEX(j); A.setEXST(ST({})); A.setEXTJ({debtors:new Set(),shares:{},refund:{},total:0,uncovered:0});
const txt=s=>s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};

console.log('━━ ① เปิดได้ทุกแห่ง ไม่มี undefined/NaN ━━');
let bad=0, noHtml=0;
for(const h of j.hosp){
  A.exWhyPop(h.hcode);
  const el=els['exWhyOverlay'];
  if(!el||!el.innerHTML){ noHtml++; continue; }
  if(/undefined|NaN/.test(el.innerHTML)) { bad++; if(bad<3) console.log('     '+h.name+': '+txt(el.innerHTML).slice(0,160)); }
}
chk(noHtml===0, `เปิดป็อปอัปได้ครบ ${j.hosp.length} แห่ง (ว่าง ${noHtml})`);
chk(bad===0, `ไม่มี undefined/NaN (ผิด ${bad})`);

console.log('\n━━ ② สถานะทั้งหน้าต้องไม่เพี้ยนหลังเปิดป็อปอัป ━━');
// ป็อปอัปสลับ EXST ชั่วคราวเพื่อจำลอง "ถ้าปิดปัจจัย" — ถ้าคืนค่าไม่ครบ ทั้งหน้าจะเพี้ยนตาม
const before=JSON.stringify(A.getEXST());
A.exWhyPop(j.hosp[0].hcode);
chk(JSON.stringify(A.getEXST())===before, 'EXST กลับมาเหมือนเดิมหลังเปิดป็อปอัป (ไม่ทิ้ง seas/clGrow ที่ปิดไว้ค้าง)');

console.log('\n━━ ③ สะพานคะแนนต้องตรงกับ exSimPath จริง ━━');
const h0=j.hosp.find(x=>x.risk>=5)||j.hosp[0];
A.exWhyPop(h0.hcode);
const html=els['exWhyOverlay'].innerHTML, t=txt(html);
const r0=A.exSimPath(h0,0);
console.log(`     ${h0.name}: งวดปัจจุบัน ${h0.risk} → ก่อนช่วย ${r0.sepRisk} ณ ${A.exSepLab()}`);
chk(t.includes('คะแนนงวด '), 'มีจุดตั้งต้น = คะแนนงวดปัจจุบัน');
chk(t.includes('ก่อนช่วย ณ '+A.exSepLab()), 'มีปลายทาง = ระดับ ณ เดือนเป้าตามตัวกรอง');
chk(t.includes('ปัจจัยที่ทำให้เปลี่ยนระหว่างทาง'), 'มีส่วนปัจจัยระหว่างทาง');
chk(t.includes('มาตรการที่เลือกอยู่'), 'มีส่วนมาตรการที่เลือก');
chk(t.includes('เติมเงินให้พอจ่าย MOE ถึง '+A.exSepLab()), 'มีส่วนเงินเติมให้พอ MOE ถึงเดือนเป้า');
chk(t.includes('ผลลัพธ์ ณ '+A.exSepLab()), 'มีส่วนผลลัพธ์ปลายทาง');
chk(/บวกกันตรง ๆ ไม่ได้/.test(t), 'เตือนว่าผลของแต่ละปัจจัยบวกกันตรง ๆ ไม่ได้');

console.log('\n━━ ④ Option ยกหนี้ต้องโผล่ในส่วนมาตรการ + มีระดับเทียบ ━━');
A.setEXST(ST({tj:{mode:'forgive',scope:'all'}}));
A.setEXTJ({debtors:new Set(j.hosp.map(x=>x.hcode)),shares:{},refund:{},total:0,uncovered:0});
const hf=j.hosp.find(x=>x.tj&&x.tj.payIn>0)||j.hosp[0];
A.exWhyPop(hf.hcode);
const t2=txt(els['exWhyOverlay'].innerHTML);
chk(t2.includes('ยกหนี้'), `ป็อปอัปบอกว่ากำลังเปิด Option ยกหนี้อยู่ (${hf.name})`);
chk(t2.includes('เทียบกับถ้าไม่ทำ Option นี้'), 'มีระดับเปรียบเทียบ "ถ้าไม่ทำ Option นี้"');
chk(!t2.includes('ยังไม่ได้เปิดมาตรการใด'), 'ไม่ขึ้นข้อความ "ยังไม่ได้เปิดมาตรการใด" ทั้งที่เปิดอยู่');

console.log('\n━━ ⑤ เปลี่ยนเดือนเป้าแล้วป็อปอัปต้องตามไปด้วย ━━');
A.setEXST(ST({mmo:6}));
A.exWhyPop(h0.hcode);
const t3=txt(els['exWhyOverlay'].innerHTML);
chk(t3.includes('ถึงเดือนเป้า '+A.exSepLab()), `หัวป็อปอัประบุเดือนเป้าใหม่ (${A.exSepLab()})`);
chk(t3.includes('เติมเงินให้พอจ่าย MOE ถึง '+A.exSepLab()), 'ส่วน MOE ใช้เดือนเป้าเดียวกัน');

console.log('\n━━ ⑥ badge "ก่อนช่วย" ต้องคลิกได้จริงในตาราง ━━');
const raw=fs.readFileSync(SRC,'utf8');
chk(/onclick="exWhyPop\('\$\{hc\}'\)"/.test(raw), 'badge ระดับก่อนช่วยผูก onclick=exWhyPop');
chk(/exWhyPop[\s\S]{0,80}riskColor\(r0\.sepRisk\)|riskColor\(r0\.sepRisk\)[\s\S]{0,200}exWhyPop/.test(raw),
    'ผูกที่ badge ของ r0.sepRisk (ก่อนช่วย) ไม่ใช่ badge อื่น');
chk(/onclick="exBrkToggle/.test(raw), 'badge "หลังช่วย" ยังเป็น exBrkToggle เหมือนเดิม (ไม่ทับกัน)');

console.log('\n━━ สรุป ━━');
if(fail.length){ console.log(`❌ ไม่ผ่าน ${fail.length} ข้อ`); fail.forEach(f=>console.log('   '+f)); process.exit(1); }
console.log('✅ ผ่านทุกข้อ');
