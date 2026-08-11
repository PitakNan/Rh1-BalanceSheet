// ⭐ ล็อกพฤติกรรม "ยกแผนข้ามงวด" — กันแผนที่ทีมทำมือหายเงียบตอนข้อมูลเดินงวด
//   ปัญหาเดิม: คีย์ localStorage ผูกเลขงวด (rh1-exec-256909 · rh1-ovplan-256909)
//   พอ export_exec.py ออกงวดใหม่ 256910 คีย์เปลี่ยน → แผนโยกเงินช่วยกันหายทั้งชุด
//   ไม่มีอะไรบอกผู้ใช้เลย (รอบข้อมูลจริงถัดไป 16 ส.ค. 69 ระหว่างที่แผนยังใช้งานอยู่)
//
//   ข้อตกลงที่ชุดนี้ล็อกไว้:
//   ① งวดใหม่ที่ยังไม่มีแผน + มีแผนงวดเก่าที่ทีมทำมือ → ต้องเจอและ**เสนอ** (ไม่ยกให้เอง)
//   ② เลือกงวดที่ใกล้ที่สุดงวดเดียว · ข้ามงวดอนาคต · ข้ามคีย์อื่นที่ไม่ใช่ของเรา
//   ③ งวดนี้มีแผนอยู่แล้ว → ห้ามเสนอ (จะกลายเป็นเอาของเก่ามาทับ)
//   ④ แผนงวดเก่าที่ยังไม่มีใครแตะ (ค่าเริ่มต้นเปล่า ๆ) → ไม่ต้องเสนอ ไม่รบกวน
//   ⑤ ยกมาแล้วต้องรายงานให้ครบว่ารายการไหนใช้กับงวดใหม่ไม่ได้แล้ว — ห้ามยกมาเงียบ ๆ
//   ⑥ ยกมาแล้วแผนต้องมาครบทุกรายการ (xfer + ค่าที่ปรับเอง)
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
// localStorage ปลอมที่มี length/key(i) จริง — carryFindPrev เดินลูปคีย์ทั้งกระเป๋า
const LS={_d:{},
  getItem(k){ return (k in this._d)?this._d[k]:null; },
  setItem(k,v){ this._d[k]=String(v); },
  removeItem(k){ delete this._d[k]; },
  key(i){ return Object.keys(this._d)[i]; },
  get length(){ return Object.keys(this._d).length; },
  reset(d){ this._d=Object.assign({},d||{}); }};
global.localStorage=LS;
global.location={hash:''}; global.navigator={clipboard:null}; global.confirm=()=>true;
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exRender,renderExec,exLoad,exSave,exMergeState,exCarryHtml,exCarryReport,
  exCarryWork,ovCarryWork,carryFindPrev,exXferAuto,exXferList,exSimPath,exMoeLeft,exXferOut,exXferIn,
  exDefaultState,exStoreKey,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v},
  getEXST:()=>EXST,getCARRY:()=>EX_CARRY,setCARRY:v=>{EX_CARRY=v},clrMSG:()=>{EX_CARRY_MSG=''}};`)();
const J=JSON.parse(fs.readFileSync(path.join(ROOT,'docs','data','risk','exec.json'),'utf8'));
const clone=o=>JSON.parse(JSON.stringify(o));
const ST=o=>Object.assign(A.exDefaultState(),o);
A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
const M=v=>(v/1e6).toFixed(2)+'M';
let fail=[];
const chk=(ok,msg)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}`); if(!ok) fail.push(msg); };

const CUR=J.period, PREV=CUR;                 // งวดในไฟล์จริง = "งวดก่อนหน้า" ของสถานการณ์ทดสอบ
const NEXT=(CUR%100===12)?(Math.floor(CUR/100)+1)*100+1:CUR+1;
console.log(`ไฟล์: ${SRC}\nงวดในข้อมูล: ${J.periodLabel} ${CUR} · รพ. ${J.hosp.length} แห่ง`);
console.log(`จำลองข้อมูลเดินงวด: ${PREV} → ${NEXT}`);

