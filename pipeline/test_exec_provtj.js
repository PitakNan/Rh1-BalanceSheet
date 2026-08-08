// ตรวจตาราง "🗺️ สรุปรายจังหวัด: หนี้ที่ต้องจ่าย ↔ ลูกหนี้ที่คาดว่าจะเก็บได้" (#exProvTjBox)
// + ตอบคำถามเจ้าของงาน: คอลัมน์ "เจ้าหนี้ UC-OP นอก CUP" ผูกกับ Option ตามจ่ายหรือไม่
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
const A=new Function(code+`;return {exRender,exPayIn,exArIn,exArRaw,exArPct,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=o=>({mmo:3,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,
  moeVer:'69',payPct:50,moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true,...o});
const txt=s=>s.replace(/<[^>]+>/g,'|').replace(/\|+/g,'|');
let fail=[];
const chk=(ok,msg)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}`); if(!ok) fail.push(msg); };
const M=v=>{const a=Math.abs(v);if(a>=1e9)return(v/1e9).toFixed(2)+'B';if(a>=1e6)return(v/1e6).toFixed(1)+'M';if(a>=1e3)return(v/1e3).toFixed(0)+'K';return Math.round(v).toLocaleString()};

A.setEX(j); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
const render=st=>{ A.setEXST(ST(st)); A.exRender(); return els['exProvTjBox'].innerHTML; };

console.log(`ไฟล์: ${SRC}\nงวด: ${j.periodLabel} · รพ. ${j.hosp.length} แห่ง\n`);

// ══ 1) ยอดรวมรายจังหวัดตรงกับการคำนวณอิสระจาก exec.json ══
console.log('━━ ① ยอดรวมรายจังหวัด (เทียบการคำนวณอิสระจาก exec.json) ━━');
let html=render({});
const want={};
j.hosp.forEach(h=>{ const p=want[h.prov]||(want[h.prov]={n:0,pay:0,ar:0});
  p.n++; p.pay+=(h.tj&&h.tj.payIn)||0; p.ar+=(h.tj&&h.tj.arIn)||0; });
const provs=Object.keys(want).sort((a,b)=>a.localeCompare(b,'th'));
// ดึงแถวออกจาก HTML: <td>จังหวัด</td><td>n</td><td>pay</td><td>ar</td><td>เงินช่วยในจังหวัด</td><td>ส่วนขาด(MOE)</td>
// (คอลัมน์ "สุทธิ ลูกหนี้−หนี้" ถูกถอดออก 8 ส.ค. 69 ตามที่เจ้าของงานสั่ง — แทนด้วยสองคอลัมน์ท้าย)
const rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>
  [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c=>c[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()));
const dataRows=rows.filter(r=>r.length===6 && provs.includes(r[0]));
chk(dataRows.length===provs.length, `มีครบทุกจังหวัด ${dataRows.length}/${provs.length}`);
let bad=0;
dataRows.forEach(r=>{
  const w=want[r[0]];
  const okN=r[1]===String(w.n), okPay=r[2].startsWith(M(w.pay)), okAr=r[3].startsWith(M(w.ar));
  if(!(okN&&okPay&&okAr)) bad++;
  console.log(`  ${okN&&okPay&&okAr?'✅':'❌'} ${r[0].padEnd(10)} รพ.${r[1].padStart(3)} · หนี้ ${r[2].padEnd(24)} · ลูกหนี้ ${r[3].padEnd(30)} · ช่วยในจังหวัด ${r[4].padEnd(34)} · ส่วนขาด ${r[5]}`);
  if(!okN) console.log(`      ↳ n ควรเป็น ${w.n}`);
  if(!okPay) console.log(`      ↳ หนี้ ควรเป็น ${M(w.pay)}`);
  if(!okAr) console.log(`      ↳ ลูกหนี้ ควรเป็น ${M(w.ar)}`);
});
chk(bad===0, `ยอดทุกจังหวัดตรง (ผิด ${bad})`);
const T={n:0,pay:0,ar:0}; provs.forEach(p=>{T.n+=want[p].n;T.pay+=want[p].pay;T.ar+=want[p].ar;});
const totRow=rows.find(r=>r.length===6 && r[0].includes('รวมทั้งเขต'));
chk(!!totRow, 'มีแถวรวมทั้งเขต');
if(totRow){
  chk(totRow[1]===String(T.n), `แถวรวม: จำนวน รพ. = ${T.n}`);
  chk(totRow[2].startsWith(M(T.pay)), `แถวรวม: หนี้ที่ต้องจ่าย = ${M(T.pay)} (ได้ ${totRow[2]})`);
  chk(totRow[3].startsWith(M(T.ar)), `แถวรวม: ลูกหนี้คาดเก็บได้ = ${M(T.ar)} (ได้ ${totRow[3]})`);
}

