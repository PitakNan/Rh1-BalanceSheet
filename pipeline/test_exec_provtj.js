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
// ดึงแถวออกจาก HTML: <tr>...<td>จังหวัด</td><td>n</td><td>pay</td><td>arRaw</td><td>ar</td><td>net</td>
const rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>
  [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c=>c[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()));
const dataRows=rows.filter(r=>r.length===5 && provs.includes(r[0]));
chk(dataRows.length===provs.length, `มีครบทุกจังหวัด ${dataRows.length}/${provs.length}`);
let bad=0;
dataRows.forEach(r=>{
  const w=want[r[0]];
  const okN=r[1]===String(w.n), okPay=r[2].startsWith(M(w.pay)), okAr=r[3].startsWith(M(w.ar));
  if(!(okN&&okPay&&okAr)) bad++;
  console.log(`  ${okN&&okPay&&okAr?'✅':'❌'} ${r[0].padEnd(10)} รพ.${r[1].padStart(3)} · หนี้ ${r[2].padEnd(24)} · ลูกหนี้ ${r[3].padEnd(30)} · สุทธิ ${r[4]}`);
  if(!okN) console.log(`      ↳ n ควรเป็น ${w.n}`);
  if(!okPay) console.log(`      ↳ หนี้ ควรเป็น ${M(w.pay)}`);
  if(!okAr) console.log(`      ↳ ลูกหนี้ ควรเป็น ${M(w.ar)}`);
});
chk(bad===0, `ยอดทุกจังหวัดตรง (ผิด ${bad})`);
const T={n:0,pay:0,ar:0}; provs.forEach(p=>{T.n+=want[p].n;T.pay+=want[p].pay;T.ar+=want[p].ar;});
const totRow=rows.find(r=>r.length===5 && r[0].includes('รวมทั้งเขต'));
chk(!!totRow, 'มีแถวรวมทั้งเขต');
if(totRow){
  chk(totRow[1]===String(T.n), `แถวรวม: จำนวน รพ. = ${T.n}`);
  chk(totRow[2].startsWith(M(T.pay)), `แถวรวม: หนี้ที่ต้องจ่าย = ${M(T.pay)} (ได้ ${totRow[2]})`);
  chk(totRow[3].startsWith(M(T.ar)), `แถวรวม: ลูกหนี้คาดเก็บได้ = ${M(T.ar)} (ได้ ${totRow[3]})`);
  const net=T.ar-T.pay;
  chk(totRow[4].replace(/[+−]/,'')===M(Math.abs(net)), `แถวรวม: สุทธิ = ${net>=0?'+':'−'}${M(Math.abs(net))} (ได้ ${totRow[4]})`);
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
  const tot=tr.find(r=>r.length===5 && r[0].includes('รวมทั้งเขต'));
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
const tot50=tr50.find(r=>r.length===5 && r[0].includes('รวมทั้งเขต'));
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
  return tr.find(r=>r.length===5 && r[0].includes('รวมทั้งเขต')); };
// ค่าจริงที่เจ้าของงานใช้อยู่ = 62%
const h62=render({arPct:62});
chk(grab(h62)[3].startsWith(M(T.ar*0.62)), `arPct=62: ยอดรวม = ${M(T.ar*0.62)} (ได้ ${grab(h62)[3]})`);
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
const dp=trp.filter(r=>r.length===5 && !r[0].includes('รวมทั้งเขต'));
chk(dp.length===1 && dp[0][0]===pv, `กรอง "${pv}" แล้วเหลือ 1 จังหวัด (ได้ ${dp.length}: ${dp.map(r=>r[0]).join(',')})`);
chk(dp.length===1 && dp[0][1]===String(want[pv].n), `จำนวน รพ. = ${want[pv].n}`);

console.log(`\n${fail.length?'❌ ไม่ผ่าน '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ ผ่านทั้งหมด'}`);
process.exit(fail.length?1:0);