// ── สร้างแผนจริงของงวดเก่าด้วยปุ่ม ⚡ จัดสรรอัตโนมัติ (ไม่ใช่แผนมั่ว ๆ) ──────────────────
// ⚠️ ต้องสร้างแผนใต้สมมติฐานชุดเดียวกับที่จะเซฟ (รวม arOvr/tgt/crisis) ไม่งั้นแผน "ไม่เข้ากับ
//    สถานะของตัวเอง" ตั้งแต่ต้น แล้วเคส (ก) จะฟ้องผิดทั้งที่ข้อมูลไม่ได้เปลี่ยนอะไรเลย
const AROVR={[J.hosp[0].hcode]:12345678};
A.setEX(J); A.setEXST(ST({xfer:[], arOvr:AROVR, tgt:5, crisis:'all'})); A.exRender();
A.exXferAuto();
const PLAN=clone(A.exXferList());
const OLDST=ST({xfer:PLAN, arOvr:AROVR, tgt:5, crisis:'all'});
console.log(`แผนงวดเก่า: โยก ${PLAN.length} รายการ รวม ${M(PLAN.reduce((s,x)=>s+x.a,0))} · ปรับเอง 1 รายการ`);
chk(PLAN.length>0, `ปุ่ม ⚡ สร้างแผนตั้งต้นได้ (${PLAN.length} รายการ)`);

// ══ ① พองวดขยับ ต้องเจอแผนงวดเก่าและเสนอ (ไม่ยกให้เอง) ═════════════════════════════
console.log('\n━━ ① งวดใหม่ยังไม่มีแผน → ต้องเสนอแผนงวดเก่า ━━');
const EXN=clone(J); EXN.period=NEXT; EXN.periodLabel='งวดถัดไป';
LS.reset({['rh1-exec-'+PREV]:JSON.stringify(OLDST), 'rh1-theme':'dark'});
A.setEX(EXN); A.exLoad();
const c1=A.getCARRY();
chk(!!c1, 'เจอแผนงวดก่อนหน้า');
chk(c1 && c1.period===PREV, `ชี้ไปที่งวด ${PREV} (ได้ ${c1&&c1.period})`);
chk(A.getEXST().xfer.length===0, 'ยังไม่ยกมาให้เอง — EXST ยังเป็นค่าเริ่มต้น (ต้องให้คนกดยืนยัน)');
const html=A.exCarryHtml();
chk(/พบแผนของงวด/.test(html) && /ยกแผนงวด/.test(html), 'แถบเสนอขึ้นจริงและมีปุ่มให้กด');
chk(/no-print/.test(html), 'แถบเสนอไม่ติดไปกับ PDF (no-print)');
chk(new RegExp(String(PLAN.length)+' รายการ').test(html), `แถบบอกจำนวนรายการที่จะยกมา (${PLAN.length})`);

// ══ ② เลือกงวดใกล้สุดงวดเดียว · ข้ามงวดอนาคต · ข้ามคีย์อื่น ═══════════════════════
console.log('\n━━ ② เลือกงวดไหนมาเสนอ ━━');
const older=PREV-1, future=NEXT+1;
LS.reset({['rh1-exec-'+older]:JSON.stringify(ST({xfer:[{f:'A',t:'B',a:1}]})),
          ['rh1-exec-'+PREV]:JSON.stringify(OLDST),
          ['rh1-exec-'+future]:JSON.stringify(ST({xfer:[{f:'C',t:'D',a:9}]})),
          ['rh1-ovplan-'+PREV]:JSON.stringify({tgt:3,plans:{x:{method:'acp',debt:0}}}),
          'rh1-theme':'dark'});
