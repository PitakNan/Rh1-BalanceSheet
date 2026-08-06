// ตรวจ Option พิเศษ "ปรับหนี้ค่ารักษาตามจ่าย รพช.↔รพศ./รพท." หลังเพิ่ม รพช. hub (6 ส.ค. 69)
// โจทย์: แม่สาย/สันป่าตอง/เกาะคา/ปัว ทำหน้าที่เหมือน รพศ./รพท. (รับภาระ/เป็นเจ้าหนี้เดิมได้)
//   แม้ประเภทขึ้นทะเบียนเป็น รพช. — และต้องเพิ่ม/ลดชั่วคราวได้ (หายหลังรีเฟรชหน้า)
const fs=require('fs');
const SRC='D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const code=[...fs.readFileSync(SRC,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
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
const mkA=()=>new Function(code+`;return {exRender,exTjCalc,exTjGive,exTjRole,exIsCred,exTjHubAdd,exTjHubDel,exTjGapAll,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXTJ:v=>{EXTJ=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v},
  getHub:()=>EXTJHUB,getDefaultHub:()=>EX_TJHUB_DEFAULT,SHOW_TJAR:EX_SHOW_TJAR};`)();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=(mode,scope)=>({mmo:3,ext:0,tgt:6,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode,scope},inj:{},open:{}});
