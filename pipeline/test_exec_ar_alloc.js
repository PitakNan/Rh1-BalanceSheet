// ตรวจการเกลี่ย "ลูกหนี้ที่คาดว่าจะเก็บได้" แบบใหม่ 3 ชั้น (เจ้าของงานเคาะ 7 ส.ค. 69)
// ① ทั้งเขต = ลูกหนี้ดิบทั้งเขต × %  ② จังหวัด = ตามสัดส่วนเจ้าหนี้ (เพดาน = ลูกหนี้ดิบจังหวัด)
// ③ ราย รพ. = ตามสัดส่วนลูกหนี้ดิบในจังหวัด
// 🪤 ของเดิมตัด % เท่ากันทุกแห่ง → จังหวัดที่ลูกหนี้สูงกว่าเจ้าหนี้ยังมีเงินไหลเข้าเกิน (ผิดเจตนา)
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
const A=new Function(code+`;return {exRender,exArIn,exArRaw,exArCut,exArPct,exArPctEff,exPayIn,exArAlloc,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
const j=JSON.parse(fs.readFileSync(process.env.RD_JSON||'D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=o=>({mmo:3,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,moeVer:'69',payPct:50,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},tj:{mode:'off',scope:'crisis'},
  inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true,...o});
let fail=[];
const chk=(ok,msg)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}`); if(!ok) fail.push(msg); };
const M=v=>(v/1e6).toFixed(1)+'M';
const near=(a,b,tol)=>Math.abs(a-b)<=(tol==null?1000:tol);
A.setEX(j); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
const use=st=>A.setEXST(ST(st));

// ข้อมูลอ้างอิงคำนวณเองแบบอิสระจาก exec.json
const RAW={}; j.hosp.forEach(h=>{ const p=RAW[h.prov]||(RAW[h.prov]={pay:0,ar:0,hs:[]});
  p.pay+=(h.tj&&h.tj.payIn)||0; p.ar+=(h.tj&&h.tj.arIn)||0; p.hs.push(h); });
const provs=Object.keys(RAW).sort((a,b)=>a.localeCompare(b,'th'));
const PAY=provs.reduce((s,p)=>s+RAW[p].pay,0), AR=provs.reduce((s,p)=>s+RAW[p].ar,0);
console.log(`ไฟล์: ${SRC}\nทั้งเขต: เจ้าหนี้ ${M(PAY)} · ลูกหนี้ดิบ ${M(AR)}\n`);
const sumProv=p=>RAW[p].hs.reduce((s,h)=>s+A.exArIn(h),0);