// ══ 2) ยุบเป็นค่าเริ่มต้น ══
console.log('\n━━ ② สถานะยุบ/ขยาย ━━');
chk(/<details (?!open)/.test(html) && !/<details open/.test(html), 'ค่าเริ่มต้น = ยุบ (ไม่มี attribute open)');
chk(/ontoggle="exKeepOpen\('provtj'/.test(html), 'จำสถานะยุบ/กางลง localStorage ผ่าน exKeepOpen(provtj)');
const openHtml=render({open:{provtj:true}});
chk(/<details open/.test(openHtml), 'เปิดค้างไว้ได้เมื่อ EXST.open.provtj = true');

// ══ 3) ⭐ คำถามเจ้าของงาน: คอลัมน์เจ้าหนี้ผูกกับ Option ตามจ่ายหรือไม่ ══
console.log('\n━━ ③ คอลัมน์ "เจ้าหนี้ UC-OP นอก CUP" เทียบทุกโหมดของ Option ตามจ่าย ━━');
const payByMode={};
for(const mode of ['off','pay','forgive','smart']){
  const h2=render({tj:{mode,scope:'all'}});
  const tr=[...h2.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>
    [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()));
  const tot=tr.find(r=>r.length===6 && r[0].includes('รวมทั้งเขต'));
  payByMode[mode]=tot?tot[2]:'(ไม่พบ)';
  console.log(`  Option = ${mode.padEnd(8)} → หนี้ที่ต้องจ่ายรวม ${payByMode[mode]}`);
}
const uniq=[...new Set(Object.values(payByMode))];
chk(uniq.length===1, `ยอดเจ้าหนี้เท่ากันทุกโหมด = เป็นยอดดิบ ไม่ผูกกับ Option (พบ ${uniq.length} ค่า)`);

// ══ 4) ลูกหนี้ต้องขยับตาม % ที่คาดว่าเก็บได้ ══
console.log('\n━━ ④ ลูกหนี้ตอบสนอง % ที่คาดว่าเก็บได้ (arPct) ━━');
const h50=render({arPct:50});
const tr50=[...h50.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>
  [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()));
const tot50=tr50.find(r=>r.length===6 && r[0].includes('รวมทั้งเขต'));
chk(!!tot50 && tot50[3].startsWith(M(T.ar*0.5)), `arPct=50: คอลัมน์ "คาดว่าเก็บได้" = ${M(T.ar*0.5)} (ได้ ${tot50&&tot50[3]})`);
chk(!!tot50 && tot50[3].includes('เต็ม '+M(T.ar)) && tot50[3].includes('ตัดออก '+M(T.ar-T.ar*0.5)),
  `arPct=50: บรรทัดเล็กบอกยอดเต็ม ${M(T.ar)} + ตัดออก ${M(T.ar*0.5)} (ได้ "${tot50&&tot50[3]}")`);
// arPct=100 (ค่าเริ่มต้น) ต้องไม่มีบรรทัด "เต็ม/ตัดออก" โผล่มารก
// ⚠️ ต้องตรวจเฉพาะ "ในเซลล์ตาราง" ไม่ใช่ทั้ง html — คำอธิบายใต้ตารางมีคำว่า "ตัดออก" อยู่ด้วยเสมอ
const cells100=[...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]);
chk(!cells100.some(c=>/เต็ม |ตัดออก /.test(c)), 'arPct=100: ไม่มีบรรทัด "เต็ม/ตัดออก" ในเซลล์ (ไม่มีอะไรถูกตัด)');
chk(!!tot50 && tot50[2].startsWith(M(T.pay)), `arPct=50: หนี้ที่ต้องจ่ายไม่เปลี่ยน ${M(T.pay)}`);

// ══ 4′) 🔗 ผูกกับตัวควบคุม "📥 ลูกหนี้ที่เก็บได้: __%" ของตารางหลัก (เจ้าของงานถาม 7 ส.ค. 69) ══
// ต้อง "เห็นได้" ด้วย ไม่ใช่แค่ตัวเลขถูก — ป้าย % ต้องขึ้นทั้งหัวคอลัมน์ + บรรทัดสรุปตอนยุบ + คำอธิบาย
console.log('\n━━ ④′ ป้ายเชื่อมโยงกับตัวควบคุม 📥 ลูกหนี้ที่เก็บได้ ━━');
const grab=h=>{ const tr=[...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>
    [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()));
  return tr.find(r=>r.length===6 && r[0].includes('รวมทั้งเขต')); };