A.setEX(EXN); A.exLoad();
const c2=A.getCARRY();
chk(c2 && c2.period===PREV, `เอางวดที่ใกล้ที่สุด (${PREV}) ไม่ใช่งวดเก่ากว่า (${older})`);
chk(c2 && c2.n===A.exCarryWork(OLDST), 'นับงานที่ทีมทำมือได้ถูก');
LS.reset({['rh1-exec-'+future]:JSON.stringify(ST({xfer:[{f:'C',t:'D',a:9}]}))});
A.setEX(EXN); A.exLoad();
chk(A.getCARRY()===null, 'มีแต่งวดอนาคต → ไม่เสนอ');
LS.reset({'rh1-theme':'dark', ['rh1-ovplan-'+PREV]:'{}', 'rh1-exec-abc':'{}'});
A.setEX(EXN); A.exLoad();
chk(A.getCARRY()===null, 'คีย์อื่นในกระเป๋าเดียวกันไม่ถูกจับมาเป็นแผน');

// ══ ③ งวดนี้มีแผนอยู่แล้ว → ห้ามเสนอ (กันของเก่าทับของใหม่) ══════════════════════
console.log('\n━━ ③ งวดนี้มีแผนอยู่แล้ว ━━');
const NEWST=ST({xfer:[{f:J.hosp[1].hcode,t:J.hosp[2].hcode,a:5e6}]});
LS.reset({['rh1-exec-'+PREV]:JSON.stringify(OLDST), ['rh1-exec-'+NEXT]:JSON.stringify(NEWST)});
A.setEX(EXN); A.exLoad();
chk(A.getCARRY()===null, 'ไม่เสนอเมื่องวดนี้มีแผนแล้ว');
chk(A.getEXST().xfer.length===1 && A.getEXST().xfer[0].a===5e6, 'โหลดแผนของงวดนี้มาถูกต้อง (ไม่โดนของเก่าทับ)');
chk(A.exCarryHtml()==='', 'ไม่มีแถบเสนอค้างบนหน้า');

// ══ ④ แผนงวดเก่าที่ยังไม่มีใครแตะ → ไม่ต้องรบกวน ══════════════════════════════════
console.log('\n━━ ④ แผนเปล่า ไม่ต้องเสนอ ━━');
LS.reset({['rh1-exec-'+PREV]:JSON.stringify(ST({}))});
A.setEX(EXN); A.exLoad();
chk(A.getCARRY()===null, 'แผนงวดเก่าที่เป็นค่าเริ่มต้นล้วน → ไม่เสนอ');
chk(A.exCarryWork(ST({}))===0, 'exCarryWork นับค่าเริ่มต้นเป็น 0');
chk(A.exCarryWork(ST({xfer:PLAN}))===PLAN.length, 'exCarryWork นับ xfer ครบ');
chk(A.ovCarryWork({plans:{a:{method:'auto',debt:0},b:{method:'auto',debt:0}}})===0,
    'ovCarryWork ไม่นับแถวที่ระบบสร้างค่าเริ่มต้นให้เอง (method auto · debt 0)');
chk(A.ovCarryWork({plans:{a:{method:'acp',debt:0},b:{method:'auto',debt:2e6}}})===2,
    'ovCarryWork นับเฉพาะแถวที่ผู้ใช้แก้เอง');