// ══ ① สุทธิรายจังหวัด ≈ 0 ที่ทุกค่า % (ยกเว้นจังหวัดที่ลูกหนี้ดิบไม่พอ = ติดเพดาน) ══
console.log('━━ ① สุทธิรายจังหวัดต้องไม่เป็นบวก (ไม่มีเงินไหลเข้าเกินเจ้าหนี้) ━━');
for(const pct of [100,62,40]){
  use({arPct:pct});
  const keepAll=AR*pct/100, base=Math.min(keepAll,PAY);
  let over=[], capped=[];
  // สูตรอ้างอิง (คำนวณอิสระ): ชั้น1 ตามสัดส่วนเจ้าหนี้ (เพดาน=ลูกหนี้ดิบ) + ชั้น2 ส่วนเกินตามลูกหนี้ที่เหลือ
  const q={}; let alloc=0;
  provs.forEach(p=>{ q[p]=Math.min(RAW[p].ar, base*(RAW[p].pay/PAY)); alloc+=q[p]; });
  if(keepAll>PAY){   // ชั้น 2 มีเฉพาะ "เหนือจุดสมดุล" เท่านั้น — เศษจากจังหวัดที่ติดเพดานต้องตกไป ไม่เกลี่ยต่อ
    const room={}; let roomAll=0;
    provs.forEach(p=>{ room[p]=Math.max(0,RAW[p].ar-q[p]); roomAll+=room[p]; });
    if(roomAll>0){ const ex=Math.min(keepAll-alloc,roomAll); provs.forEach(p=>{ q[p]+=ex*room[p]/roomAll; }); }
  }
  provs.forEach(p=>{
    const got=sumProv(p), quota=q[p];
    if(!near(got,quota)) over.push(`${p} ได้ ${M(got)} ควรเป็น ${M(quota)}`);
    if(RAW[p].ar < base*(RAW[p].pay/PAY)-1) capped.push(p);
  });
  chk(over.length===0, `arPct=${pct}: โควตาทุกจังหวัดตรงสูตร ② ${over.join(' · ')||''}`);
  // ⚠️ "ไม่มีจังหวัดไหนลูกหนี้เกินเจ้าหนี้" เป็นจริงเฉพาะเมื่อยอดรวมที่เก็บได้ ≤ เจ้าหนี้รวม
  //    คือ pct ≤ PAY/AR (~62%) · ถ้าตั้งสูงกว่านั้น ลูกหนี้ดิบทั้งเขตมันเกินเจ้าหนี้อยู่แล้วจริง ๆ
  //    ทุกจังหวัดจึงเกินตามสัดส่วนเท่า ๆ กัน — เป็นพฤติกรรมที่ถูก ไม่ใช่บั๊ก
  if(pct*AR/100 <= PAY){
    const bad=provs.filter(p=>sumProv(p)-RAW[p].pay>1000);
    chk(bad.length===0, `arPct=${pct} (≤ จุดสมดุล): ไม่มีจังหวัดที่ลูกหนี้เกินเจ้าหนี้ — ${bad.join(',')||'ไม่มี'} · ติดเพดาน ${capped.length} จังหวัด (${capped.join(',')||'ไม่มี'})`);
  } else {
    // เหนือจุดสมดุล อัตราส่วนไม่เท่ากันแล้ว (ชั้น 2 เกลี่ยตามลูกหนี้ที่เหลือ ไม่ใช่ตามเจ้าหนี้) — ถูกต้อง
    // เพราะเงินส่วนเกินเจ้าหนี้จะไปได้เฉพาะที่ยังมีลูกหนี้เหลืออยู่จริงเท่านั้น
    const tot=provs.reduce((s,p)=>s+sumProv(p),0);
    chk(near(tot, Math.min(keepAll,AR), 2000),
      `arPct=${pct} (> จุดสมดุล): ยอดรวมได้ครบตามเป้า ${M(Math.min(keepAll,AR))} (ได้ ${M(tot)})`);
  }
}
// จุดสมดุล = % ที่ทำให้ยอดรวมลูกหนี้ที่เก็บได้ = เจ้าหนี้รวมพอดี (ตัวเลขที่เจ้าของงานเดาไว้ว่า ~62%)
const bal=PAY/AR*100;
console.log(`     ℹ️ จุดสมดุลพอดี = ${bal.toFixed(2)}% (ยอดเก็บได้ = เจ้าหนี้รวม ${M(PAY)} เป๊ะ)`);
chk(bal>55&&bal<70, `จุดสมดุลอยู่ที่ ${bal.toFixed(2)}% — ตรงกับที่เจ้าของงานประเมินไว้ราว 62%`);
// ⭐ ข้อสำคัญที่สุด: 100% ต้องคืน "ยอดดิบเป๊ะทุกแห่ง" ไม่งั้นค่าเริ่มต้นของทุกคนเปลี่ยนไปเงียบ ๆ
// (เจอตอนตรวจ 7 ส.ค. 69 — สูตรชั้นเดียวทำให้เชียงใหม่เหลือ 169M จากยอดจริง 200.7M)
console.log('\n━━ ①′ ⭐ arPct=100 ต้องคืนยอดดิบเป๊ะ (ค่าเริ่มต้นห้ามเปลี่ยน) ━━');
use({arPct:100});
const diff=j.hosp.filter(h=>!near(A.exArIn(h), A.exArRaw(h), 1));
chk(diff.length===0, `ทุก รพ. ${j.hosp.length} แห่งได้ยอดดิบเต็มที่ 100% (ต่าง ${diff.length} แห่ง${diff.length?': '+diff.slice(0,3).map(h=>h.name+' '+M(A.exArIn(h))+' vs ดิบ '+M(A.exArRaw(h))).join(' · '):''})`);
const tot100=j.hosp.reduce((s,h)=>s+A.exArIn(h),0);
chk(near(tot100,AR,1), `ยอดรวมที่ 100% = ลูกหนี้ดิบทั้งเขต ${M(AR)} (ได้ ${M(tot100)})`);
provs.forEach(p=>{ if(!near(sumProv(p),RAW[p].ar,1)) fail.push('จังหวัด '+p+' ที่ 100% ไม่เท่ายอดดิบ'); });