// ค่าจริงที่เจ้าของงานใช้อยู่ = 62%
const h62=render({arPct:62});
// ⚠️ ตั้งแต่ 7 ส.ค. 69 ยอดรวมที่ 62% **ไม่เท่ากับ** ลูกหนี้ดิบ×62% อีกแล้ว
// เพราะเปลี่ยนเป็นเกลี่ยตามสัดส่วนเจ้าหนี้รายจังหวัด แล้วจังหวัดที่ลูกหนี้ดิบไม่พอจะติดเพดาน
// (แพร่) และเศษที่ล้นไม่ถูกเกลี่ยต่อโดยตั้งใจ → ยอดรวมต่ำกว่าเป้าเล็กน้อย
// รายละเอียดสูตรอยู่ใน test_exec_ar_alloc.js · ที่นี่คำนวณอ้างอิงซ้ำเพื่อกันตัวเลขหลุด
const PAYALL=Object.values(want).reduce((s,p)=>s+p.pay,0);
const keep62=T.ar*0.62;
const want62=Object.keys(want).reduce((s,pv)=>s+Math.min(want[pv].ar, keep62*(want[pv].pay/PAYALL)),0);
chk(grab(h62)[3].startsWith(M(want62)), `arPct=62: ยอดรวมตามสูตรเกลี่ยใหม่ = ${M(want62)} (ได้ ${grab(h62)[3]}) · ต่ำกว่าเป้า ${M(keep62)} เพราะมีจังหวัดติดเพดาน`);
chk(/📥 62%/.test(h62), 'arPct=62: หัวคอลัมน์ติดป้าย "📥 62%"');
chk(/@ 62%/.test(h62), 'arPct=62: บรรทัดสรุปตอนยุบติดป้าย "@ 62%"');
chk(/ผูกกับตัวควบคุม 📥 ลูกหนี้ที่เก็บได้: 62%/.test(h62), 'arPct=62: คำอธิบายบอกว่าผูกกับตัวควบคุมตัวไหน');
chk(!/📥 100%|@ 100%/.test(html), 'arPct=100: ไม่ติดป้าย % (ไม่มีการปรับ = ไม่ต้องรก)');
// ✎ กำหนดเองรายแห่ง ต้องไหลเข้าตารางสรุปด้วย และนับจำนวนแห่งให้ถูก
const h0=j.hosp.find(x=>x.tj&&x.tj.arIn>1e6);
const hOvr=render({arPct:100, arOvr:{[h0.hcode]:0}});
const wantOvr=T.ar-h0.tj.arIn;
chk(grab(hOvr)[3].startsWith(M(wantOvr)), `✎ ตั้ง ${h0.name} = 0: ยอดรวมลดเหลือ ${M(wantOvr)} (ได้ ${grab(hOvr)[3]})`);
chk(/แก้เอง 1 แห่ง/.test(hOvr), '✎: ติดป้าย "แก้เอง 1 แห่ง"');
// override ของ รพ. นอกตัวกรอง ต้องไม่ถูกนับเป็น "แก้เอง" ในมุมมองที่กรองอยู่
const otherProv=provs.find(p=>p!==h0.prov);
const hOvrF=render({arPct:100, arOvr:{[h0.hcode]:0}, prov:otherProv});
chk(!/แก้เอง/.test(hOvrF), `✎: กรอง "${otherProv}" แล้วไม่นับ override ของ ${h0.prov} (นับเฉพาะ รพ. ที่แสดงอยู่)`);
// 🪤 คำเตือนท้ายตารางต้องใช้ยอด "ดิบ" ทั้งเขต และผันคำ มากกว่า/น้อยกว่า ตามเครื่องหมาย
// (เคยเขียนตายตัวว่า "มากกว่า" — พอตั้ง 62% ลูกหนี้ต่ำกว่าเจ้าหนี้ ประโยคกลับด้าน + โชว์เลขติดลบ)
const payAll=j.hosp.reduce((s,p)=>s+((p.tj&&p.tj.payIn)||0),0);
for(const pc of [100,62,0]){
  const hh=render({arPct:pc});
  const okRaw=hh.includes(`ฝั่งลูกหนี้ (${M(T.ar)})`) && hh.includes(`ฝั่งเจ้าหนี้ (${M(payAll)})`);
  const noNeg=!/อยู่ -/.test(hh) && !/อยู่ −[0-9]/.test(hh.replace(/ −/g,' -'));
  chk(okRaw && noNeg && hh.includes('มากกว่า'),
    `arPct=${pc}: คำเตือนท้ายตารางใช้ยอดดิบ ${M(T.ar)} vs ${M(payAll)} + คำถูกด้าน + ไม่มีเลขติดลบ`);
}

// ══ 5) ตัวกรองจังหวัด: ต้องเหลือจังหวัดเดียวและตรงกับตารางล่าง ══
console.log('\n━━ ⑤ ตามตัวกรองจังหวัด ━━');
const pv=provs[0];
const hp=render({prov:pv});
const trp=[...hp.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>
  [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()));
const dp=trp.filter(r=>r.length===6 && !r[0].includes('รวมทั้งเขต'));
chk(dp.length===1 && dp[0][0]===pv, `กรอง "${pv}" แล้วเหลือ 1 จังหวัด (ได้ ${dp.length}: ${dp.map(r=>r[0]).join(',')})`);
chk(dp.length===1 && dp[0][1]===String(want[pv].n), `จำนวน รพ. = ${want[pv].n}`);