// ══ ⑤ ยกมาแล้วต้องรายงานรายการที่ใช้ไม่ได้ — ห้ามเงียบ ═════════════════════════════
console.log('\n━━ ⑤ รายงานหลังยกแผนมา ━━');
// (ก) ข้อมูลงวดใหม่เหมือนเดิมเป๊ะ → แผนต้องยังใช้ได้ทั้งชุด
LS.reset({['rh1-exec-'+PREV]:JSON.stringify(OLDST)});
A.setEX(EXN); A.exLoad();
A.exMergeState(A.getCARRY().state); A.exRender();
const rpt1=A.exCarryReport(PREV).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
chk(A.exXferList().length===PLAN.length, `ยกแผนมาครบ ${PLAN.length} รายการ`);
chk(A.getEXST().arOvr[J.hosp[0].hcode]===12345678, 'ค่าที่ปรับเอง (✎ ลูกหนี้) ยกมาด้วย');
chk(A.getEXST().tgt===5 && A.getEXST().crisis==='all', 'ค่าตั้งเป้า/ตัวกรองยกมาด้วย');
console.log(`   รายงาน(ก): ${rpt1.slice(0,180)}`);
// ข้อมูลไม่เปลี่ยน = ผู้ให้ต้องไม่มีใครเกินกำลัง และไม่มีรหัสหาย
// (แต่ "ยังขาดอยู่ N แห่ง" ขึ้นได้ตามปกติ — ลำพูนอุดกันเองไม่ครบมาตั้งแต่ต้น ไม่ได้เกิดจากการเดินงวด)
// ⚠️ ต้องดักข้อความเต็มของ bullet ไม่ใช่ /ให้เกินกำลัง/ เปล่า ๆ ไม่งั้นไปโดนประโยค**ปฏิเสธ**
//    "ไม่มีผู้ให้ที่ให้เกินกำลัง" ของกรณี all-clear เข้า (เจอ 11 ส.ค. 69 งวด 256910 ที่แผนพอทั้งชุด
//    — งวด 256909 ไม่เจอเพราะมีส่วนขาดค้างอยู่เสมอ รายงานจึงไม่เคยเข้าสาขา all-clear)
chk(!/⚠️ ผู้ให้ \d+ แห่งให้เกินกำลัง/.test(rpt1), 'ข้อมูลไม่เปลี่ยน → ไม่ฟ้องว่าผู้ให้เกินกำลัง (เศษปัดบาทต้องไม่นับ)');
chk(!/ไม่มีในข้อมูลงวดนี้/.test(rpt1), 'ข้อมูลไม่เปลี่ยน → ไม่มีรหัส รพ. หาย');
// ยอด "ยังขาดอยู่" ต้องกระทบยอดกับคำเตือนของปุ่ม ⚡ — ห้ามผูกกับตัวเลขของงวดใดงวดหนึ่ง เพราะบางงวด
// แผนอุดได้ครบทั้งชุด (เช่น 256910) แล้วรายงานจะเข้าสาขา all-clear ที่ไม่มีตัวเลข จึงนับเองอย่างอิสระ
// ด้วยเกณฑ์เดียวกับหน้าเว็บ (EX_CARRY_EPS = 1,000 บาท) แล้วเทียบว่ารายงานพูดตรงกับที่นับได้
const nShort=EXN.hosp.filter(h=>A.exMoeLeft({h,r0:A.exSimPath(h,0)})< -1000 && !(A.exXferOut(h)>0)).length;
const mShort=rpt1.match(/ยังขาดอยู่ (\d+) แห่ง รวม ([\d.]+)M/);
if(nShort>0){
  chk(!!mShort && +mShort[1]===nShort, `รายงานบอกยอดที่ยังขาดเป็นตัวเลขให้กระทบยอดได้ (นับเองได้ ${nShort} แห่ง)`);
  if(mShort) console.log(`   → ยังขาด ${mShort[1]} แห่ง รวม ${mShort[2]}M`);
}else{
  chk(!mShort && /ไม่มีแห่งไหนเหลือขาด/.test(rpt1), 'แผนพอทั้งชุด → ต้องบอก all-clear ชัดเจน ไม่ใช่เงียบ');
  console.log('   → งวดนี้แผนเดิมอุดได้ครบทั้งชุด ไม่เหลือแห่งที่ขาด');
}