const fmtM=v=>{if(v==null)return '—';const a=Math.abs(v);if(a>=1e9)return(v/1e9).toFixed(2)+'B';if(a>=1e6)return(v/1e6).toFixed(1)+'M';if(a>=1e3)return(v/1e3).toFixed(0)+'K';return Math.round(v).toLocaleString()};
let fail=[];
const chk=(ok,msg)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}`); if(!ok) fail.push(msg); };

const HUB_NAMES={'11194':'แม่สาย','11128':'สันป่าตอง','11147':'เกาะคา','11453':'สมเด็จพระยุพราชปัว'};

console.log('━━ 1) ชุด hub เริ่มต้น ━━');
{
  const A=mkA(); A.setEX(j);
  const hub=[...A.getHub()];
  chk(hub.length===4 && hub.every(hc=>HUB_NAMES[hc]), `hub เริ่มต้นมี 4 แห่งตามที่สั่ง (ได้ ${hub.length}: ${hub.join(',')})`);
  for(const hc in HUB_NAMES){
    const h=j.hosp.find(x=>x.hcode===hc);
    chk(!!h && h.name.includes(HUB_NAMES[hc].replace('สมเด็จพระยุพราช','')), `hcode ${hc} ตรงกับ ${HUB_NAMES[hc]} ในข้อมูลจริง (${h?h.name:'ไม่พบ'})`);
    chk(A.exIsCred(h), `exIsCred(${h.name}) = true (นับเป็นผู้รับภาระได้แม้ประเภท ${h.type})`);
  }
  const nonHub=j.hosp.find(h=>h.type==='รพช.' && !A.getHub().has(h.hcode));
  chk(!!nonHub && !A.exIsCred(nonHub), `รพช. ทั่วไปที่ไม่ใช่ hub (${nonHub.name}) exIsCred = false`);
  const realCred=j.hosp.find(h=>h.type==='รพศ.'||h.type==='รพท.');
  chk(A.exIsCred(realCred), `รพศ./รพท. จริง (${realCred.name}) exIsCred = true เหมือนเดิม`);
}
console.log();

console.log('━━ 2) hub เป็นได้ทั้งลูกหนี้ตัวเอง (debtor) และผู้รับภาระ (creditor) พร้อมกัน ━━');
{
  const A=mkA(); A.setEX(j); A.setEXST(ST('forgive','all'));
  const EXTJ=A.exTjCalc(); A.setEXTJ(EXTJ);
  for(const hc in HUB_NAMES){
    const h=j.hosp.find(x=>x.hcode===hc);
    const isDebtor=EXTJ.debtors.has(hc), share=EXTJ.shares[hc]||0;
    chk(isDebtor, `${h.name} ยังเป็นลูกหนี้ของตัวเอง (payIn ${fmtM(h.tj.payIn)}) แม้เป็น hub`);
    chk(share>0, `${h.name} ได้รับส่วนแบ่งเป็นผู้รับภาระด้วย (shares ${fmtM(share)}) — ก่อนแก้จะเป็น 0 เสมอ`);
    const got=h.tj.payIn, away=share, wantNet=got-away, wantGive=Math.abs(wantNet), wantRole=wantNet>0?'got':wantNet<0?'give':'';
    const give=A.exTjGive(h), role=A.exTjRole(h);
    chk(Math.abs(give-wantGive)<1 && role===wantRole,
      `${h.name} เงินที่ยกให้สุทธิ = |ได้รับ ${fmtM(got)} − ยกให้ ${fmtM(away)}| = ${fmtM(wantGive)} (${wantRole}) — ได้ ${fmtM(give)} (${role})`);
  }
}
console.log();

console.log('━━ 3) ยอดหนี้รวมที่ต้องเคลียร์ (EXTJ.total) ไม่เปลี่ยนจากการเพิ่ม hub ━━');
{
  // EXTJ.total = payIn รวมของ รพช. ทุกแห่ง (ตาม scope) — เป็นฝั่งลูกหนี้ ไม่ควรขยับเพราะ hub อยู่ฝั่งเจ้าหนี้/ผู้รับภาระ
  const A=mkA(); A.setEX(j); A.setEXST(ST('forgive','all'));
  const EXTJ=A.exTjCalc();
  const wantTotal=j.hosp.filter(h=>h.type==='รพช.'&&h.tj.payIn>0).reduce((s,h)=>s+h.tj.payIn,0);
  chk(Math.abs(EXTJ.total-wantTotal)<1, `ยอดหนี้รวม รพช. ทั้งเขต = ${fmtM(wantTotal)} — ได้ ${fmtM(EXTJ.total)}`);
}
console.log();

console.log('━━ 4) เพิ่ม hub ช่วยเกลี่ยหนี้ได้มากขึ้น (uncovered ลดลงหรือเท่าเดิม ไม่มากขึ้น) ━━');
{
  const A=mkA(); A.setEX(j); A.setEXST(ST('forgive','all'));
  const withHub=A.exTjCalc().uncovered;
  for(const hc in HUB_NAMES) A.exTjHubDel(hc);   // ปลดกลับเป็นพฤติกรรมเดิม (เฉพาะ รพศ./รพท. เท่านั้นที่รับภาระได้)
  const noHub=A.exTjCalc().uncovered;
  chk(withHub<=noHub+1, `เกลี่ยไม่ได้ (uncovered) เมื่อมี hub ${fmtM(withHub)} ≤ ไม่มี hub ${fmtM(noHub)}`);
  for(const hc in HUB_NAMES) A.exTjHubAdd(hc);   // คืนค่า
  const restored=A.exTjCalc().uncovered;
  chk(Math.abs(restored-withHub)<1, `เพิ่ม hub กลับคืนแล้ว uncovered เท่าค่าตอนแรก (${fmtM(restored)} vs ${fmtM(withHub)})`);
}
console.log();

console.log('━━ 5) ปุ่มเพิ่ม/ลด hub ชั่วคราว ━━');
{
  const A=mkA(); A.setEX(j); A.setEXST(ST('forgive','all'));
  const extra=j.hosp.find(h=>h.type==='รพช.'&&h.tj.arIn>0&&!A.getHub().has(h.hcode));
  chk(!!extra, `มี รพช. อื่นที่มี arIn>0 ให้ทดสอบเพิ่มชั่วคราว (${extra?extra.name:'ไม่พบ — ข้ามเคสนี้'})`);
  if(extra){
    A.exTjHubAdd(extra.hcode);
    let EXTJ=A.exTjCalc(); A.setEXTJ(EXTJ);
    chk((EXTJ.shares[extra.hcode]||0)>0, `เพิ่ม ${extra.name} เป็น hub ชั่วคราวแล้ว ได้รับส่วนแบ่งจริง (${fmtM(EXTJ.shares[extra.hcode]||0)})`);
    A.exTjHubDel(extra.hcode);
    EXTJ=A.exTjCalc(); A.setEXTJ(EXTJ);
    chk(!(EXTJ.shares[extra.hcode]>0), `ลบ ${extra.name} ออกจาก hub แล้ว ไม่ได้รับส่วนแบ่งอีก`);
  }
}
console.log();

console.log('━━ 6) รีเฟรชหน้า (instance ใหม่) ต้องกลับเป็นชุดเริ่มต้นเสมอ — ไม่ติดค่าที่เคยเพิ่ม/ลบไว้ ━━');
{
  const A=mkA(); A.setEX(j); A.setEXST(ST('off','crisis')); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
  const extra=j.hosp.find(h=>h.type==='รพช.'&&!A.getHub().has(h.hcode));
  A.exTjHubAdd(extra.hcode);
  for(const hc in HUB_NAMES) A.exTjHubDel(hc);
  chk(A.getHub().has(extra.hcode) && ![...A.getHub()].some(hc=>HUB_NAMES[hc]), 'instance เดิมยังเก็บการแก้ไขไว้ (แก้จริง ไม่ได้ no-op)');
  const B=mkA(); B.setEX(j);   // จำลองโหลดหน้าใหม่ — ตัวแปร EXTJHUB ใน B ต้องเป็นค่าเริ่มต้น ไม่ได้รับผลจาก A
  const hubB=[...B.getHub()];
  chk(hubB.length===4 && hubB.every(hc=>HUB_NAMES[hc]) && !hubB.includes(extra.hcode),
    `instance ใหม่ (จำลองรีเฟรช) กลับเป็นค่าเริ่มต้น 4 แห่งเสมอ (ได้ ${hubB.join(',')})`);
}
console.log();

console.log('━━ 7) เรนเดอร์ครบทุกโหมด × ขอบเขต ไม่พัง ไม่มี undefined/NaN ━━');
{
  let bad=0;
  for(const mode of ['off','forgive','pay','smart']){
    for(const scope of ['crisis','all']){
      const A=mkA(); A.setEX(j); A.setEXST(ST(mode,scope)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
      let err=null; try{ A.exRender(); }catch(e){ err=e.message; }
      const html=(els.exResBox&&els.exResBox.innerHTML)||'', tjHtml=(els.exTjBox&&els.exTjBox.innerHTML)||'';
      const ok=!err && !/undefined|NaN/.test(html+tjHtml);
      if(!ok) bad++;
      console.log(`  ${ok?'✅':'❌'} mode=${mode} scope=${scope}${err?' → '+err:''}`);
    }
  }
  chk(bad===0, `ทุกโหมด×ขอบเขตเรนเดอร์ได้ไม่พัง (ผิด ${bad}/8)`);
  // แผงต้องมีตัวควบคุมเพิ่ม/ลด hub + dropdown ไม่มีตัวที่อยู่ใน hub อยู่แล้วให้เลือกซ้ำ
  const A=mkA(); A.setEX(j); A.setEXST(ST('off','crisis')); A.exRender();
  const tjHtml=els.exTjBox.innerHTML;
  chk(/hubchip/.test(tjHtml), 'แผง Option พิเศษ มีชิป hub ที่เพิ่มไว้แสดงอยู่');
  chk(/exTjHubAdd/.test(tjHtml)&&/exTjHubDel/.test(tjHtml), 'มีปุ่ม/dropdown เพิ่ม-ลด hub ชั่วคราวในแผง');
  const optHcodes=[...tjHtml.matchAll(/<option value="(\d+)"/g)].map(m=>m[1]).filter(Boolean);
  const overlap=optHcodes.filter(hc=>A.getHub().has(hc));
  chk(overlap.length===0, `dropdown ไม่มี รพช. ที่อยู่ใน hub อยู่แล้วให้เลือกซ้ำ (ซ้ำ ${overlap.length})`);
}
console.log();

console.log('━━ 8) ชุดผู้รับภาระ = รพศ./รพท. 12 + hub 4 = 16 แห่ง ━━');
{
  const A=mkA(); A.setEX(j);
  const real=j.hosp.filter(h=>h.type==='รพศ.'||h.type==='รพท.');
  chk(real.length===12, `รพศ.+รพท. ในข้อมูล = 12 แห่ง (ได้ ${real.length}: รพศ. ${j.hosp.filter(h=>h.type==='รพศ.').length} + รพท. ${j.hosp.filter(h=>h.type==='รพท.').length})`);
  const pool=j.hosp.filter(h=>A.exIsCred(h));
  chk(pool.length===16, `ชุดผู้รับภาระหลังรวม hub = 16 แห่ง (ได้ ${pool.length}) — ตรงกับที่เจ้าของงานยืนยัน 12+4`);
}
console.log();

console.log('━━ 9) คำเตือนส่วนต่าง ลูกหนี้ > เจ้าหนี้ (เจ้าของงานสั่ง 6 ส.ค. 69) ━━');
{
  const A=mkA(); A.setEX(j); A.setEXST(ST('off','crisis')); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
  A.exRender();
  const g=A.exTjGapAll();
  const wantPay=j.hosp.reduce((s,h)=>s+(h.tj&&h.tj.payIn||0),0), wantAr=j.hosp.reduce((s,h)=>s+(h.tj&&h.tj.arIn||0),0);
  chk(Math.abs(g.pay-wantPay)<1&&Math.abs(g.ar-wantAr)<1&&Math.abs(g.gap-(wantAr-wantPay))<1,
    `exTjGapAll() ตรงกับผลรวมทั้งเขต — เจ้าหนี้ ${fmtM(g.pay)} · ลูกหนี้ ${fmtM(g.ar)} · ส่วนต่าง ${fmtM(g.gap)}`);
  // ⚠️ ต้องเป็น "ทั้งเขต" ไม่ผูกตัวกรองจังหวัด — ไม่งั้นคำเตือนจะเพี้ยนตอนกรองจังหวัด
  const st=ST('off','crisis'); st.prov=j.hosp[0].prov;
  A.setEXST(st); A.exRender();
  const g2=A.exTjGapAll();
  chk(Math.abs(g2.gap-g.gap)<1, `กรองจังหวัด (${st.prov}) แล้วคำเตือนยังอ้างยอดทั้งเขตเท่าเดิม ${fmtM(g2.gap)} (ไม่หล่นตามตัวกรอง)`);
  A.setEXST(ST('off','crisis')); A.exRender();
  const html=els.exResBox.innerHTML, tjHtml=els.exTjBox.innerHTML;
  const KEY='นอกชุด 103 แห่งนี้', KEY2='ที่ไม่อยู่ในชุด 103 แห่งนี้';
  chk(A.SHOW_TJAR===(html.includes(KEY)||html.includes(KEY2)), 'การ์ดสรุประดับเขตมีคำเตือน "คู่หนี้อยู่นอกชุด 103 แห่ง" (แสดงเมื่อเปิดคอลัมน์ลูกหนี้)');
  chk(tjHtml.includes(KEY2), 'แผง Option พิเศษ มีคำเตือนส่วนต่างเช่นกัน');
  for(const [lab,src] of [['การ์ดสรุป',html],['แผง Option',tjHtml]]){
    chk(src.includes(fmtM(g.gap)), `${lab} แสดงตัวเลขส่วนต่างสดจากข้อมูล ${fmtM(g.gap)} (ไม่ hardcode)`);
    chk(/กรมการแพทย์/.test(src)&&/ยังไม่ได้ยืนยัน/.test(src), `${lab} ระบุตัวอย่างหน่วยนอกสังกัด + กำกับว่ายังไม่ยืนยัน (ไม่ฟันธง)`);
  }
  // ตัวเลขในคำเตือนต้องไม่ใช่ค่าที่ฝังไว้ — เปลี่ยนข้อมูลแล้วตัวเลขต้องเปลี่ยนตาม
  const k=JSON.parse(JSON.stringify(j));
  k.hosp.forEach(h=>{ if(h.tj) h.tj.arIn=(h.tj.arIn||0)*2; });
  const B=mkA(); B.setEX(k); B.setEXST(ST('off','crisis')); B.setEXOPEN({}); B.setEXBRK({}); B.setEXSORT({col:null,dir:-1});
  B.exRender();
  const g3=B.exTjGapAll();
  chk(Math.abs(g3.ar-wantAr*2)<2 && els.exResBox.innerHTML.includes(fmtM(g3.gap)) && !els.exResBox.innerHTML.includes(fmtM(g.gap)),
    `คูณลูกหนี้ 2 เท่า คำเตือนขยับตามเป็น ${fmtM(g3.gap)} (ยอดเดิม ${fmtM(g.gap)} หายไปแล้ว = ไม่ hardcode จริง)`);
}
console.log();

console.log('\n'+(fail.length?`❌ ไม่ผ่าน ${fail.length} ข้อ:\n  `+fail.join('\n  '):'✅ ผ่านทุกข้อ'));
process.exit(fail.length?1:0);