// ══ ② อัตราส่วน ลูกหนี้:เจ้าหนี้ เท่ากันทุกจังหวัด (ยกเว้นที่ติดเพดาน) ══
console.log('\n━━ ② อัตราส่วน ลูกหนี้ ÷ เจ้าหนี้ เท่ากันทุกจังหวัด ━━');
use({arPct:62});
const keep62=AR*0.62;
const ratios=provs.map(p=>({p, r:RAW[p].pay>0?sumProv(p)/RAW[p].pay:null,
  cap:RAW[p].ar < keep62*(RAW[p].pay/PAY)-1}));
ratios.forEach(x=>console.log(`     ${x.p.padEnd(11)} ลูกหนี้ ${M(sumProv(x.p)).padStart(7)} ÷ เจ้าหนี้ ${M(RAW[x.p].pay).padStart(7)} = ${x.r==null?'—':x.r.toFixed(3)}${x.cap?'  (ติดเพดาน)':''}`));
const free=ratios.filter(x=>!x.cap&&x.r!=null).map(x=>x.r);
const spread=Math.max(...free)-Math.min(...free);
chk(spread<0.001, `จังหวัดที่ไม่ติดเพดานได้อัตราส่วนเท่ากันหมด (ต่างกัน ${spread.toFixed(5)})`);
chk(ratios.some(x=>x.cap), 'มีอย่างน้อย 1 จังหวัดติดเพดาน (พิสูจน์ว่าเพดานทำงานจริง)');

// ══ ③ ราย รพ. แบ่งตามสัดส่วนลูกหนี้ดิบในจังหวัด ══
console.log('\n━━ ③ แบ่งต่อให้ รพ. ตามสัดส่วนลูกหนี้ดิบในจังหวัด ━━');
let badH=0;
provs.forEach(p=>{ const q=sumProv(p);
  RAW[p].hs.forEach(h=>{ const want=RAW[p].ar>0?q*((h.tj&&h.tj.arIn)||0)/RAW[p].ar:0;
    if(!near(A.exArIn(h),want,1)) badH++; }); });
chk(badH===0, `ทุก รพ. ทั้ง ${j.hosp.length} แห่งได้ส่วนแบ่งตรงสูตร ③ (ผิด ${badH})`);
// รพ. ที่ไม่มีลูกหนี้ดิบต้องได้ 0 ไม่ใช่ NaN
const zero=j.hosp.filter(h=>!((h.tj&&h.tj.arIn)>0));
chk(zero.every(h=>A.exArIn(h)===0), `รพ. ที่ไม่มีลูกหนี้ดิบ ${zero.length} แห่งได้ 0 (ไม่ใช่ NaN)`);
chk(j.hosp.every(h=>isFinite(A.exArIn(h))&&A.exArIn(h)>=0), 'ไม่มีค่า NaN / ติดลบ');
// ห้ามเกินลูกหนี้ดิบของตัวเอง
const overRaw=j.hosp.filter(h=>A.exArIn(h)-A.exArRaw(h)>1);
chk(overRaw.length===0, `ไม่มี รพ. ที่ได้เกินลูกหนี้ดิบของตัวเอง (${overRaw.length})`);