// (ข) งวดใหม่เงินสดผู้ให้หด → ต้องจับได้ว่าให้เกินกำลังแล้ว
const givers=[...new Set(PLAN.map(x=>x.f))].slice(0,3);
const EXB=clone(EXN);
EXB.hosp.forEach(h=>{ if(givers.includes(h.hcode)) h.bs.cn=Math.round(h.bs.cn*0.02); });
LS.reset({['rh1-exec-'+PREV]:JSON.stringify(OLDST)});
A.setEX(EXB); A.exLoad();
A.exMergeState(A.getCARRY().state); A.exRender();
const rpt2=A.exCarryReport(PREV).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
console.log(`   รายงาน(ข): ${rpt2.slice(0,220)}`);
chk(/ผู้ให้ \d+ แห่งให้เกินกำลัง/.test(rpt2), `จับได้ว่าผู้ให้ ${givers.length} แห่งให้เกินกำลังของงวดใหม่`);
const nOver=EXB.hosp.filter(h=>A.exMoeLeft({h,r0:A.exSimPath(h,0)})< -1000 && A.exXferOut(h)>0).length;
chk((rpt2.match(/ผู้ให้ (\d+) แห่ง/)||[])[1]===String(nOver), `จำนวนในรายงานตรงกับที่นับได้จริง (${nOver} แห่ง)`);

// (ค) รพ. หายจากชุดข้อมูลงวดใหม่ → ต้องบอก ไม่ใช่ปล่อยรายการค้าง
const EXC=clone(EXN); const dropped=PLAN[0].t;
EXC.hosp=EXC.hosp.filter(h=>h.hcode!==dropped);
LS.reset({['rh1-exec-'+PREV]:JSON.stringify(OLDST)});
A.setEX(EXC); A.exLoad();
A.exMergeState(A.getCARRY().state); A.exRender();
const rpt3=A.exCarryReport(PREV).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
console.log(`   รายงาน(ค): ${rpt3.slice(0,200)}`);
chk(/ไม่มีในข้อมูลงวดนี้/.test(rpt3) && rpt3.includes(dropped), `บอกว่ารหัส ${dropped} หายไปจากงวดใหม่`);

// ══ ⑥ กด "เริ่มใหม่จากงวดนี้" แล้วต้องไม่ถามซ้ำรอบหน้า ═════════════════════════════
console.log('\n━━ ⑥ กดข้ามแล้วไม่ถามซ้ำ ━━');
LS.reset({['rh1-exec-'+PREV]:JSON.stringify(OLDST)});
A.setEX(EXN); A.exLoad();
chk(!!A.getCARRY(), 'รอบแรกยังเสนอ');
A.setCARRY(null); A.exSave();          // = ผลของปุ่ม "เริ่มใหม่จากงวดนี้"
A.exLoad();
chk(A.getCARRY()===null, 'รอบถัดไปไม่ถามซ้ำ (มีคีย์งวดนี้แล้ว)');
chk(LS.getItem('rh1-exec-'+NEXT)!==null, `เขียนคีย์ rh1-exec-${NEXT} ไว้จริง`);
chk(LS.getItem('rh1-exec-'+PREV)!==null, 'แผนงวดเก่ายังอยู่ ไม่ถูกลบทิ้ง');

// ══ ⑦ แถบต้องโผล่บนหน้าจริง ไม่ใช่แค่ฟังก์ชันคืนสตริง ══════════════════════════════
console.log('\n━━ ⑦ ต่อสายเข้าหน้าจริงแล้ว ━━');
LS.reset({['rh1-exec-'+PREV]:JSON.stringify(OLDST)});
A.setEX(EXN); A.exLoad(); A.clrMSG();
global.location.hash='#exec';
els['right'].innerHTML='';
A.renderExec();
const page=els['right'].innerHTML;
chk(/พบแผนของงวด/.test(page), 'แถบเสนออยู่ใน #right ที่ renderExec สร้าง');
chk(page.indexOf('excarry')>=0 && page.indexOf('excarry')<page.indexOf('print-head'),
    'แถบอยู่บนสุดของแท็บ ก่อนหัวรายงาน (ผู้ใช้ต้องเห็นก่อนตัวเลข)');
chk(/\.excarry\{/.test(fs.readFileSync(SRC,'utf8')), 'มี CSS .excarry จริง (ไม่ใช่ div เปล่าไม่มีสไตล์)');

console.log(fail.length?`\n❌ ไม่ผ่าน ${fail.length} ข้อ:\n - ${fail.join('\n - ')}`:'\n✅ ผ่านทั้งหมด');
process.exit(fail.length?1:0);