// ══ 6) 🎨 สีสองคอลัมน์ท้าย + ต้อง "ขึ้นจริง" บนเบราว์เซอร์ ══
// 🪤 บั๊กที่เจอ 7 ส.ค. 69: เขียน <td style="text-align:right"${netCls}> โดย netCls คืน ` style="…"`
//    → ได้ <td> ที่มี attribute style สองอัน · HTML spec ให้ใช้อันแรก **ทิ้งอันที่สอง** สีเลยหายเงียบ ๆ
//    ชุดตรวจนี้จึงต้องดู "แท็กดิบ" ไม่ใช่แค่ว่ามีคำว่า var(--green) อยู่ในหน้า
console.log('\n━━ ⑥ สีคอลัมน์เงินช่วย (เขียว) · ส่วนขาด (แดง) ━━');
// cells(i) = เซลล์คอลัมน์ที่ i ของทุกแถวข้อมูล (0-based) พร้อม "แท็กดิบ" ไว้ตรวจ style
const colCells=(h,i)=>[...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>{
    const tds=[...m[1].matchAll(/(<td[^>]*>)([\s\S]*?)<\/td>/g)];
    if(tds.length!==6) return null;
    return {prov:tds[0][2].replace(/<[^>]+>/g,'').trim(), tag:tds[i][1], val:tds[i][2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()};
  }).filter(Boolean);
// ห้ามมี attribute ซ้ำในแท็กเดียว (ตัวบั๊กจริง) — ตรวจทุกแท็กในกล่องนี้ ทุกโหมด
const DUP=/<[a-zA-Z]+\b[^>]*?\sstyle\s*=\s*"[^"]*"[^>]*?\sstyle\s*=/;
let dup=0;
for(const st of [{},{arPct:62},{arPct:0},{tj:{mode:'forgive',scope:'all'}},{prov:provs[0]}]) if(DUP.test(render(st))) dup++;
chk(dup===0, `ไม่มีแท็กที่มี attribute style ซ้ำสองอัน (สีจะถูกทิ้งเงียบ ๆ) — พบ ${dup}/5 โหมด`);
for(const pc of [100,62,0]){
  const hh=render({arPct:pc});
  // เงินช่วย: มียอด → เขียว · ไม่มี (–) → ไม่ทาสี ｜ ส่วนขาด: มียอด → แดง · ไม่มี → ไม่ทาสี
  const capW=colCells(hh,4).filter(c=>/var\(--green\)/.test(c.tag)!==!c.val.startsWith('–'));
  const shW=colCells(hh,5).filter(c=>/var\(--red\)/.test(c.tag)===c.val.startsWith('–'));
  chk(capW.length===0, `arPct=${pc}: คอลัมน์เงินช่วย ทาเขียวเฉพาะแถวที่มียอด (ผิด ${capW.length})`);
  chk(shW.length===0, `arPct=${pc}: คอลัมน์ส่วนขาด ทาแดงเฉพาะแถวที่มียอด (ผิด ${shW.length})`);
}