// ══ ④ ไม่ผูกกับตัวกรอง — กรองจังหวัดแล้วยอดของ รพ. เดิมต้องไม่ขยับ ══
console.log('\n━━ ④ ยอดต้องนิ่ง ไม่ขึ้นกับตัวกรอง ━━');
const h0=j.hosp.find(h=>(h.tj&&h.tj.arIn)>1e6);
use({arPct:62}); const v_all=A.exArIn(h0);
use({arPct:62, prov:h0.prov}); const v_prov=A.exArIn(h0);
use({arPct:62, types:{'รพช.':true}}); const v_type=A.exArIn(h0);
chk(near(v_all,v_prov,1)&&near(v_all,v_type,1),
  `${h0.name}: กรองจังหวัด/ประเภทแล้วยอดเท่าเดิม ${M(v_all)} (${M(v_prov)} · ${M(v_type)})`);

// ══ ⑤ ✎ กำหนดเองรายแห่ง — ชนะการเกลี่ย และไม่ขยับยอดของแห่งอื่น ══
console.log('\n━━ ⑤ ✎ กำหนดเองรายแห่ง ━━');
use({arPct:62});
const others=j.hosp.filter(h=>h.hcode!==h0.hcode).map(h=>[h.hcode,A.exArIn(h)]);
use({arPct:62, arOvr:{[h0.hcode]:0}});
chk(A.exArIn(h0)===0, `ตั้ง ${h0.name} = 0 แล้วได้ 0 จริง (ชนะการเกลี่ย)`);
const moved=others.filter(([hc,v])=>!near(A.exArIn(j.hosp.find(x=>x.hcode===hc)),v,1));
chk(moved.length===0, `แก้แห่งเดียวไม่ไปขยับยอดของแห่งอื่น (ขยับ ${moved.length} แห่ง)`);
// override ต้องถูกตัดเพดานที่ลูกหนี้ดิบ
use({arPct:62, arOvr:{[h0.hcode]:9e12}});
chk(A.exArIn(h0)===A.exArRaw(h0), 'กรอกเกินลูกหนี้ดิบ → ถูกตัดเหลือเท่ายอดดิบ');

// ══ ⑥ % ที่แต่ละแห่งโดนตัดจริงต่างกัน + UI ต้องโชว์ % รายแห่ง ไม่ใช่ % รวม ══
console.log('\n━━ ⑥ % รายแห่ง (exArPctEff) ━━');
use({arPct:62});
const effs=[...new Set(j.hosp.filter(h=>A.exArRaw(h)>0).map(h=>A.exArPctEff(h).toFixed(1)))];
chk(effs.length>1, `% ที่โดนตัดจริงต่างกันตามจังหวัด (${effs.length} ค่า: ${effs.slice(0,8).join(', ')}${effs.length>8?' …':''})`);
const src=fs.readFileSync(SRC,'utf8');
chk(/ตัดออก \$\{fmtM\(cut\)\}[^`]*exArPctEff\(h\)/.test(src),
  'เซลล์ลูกหนี้ในตารางหลักใช้ exArPctEff(h) (ถ้าใช้ exArPct() จะขัดกับตัวเลขในเซลล์เดียวกัน)');

// ══ ⑦ เรนเดอร์แล้วไม่พัง ══
console.log('\n━━ ⑦ เรนเดอร์จริง ━━');
for(const pct of [100,62,0]){
  use({arPct:pct}); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1}); A.exRender();
  const h=Object.values(els).map(e=>typeof e.innerHTML==='string'?e.innerHTML:'').join('');
  chk(h.length>1000 && !/undefined|NaN/.test(h), `arPct=${pct}: เรนเดอร์ได้ ไม่มี undefined/NaN`);
}

console.log(`\n${fail.length?'❌ ไม่ผ่าน '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ ผ่านทั้งหมด'}`);
process.exit(fail.length?1:0);