// ══ 7) ⭐ คอลัมน์ใหม่ "เงินช่วยภายในจังหวัด" + "ส่วนขาดสภาพคล่อง(MOE)" (8 ส.ค. 69) ══
console.log('\n━━ ⑦ เงินช่วยภายในจังหวัด ↔ ส่วนขาดสภาพคล่อง(MOE) ━━');
const A2=new Function(code+`;return {exRender,exMoeLeft,exTopUp,exXferCap,exSimPath,exXferList,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
A2.setEX(j); A2.setEXOPEN({}); A2.setEXBRK({}); A2.setEXSORT({col:null,dir:-1});
// คำนวณอิสระ: ผู้ให้ = moeLeft>0 (เพดาน exXferCap) · ผู้ขาด = exTopUp
A2.setEXST(ST({})); A2.exRender();
const ind={};
j.hosp.forEach(h=>{ const x={h,r0:A2.exSimPath(h,0)}; const p=ind[h.prov]||(ind[h.prov]={cap:0,nCap:0,short:0,nShort:0});
  const L=A2.exMoeLeft(x);
  if(L>0){ const c=A2.exXferCap(h); if(c>0){ p.cap+=c; p.nCap++; } }
  else { const u=A2.exTopUp(x); if(u>0){ p.short+=u; p.nShort++; } } });
const IT={cap:0,nCap:0,short:0,nShort:0}; Object.values(ind).forEach(p=>{for(const k in IT) IT[k]+=p[k];});
const h7=render({});
const rows7=[...h7.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>
  [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()));
let bad7=0;
provs.forEach(p=>{ const r=rows7.find(z=>z.length===6&&z[0]===p), w=ind[p]||{cap:0,nCap:0,short:0,nShort:0};
  const okCap=w.cap>0 ? r[4].startsWith(M(w.cap)) : r[4].startsWith('–');
  const okSh =w.short>0 ? r[5].startsWith(M(w.short)) : r[5].startsWith('–');
  const okN  =r[4].includes(`${w.nCap} แห่ง`) && r[5].includes(`${w.nShort} แห่ง`);
  if(!(okCap&&okSh&&okN)) bad7++;
  console.log(`  ${okCap&&okSh&&okN?'✅':'❌'} ${p.padEnd(10)} ช่วยได้ ${M(w.cap).padStart(7)} (${String(w.nCap).padStart(2)} แห่ง) · ขาด ${M(w.short).padStart(7)} (${String(w.nShort).padStart(2)} แห่ง)${okCap&&okSh&&okN?'':`  ↳ ได้ "${r[4]}" / "${r[5]}"`}`);
});
chk(bad7===0, `ยอดเงินช่วย+ส่วนขาด+จำนวนแห่ง ตรงทุกจังหวัด (ผิด ${bad7})`);
const tot7=rows7.find(r=>r.length===6&&r[0].includes('รวมทั้งเขต'));
chk(tot7[4].startsWith(M(IT.cap)) && tot7[4].includes(`${IT.nCap} แห่ง`), `แถวรวม: เงินช่วย = ${M(IT.cap)} (${IT.nCap} แห่ง) · ได้ "${tot7[4]}"`);
chk(tot7[5].startsWith(M(IT.short)) && tot7[5].includes(`${IT.nShort} แห่ง`), `แถวรวม: ส่วนขาด = ${M(IT.short)} (${IT.nShort} แห่ง) · ได้ "${tot7[5]}"`);
// ผู้ให้กับผู้ขาดต้องไม่ทับกัน (มาจาก exMoeLeft ตัวเดียวกัน ฝั่งบวก/ลบ)
chk(IT.nCap+IT.nShort<=j.hosp.length, `ผู้ให้ ${IT.nCap} + ผู้ขาด ${IT.nShort} ≤ ${j.hosp.length} แห่ง (ไม่นับซ้ำ)`);
// ป้ายพอ/ไม่พอ ต้องตรงกับการเทียบจริงทุกจังหวัด
let badSuf=0;
provs.forEach(p=>{ const r=rows7.find(z=>z.length===6&&z[0]===p), w=ind[p]||{cap:0,short:0};
  const want=!(w.short>0)?'✅ ไม่มีแห่งที่ขาด':(w.cap>=w.short?'✅ พอช่วยกันเอง':'⛔ ไม่พอ ขาดต้นทาง');
  if(!r[4].includes(want)) { badSuf++; console.log(`  ❌ ${p}: ควรขึ้น "${want}" แต่ได้ "${r[4]}"`); } });
chk(badSuf===0, `ป้าย พอ/ไม่พอ ตรงกับการเทียบ cap≥short ทุกจังหวัด (ผิด ${badSuf})`);
// เพดานผู้ให้ต้องคุมระดับไม่เกิน 5 จริง — ยกให้เต็มเพดานแล้ว sepRisk ต้อง ≤ 5
const givers=j.hosp.filter(h=>{ const L=A2.exMoeLeft({h,r0:A2.exSimPath(h,0)}); return L>0 && A2.exXferCap(h)>0; });
const overs=givers.filter(h=>{ const c=A2.exXferCap(h), r=A2.exSimPath(h,-c); return r.sepRisk!=null && r.sepRisk>5; });
chk(overs.length===0, `ยกให้เต็มเพดานแล้วผู้ให้ทุกแห่งยังระดับ ≤ 5 (${givers.length} แห่ง · เกิน ${overs.length})`);
// ป็อปอัป: ต้องกดได้ทุกแถว + มีข้อมูลใน EXPROVCAP ครบ (จังหวัด + แถวรวม)
const nClick=(h7.match(/onclick="exProvCapOpen\(/g)||[]).length;
chk(nClick===(provs.length+1)*2, `เซลล์กดดูรายชื่อได้ ${nClick} ช่อง = (${provs.length} จังหวัด + 1 แถวรวม) × 2 คอลัมน์`);
chk(/title="[^"]*รพ\. ที่ยกเงินช่วยได้/.test(h7)||/title="[^"]*ไม่มี รพ\. ในกลุ่มนี้ที่มีเงินสด/.test(h7), 'มี tooltip รายชื่อ รพ. ตอนชี้ค้าง');
// TSV ต้องมีคอลัมน์ใหม่และไม่มีคอลัมน์สุทธิที่ถอดออกแล้ว
const A3=new Function(code+`;return {exRender,getTSV:()=>EXPROV_TSV,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
A3.setEX(j); A3.setEXOPEN({}); A3.setEXBRK({}); A3.setEXSORT({col:null,dir:-1}); A3.setEXST(ST({})); A3.exRender();
const tsv=A3.getTSV().split('\n'), hd=tsv[0].split('\t');
chk(hd.includes('เงินช่วยภายในจังหวัด(ลบ.)') && hd.includes('ส่วนขาดสภาพคล่อง(MOE)(ลบ.)') && hd.includes('เพียงพอหรือไม่'),
  `TSV มีคอลัมน์ใหม่ครบ (${hd.length} คอลัมน์)`);
chk(!hd.some(c=>c.includes('สุทธิ ลูกหนี้')), 'TSV ไม่มีคอลัมน์ "สุทธิ ลูกหนี้−หนี้" ที่ถอดออกแล้ว');
chk(tsv.length===provs.length+2, `TSV มี ${provs.length} จังหวัด + หัวตาราง + แถวรวม = ${provs.length+2} บรรทัด (ได้ ${tsv.length})`);
const tsvTot=tsv[tsv.length-1].split('\t');
chk(Math.abs(+tsvTot[7]-IT.cap/1e6)<0.02 && +tsvTot[8]===IT.nCap, `TSV แถวรวม: เงินช่วย ${tsvTot[7]} ลบ. / ${tsvTot[8]} แห่ง ตรงกับที่คำนวณอิสระ (${(IT.cap/1e6).toFixed(2)} / ${IT.nCap})`);
chk(Math.abs(+tsvTot[9]-IT.short/1e6)<0.02 && +tsvTot[10]===IT.nShort, `TSV แถวรวม: ส่วนขาด ${tsvTot[9]} ลบ. / ${tsvTot[10]} แห่ง ตรงกับที่คำนวณอิสระ (${(IT.short/1e6).toFixed(2)} / ${IT.nShort})`);

// ══ 8) ↕️ คลิกหัวคอลัมน์เพื่อเรียงลำดับ (8 ส.ค. 69 · เจ้าของงานสั่ง) ══
// ⚠️ state ต้องเป็นคนละตัวกับ EXSORT ของตารางผลจำลอง — ไม่งั้นคลิกตารางหนึ่งไปสลับอีกตาราง
console.log('\n━━ ⑧ เรียงลำดับด้วยการคลิกหัวคอลัมน์ ━━');
const dataOf=h=>[...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>
    [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()))
  .filter(r=>r.length===6);
const hSort=render({});
// หัวตารางต้องกดได้ครบ 6 คอลัมน์ และมีลูกศรเฉพาะคอลัมน์ที่เรียงอยู่
const ths=[...hSort.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)];
const COLS=['prov','n','pay','ar','cap','short'];
chk(COLS.every(c=>hSort.includes(`onclick="exSetProvSort('${c}')"`)), `หัวคอลัมน์กดเรียงได้ครบ ${COLS.length} คอลัมน์`);
chk(ths.length===6, `มีหัวคอลัมน์ 6 ช่อง (ได้ ${ths.length})`);
const onTh=ths.filter(m=>/class="exsortth on/.test(m[0]));
chk(onTh.length===1 && /▲|▼/.test(onTh[0][1]), `มีคอลัมน์ที่กำลังเรียงอยู่ 1 คอลัมน์ + มีลูกศรบอกทิศ (ได้ ${onTh.length})`);
chk((hSort.match(/⇅/g)||[]).length===5, 'คอลัมน์ที่ยังไม่ได้เรียงมีสัญลักษณ์ ⇅ บอกว่ากดได้ (5 คอลัมน์)');
// ค่าเริ่มต้น = ชื่อจังหวัด ก→ฮ (พฤติกรรมเดิมก่อนใส่ตัวเรียง ต้องไม่เปลี่ยน)
const defOrder=dataOf(hSort).filter(r=>!r[0].includes('รวมทั้งเขต')).map(r=>r[0]);
chk(JSON.stringify(defOrder)===JSON.stringify(provs), `ค่าเริ่มต้นยังเรียงตามชื่อจังหวัด ก→ฮ (${defOrder.slice(0,3).join(', ')}…)`);
// เรียงตามคอลัมน์ตัวเลขทั้งสองทิศ — เทียบกับค่าที่คำนวณอิสระใน ind (กลุ่ม ⑦)
const numOK=(col,dir,val)=>{
  const rows=dataOf(render({provSort:{col,dir}}));
  const tot=rows[rows.length-1];
  const order=rows.filter(r=>!r[0].includes('รวมทั้งเขต')).map(r=>r[0]);
  const wantOrder=provs.slice().sort((a,b)=>dir*((val(a)||0)-(val(b)||0)) || a.localeCompare(b,'th'));
  const okTotLast=!!tot && tot[0].includes('รวมทั้งเขต');
  chk(JSON.stringify(order)===JSON.stringify(wantOrder) && okTotLast,
    `เรียงตาม ${col} ${dir>0?'น้อย→มาก':'มาก→น้อย'} + แถวรวมอยู่ล่างสุด → ${order.join(' > ')}`);
};
numOK('short',-1,p=>(ind[p]||{}).short);
numOK('cap',1,p=>(ind[p]||{}).cap);
numOK('pay',-1,p=>{ const r=dataRows.find(z=>z[0]===p); return want[p].pay; });
numOK('n',-1,p=>want[p].n);
// เรียงย้อนชื่อจังหวัด
const descProv=dataOf(render({provSort:{col:'prov',dir:-1}})).filter(r=>!r[0].includes('รวมทั้งเขต')).map(r=>r[0]);
chk(JSON.stringify(descProv)===JSON.stringify(provs.slice().reverse()), 'เรียงชื่อจังหวัด ฮ→ก ได้');
// คีย์เพี้ยน/ไม่มีอยู่ ต้องกลับไปใช้ค่าเริ่มต้น ไม่ใช่พังหรือได้ลำดับมั่ว
const badSort=dataOf(render({provSort:{col:'ไม่มีคอลัมน์นี้',dir:-1}})).filter(r=>!r[0].includes('รวมทั้งเขต')).map(r=>r[0]);
chk(JSON.stringify(badSort)===JSON.stringify(provs), 'คอลัมน์ที่ไม่รู้จัก → กลับไปเรียงตามชื่อจังหวัด (ไม่พัง)');
// ไฟล์ TSV ต้องเรียงตามที่เห็นบนจอ (กติกาเดิมของตารางนี้)
const A4=new Function(code+`;return {exRender,getTSV:()=>EXPROV_TSV,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
A4.setEX(j); A4.setEXOPEN({}); A4.setEXBRK({}); A4.setEXSORT({col:null,dir:-1});
A4.setEXST(ST({provSort:{col:'short',dir:-1}})); A4.exRender();
const tsvOrder=A4.getTSV().split('\n').slice(1,-1).map(l=>l.split('\t')[0]);
const scrOrder=dataOf(render({provSort:{col:'short',dir:-1}})).filter(r=>!r[0].includes('รวมทั้งเขต')).map(r=>r[0]);
chk(JSON.stringify(tsvOrder)===JSON.stringify(scrOrder), `ลำดับใน TSV = ลำดับบนจอ (${tsvOrder.slice(0,3).join(', ')}…)`);
// ป็อปอัปต้องยังชี้ถูกจังหวัดหลังสลับลำดับ (index ผูกกับ provs ที่เรียงใหม่)
const hS=render({provSort:{col:'short',dir:-1}});
const firstRowIdx=(hS.match(/onclick="exProvCapOpen\((\d+)\)"/)||[])[1];
chk(firstRowIdx==='0', `แถวแรกหลังเรียงใหม่ผูกกับ EXPROVCAP[0] (ได้ ${firstRowIdx}) = ป็อปอัปไม่สลับจังหวัด`);
// ⚠️ ต้องไม่ไปยุ่งกับ EXSORT ของตารางผลจำลอง
chk(!/exSetSort\('(prov|n|pay|ar|cap|short)'\)/.test(hSort.replace(/exSetProvSort/g,'')), 'ตารางสรุปไม่เรียก exSetSort ของตารางผลจำลอง (คนละ state)');

// ══ 9) 🔄 ป็อปอัปต้องบอกด้วยว่า "ใครช่วยใครไปแล้ว" (เจ้าของงานสั่ง 8 ส.ค. 69) ══
// เดิมป็อปอัปบอกแต่ "ยังยกได้อีก / ยังขาด" ไม่มีที่ไหนบอกว่าโยกกันไปแล้วคู่ไหนบ้าง
console.log('\n━━ ⑨ ป็อปอัป: รายการโยกที่ทำไปแล้ว ━━');
global.confirm=()=>true;
const A5=new Function(code+`;return {exRender,exXferAuto,exXferAdd,exXferList,exProvCapOpen,getCap:()=>EXPROVCAP,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
A5.setEX(j); A5.setEXOPEN({}); A5.setEXBRK({}); A5.setEXSORT({col:null,dir:-1});
A5.setEXST(ST({})); A5.exRender(); A5.exXferAuto();
// ใส่รายการ "ข้ามจังหวัด" ด้วยมือ 1 รายการ เพื่อทดสอบทิศ "ยกออกไปช่วยจังหวัดอื่น" ซึ่งกติกา
// จัดสรรอัตโนมัติไม่มีทางสร้างเอง (ข้อ ① โยกในจังหวัดเท่านั้น)
const gCross=j.hosp.find(h=>h.prov==='เชียงราย'&&/เชียงรายประชานุเคราะห์/.test(h.name));
const rCross=j.hosp.find(h=>h.prov==='ลำพูน'&&/^ลำพูน/.test(h.name));
A5.exXferAdd(gCross.hcode, rCross.hcode, 5e6);
const plan5=A5.exXferList();
const inBy={}, outBy={};
plan5.forEach(z=>{ const g=j.hosp.find(p=>p.hcode===z.f), r=j.hosp.find(p=>p.hcode===z.t);
  inBy[r.prov]=(inBy[r.prov]||0)+(+z.a||0);
  if(g.prov!==r.prov) outBy[g.prov]=(outBy[g.prov]||0)+(+z.a||0); });
const mval=s=>{ const m=s&&s.match(/([\d.]+)([BMK])/); return m?parseFloat(m[1])*({B:1e9,M:1e6,K:1e3}[m[2]]):0; };
const cap5=A5.getCap();
let badPop=0, sawCross=false, sawRecon=false;
cap5.forEach((it,i)=>{
  A5.exProvCapOpen(i);
  const h=els['exProvCapOverlay'].innerHTML, isTot=/รวมทั้งเขต/.test(it.lab);
  const gotIn=mval((h.match(/รับเข้ามา <b[^>]*>([\d.]+[BMK])</)||[])[1]);
  const gotOut=mval((h.match(/ยกออกไปช่วยจังหวัดอื่น <b[^>]*>([\d.]+[BMK])</)||[])[1]);
  const wantIn=isTot?plan5.reduce((s,z)=>s+(+z.a||0),0):(inBy[it.lab]||0);
  const wantOut=isTot?0:(outBy[it.lab]||0);          // แถวรวมต้องไม่นับซ้ำ
  const nRow=(h.match(/>→<\/td>/g)||[]).length;
  const wantRow=(it.xfin||[]).length+(it.xfout||[]).length;
  const clean=!/undefined|NaN/.test(h);
  const ok=Math.abs(gotIn-wantIn)<=0.06e6 && Math.abs(gotOut-wantOut)<=0.06e6 && nRow===wantRow && clean;
  if(!ok){ badPop++; console.log(`  ❌ ${it.lab}: เข้า ${gotIn}/${wantIn} · ออก ${gotOut}/${wantOut} · แถว ${nRow}/${wantRow}${clean?'':' · มี undefined/NaN'}`); }
  if(!isTot && wantOut>0){ sawCross=true;
    chk(/ยกออกไปช่วยจังหวัดอื่น/.test(h) && /⤳ ข้ามไป/.test(h),
      `${it.lab}: แสดงรายการที่ยกออกไปช่วยจังหวัดอื่น พร้อมป้าย ⤳ (${(wantOut/1e6).toFixed(1)}M)`); }
  // กระทบยอดได้: หัวป็อปอัปแยก "ยังขาดอยู่ + พลิกเป็นบวกแล้ว" ต้องบวกได้เท่ายอดรับเข้าทั้งหมด
  const rec=h.match(/รับโยกมาแล้ว <b[^>]*>([\d.]+[BMK])<\/b>[\s\S]*?\(ยังขาดอยู่ ([\d.]+[BMK]) \+ พลิกเป็นบวกแล้ว ([\d.]+[BMK])\)/);
  if(rec){ sawRecon=true;
    if(Math.abs(mval(rec[2])+mval(rec[3])-mval(rec[1]))>0.06e6){ badPop++;
      console.log(`  ❌ ${it.lab}: ${rec[2]} + ${rec[3]} ≠ ${rec[1]}`); } }
});
chk(badPop===0, `ป็อปอัปทุกกลุ่ม (${cap5.length}) แสดงรายการโยกครบ + ยอดตรงกับแผนจริง (ผิด ${badPop})`);
chk(sawCross, 'มีเคสข้ามจังหวัดจริงในชุดตรวจ (ไม่ผ่านแบบว่างเปล่า)');
chk(sawRecon, 'หัวป็อปอัปแยกยอด "ยังขาดอยู่ + พลิกเป็นบวกแล้ว" ให้กระทบยอดได้');
// แถวรวมทั้งเขตต้องไม่เอารายการข้ามจังหวัดมานับซ้ำทั้งสองทิศ
const totIt=cap5[cap5.length-1];
chk((totIt.xfout||[]).length===0, 'แถวรวมทั้งเขต: ไม่นับรายการข้ามจังหวัดซ้ำ (xfout ว่าง)');
chk((totIt.xfin||[]).length===plan5.length, `แถวรวมทั้งเขต: ครบทุกรายการในแผน (${(totIt.xfin||[]).length}/${plan5.length})`);
// ยังไม่มีแผนโยก → ต้องบอกให้ไปกดจัดสรรอัตโนมัติ ไม่ใช่ตารางว่าง
A5.setEXST(ST({})); A5.exRender(); A5.exProvCapOpen(0);
chk(/ยังไม่มีการโยกเงินช่วยกันในกลุ่มนี้/.test(els['exProvCapOverlay'].innerHTML),
  'ยังไม่มีแผนโยก → ป็อปอัปบอกให้ไปกด ⚡ จัดสรรอัตโนมัติ');

console.log(`\n${fail.length?'❌ ไม่ผ่าน '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ ผ่านทั้งหมด'}`);
process.exit(fail.length?1:0);
