// ตรวจฟีเจอร์ 🔄 "โยกเงินช่วยกันระหว่าง รพ." (เจ้าของงานสั่ง 6 ส.ค. 69)
// โจทย์: ยอด "รวมเงินเติมตามสภาพคล่อง" เดิมเป็นเลขลอย ไม่บอกต้นทาง (13 เดือนขึ้นถึง 7 พันล้าน)
// ต้องบังคับให้ทุกบาทมีต้นทางจริง = โยกจาก รพ. ที่มีเงินสดเหลือหลังภาระ MOE
// กติกาที่เจ้าของงานเคาะ: ข้ามจังหวัดได้เสรี · ผู้ให้คุมระดับ ณ ก.ย. ไม่เกิน 5 (เตือนตั้งแต่เกิน 3)
//                        · แผนเก็บถาวร · มีปุ่มจัดสรรอัตโนมัติเสนอให้ก่อนแล้วแก้มือได้
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const code=[...fs.readFileSync(SRC,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const mkEl=()=>({innerHTML:'',textContent:'',scrollTop:0,value:'',classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}});
let els={};
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),querySelectorAll:()=>[],addEventListener(){},
  documentElement:mkEl(),createElement:mkEl,body:mkEl()};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
let STORE={};
global.localStorage={getItem:k=>STORE[k]||null,setItem:(k,v)=>{STORE[k]=v},removeItem:k=>{delete STORE[k]}};
global.location={hash:''}; global.navigator={clipboard:null};
global.confirm=()=>true;   // ⚡ จัดสรรอัตโนมัติถามยืนยันก่อนล้างแผนเดิม (7 ส.ค. 69)
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const mkA=()=>new Function(code+`;return {fmtM,exRender,exSimPath,exMoeLeft,exTopUp,exSolve,exSolveDown,
  exXferAdd,exXferDel,exXferClear,exXferAuto,exXferCap,exXferWarnCap,exXferList,exXferIn,exXferOut,exXferNet,
  exXfToggle,exXfSubmit,exXfOpen,exXfClose,HARD:EX_XF_HARD,WARN:EX_XF_WARN,getShort:()=>EXXF_SHORT,
  exTopUpGross,exArIn,exArRaw,exArCut,exSetArPct,exSetArOvr,exArClear,exArPct,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXTJ:v=>{EXTJ=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},
  setEXSORT:v=>{EXSORT=v},setEXXF:v=>{EXXF=v},setEXAR:v=>{EXAR=v},getEXST:()=>EXST};`)();
const EXSTof=A=>A.getEXST();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=mmo=>({mmo,ext:0,tgt:6,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false});
// ⚠️ ห้ามลอกสูตร fmtM มาไว้ที่นี่ — ดึงจากหน้าเว็บตรง ๆ ไม่งั้นพอเปลี่ยนจำนวนทศนิยม
//    เทสต์จะเทียบกับสูตรเก่าของตัวเองแล้วฟ้องผิดทั้งที่หน้าเว็บถูก (เกิดจริง 9 ส.ค. 69)
const fmtM=mkA().fmtM;
let fail=[];
const chk=(ok,msg)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}`); if(!ok) fail.push(msg); };
const boot=(mmo=3)=>{ els={}; STORE={}; const A=mkA(); A.setEX(j);
  A.setEXTJ({debtors:new Set(),shares:{},refund:{},total:0,uncovered:0});
  A.setEXST(ST(mmo)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1}); A.setEXXF({}); A.setEXAR({}); return A; };
const left=(A,h)=>A.exMoeLeft({h,r0:A.exSimPath(h,0)});
const totShort=A=>j.hosp.reduce((s,h)=>s+A.exTopUp({h,r0:A.exSimPath(h,0)}),0);
const totNeed=A=>j.hosp.reduce((s,h)=>s+(A.exSolve(h)||0),0);

console.log('━━ 1) helper นับเงินเข้า-ออกถูก + ผลต่อคอลัมน์สภาพคล่อง ━━');
{
  const A=boot();
  const g=j.hosp.find(h=>left(A,h)>20e6);              // ผู้ให้ที่เงินเหลือเยอะ
  const r=j.hosp.find(h=>left(A,h)<-5e6);              // ผู้รับที่ขาดเยอะ
  const g0=left(A,g), r0=left(A,r), short0=totShort(A);
  A.exXferAdd(g.hcode, r.hcode, 5e6);
  chk(A.exXferOut(g)===5e6 && A.exXferIn(r)===5e6, `นับเงินออก/เข้าถูก (${g.name} ออก 5M · ${r.name} เข้า 5M)`);
  chk(A.exXferNet(g)===-5e6 && A.exXferNet(r)===5e6, 'net ผู้ให้ติดลบ ผู้รับเป็นบวก');
  chk(Math.abs(left(A,g)-(g0-5e6))<1, `ผู้ให้เงินเหลือลด 5M (${fmtM(g0)} → ${fmtM(left(A,g))})`);
  chk(Math.abs(left(A,r)-(r0+5e6))<1, `ผู้รับส่วนขาดลด 5M (${fmtM(r0)} → ${fmtM(left(A,r))})`);
  chk(Math.abs(totShort(A)-(short0-5e6))<1, `ส่วนขาดรวมทั้งเขตลด 5M (${fmtM(short0)} → ${fmtM(totShort(A))})`);
  // ยกเลิกแล้วต้องกลับค่าเดิมเป๊ะ
  A.exXferDel(g.hcode, r.hcode);
  chk(Math.abs(totShort(A)-short0)<1 && A.exXferList().length===0, `ยกเลิกแล้วกลับค่าเดิมเป๊ะ (${fmtM(totShort(A))})`);
}
console.log();

console.log('━━ 2) เงินโยกเข้าแบบจำลองจริง (ไม่ใช่แค่ตัวเลขในคอลัมน์) ━━');
{
  const A=boot();
  const r=j.hosp.find(h=>A.exSolve(h)>0);              // รพ. ที่ต้องขอเงินสนับสนุน
  const g=j.hosp.find(h=>left(A,h)>50e6 && h.hcode!==r.hcode);
  const need0=A.exSolve(r), sep0=A.exSimPath(r,0).sepRisk;
  A.exXferAdd(g.hcode, r.hcode, need0);                // โยกให้เท่ากับที่ Solver ต้องการพอดี
  const need1=A.exSolve(r), sep1=A.exSimPath(r,0).sepRisk;
  chk(need1<need0, `${r.name}: โยกให้ ${fmtM(need0)} แล้วเงินสนับสนุนที่ยังต้องขอลดลง (${fmtM(need0)} → ${fmtM(need1)})`);
  chk(sep1<=sep0, `ระดับ ณ ก.ย. ของผู้รับดีขึ้นหรือเท่าเดิม (${sep0} → ${sep1})`);
  const gs0=A.exSimPath(g,0).sepRisk;
  chk(gs0!=null, `ผู้ให้ (${g.name}) ยังคำนวณระดับได้ปกติ = ${gs0} (เงินที่ให้ถูกหักออกจากงบจริง)`);
}
console.log();

console.log('━━ 3) เพดานผู้ให้ — ห้ามให้จนตัวเองเกินระดับ 5 ━━');
{
  const A=boot();
  chk(A.HARD===5 && A.WARN===3, `ค่าคงที่ตรงที่เจ้าของงานเคาะ (หยุดที่ ${A.HARD} · เตือนตั้งแต่เกิน ${A.WARN})`);
  const g=j.hosp.find(h=>left(A,h)>20e6);
  const cap=A.exXferCap(g), sur=left(A,g);
  chk(cap>0 && cap<=sur, `${g.name}: เพดาน ${fmtM(cap)} ไม่เกินเงินสดที่เหลือ ${fmtM(sur)}`);
  // ให้เต็มเพดานแล้วระดับต้องยังไม่เกิน 5
  A.exXferAdd(g.hcode, j.hosp.find(h=>left(A,h)<0).hcode, cap);
  const sep=A.exSimPath(g,0).sepRisk;
  chk(sep==null||sep<=A.HARD, `ให้เต็มเพดาน ${fmtM(cap)} แล้วระดับ ณ ก.ย. = ${sep} (ต้อง ≤ ${A.HARD})`);
  chk(A.exXferCap(g)===0 || A.exXferCap(g)<1e6, `ให้เต็มแล้วเพดานเหลือ ~0 (${fmtM(A.exXferCap(g))}) — โยกต่อไม่ได้`);
  // รพ. ที่ระดับเกิน 5 อยู่แล้ว ต้องให้ไม่ได้เลย
  const bad=j.hosp.filter(h=>{const s=A.exSimPath(h,0).sepRisk; return s!=null&&s>A.HARD;});
  const anyCap=bad.filter(h=>A.exXferCap(h)>0);
  chk(anyCap.length===0, `รพ. ที่ระดับ >${A.HARD} อยู่แล้ว (${bad.length} แห่ง) ให้เงินใครไม่ได้เลย (ผิด ${anyCap.length})`);
}
console.log();

console.log('━━ 4) กันกรอกเกินเพดาน + โยกซ้ำคู่เดิมรวมยอด ━━');
{
  const A=boot();
  const g=j.hosp.find(h=>left(A,h)>20e6), r=j.hosp.find(h=>left(A,h)<0);
  const cap=A.exXferCap(g);
  A.setEXXF({[g.hcode]:1}); A.exRender();
  els['xfT_'+g.hcode]=Object.assign(mkEl(),{value:r.hcode});
  els['xfA_'+g.hcode]=Object.assign(mkEl(),{value:String((cap/1e6)*10)});   // พิมพ์เกินเพดาน 10 เท่า
  A.exXfSubmit(g.hcode);
  chk(A.exXferOut(g)<=cap+1, `พิมพ์วงเงินเกินเพดาน 10 เท่า ถูกจำกัดไว้ที่ ${fmtM(A.exXferOut(g))} (เพดาน ${fmtM(cap)})`);
  const n1=A.exXferList().length;
  A.exXferAdd(g.hcode, r.hcode, 1);   // โยกซ้ำคู่เดิม
  chk(A.exXferList().length===n1, 'โยกซ้ำคู่เดิม = รวมยอดในรายการเดิม ไม่สร้างแถวซ้ำ');
  A.exXferAdd(g.hcode, g.hcode, 1e6);
  chk(!A.exXferList().some(x=>x.f===x.t), 'โยกให้ตัวเองไม่ได้');
  A.exXferClear();
  chk(A.exXferList().length===0, 'ล้างแผนทั้งหมดได้');
}
console.log();

console.log('━━ 5) ⚡ จัดสรรอัตโนมัติ (3 เดือน — กำลังในเขตพอ) ━━');
{
  const A=boot(3);
  const short0=totShort(A), need0=totNeed(A);
  A.exXferAuto();
  const L=A.exXferList(), moved=L.reduce((s,x)=>s+x.a,0);
  chk(L.length>0, `สร้างรายการโยก ${L.length} รายการ รวม ${fmtM(moved)}`);
  // ⚠️ แก้ 7 ส.ค. 69 ตามกติกาใหม่ 5 ข้อ — สองข้อนี้เคยยึดพฤติกรรมเดิม (ข้ามจังหวัดได้ + เติมพอดี)
  //   ① ไม่ข้ามจังหวัดแล้ว → จังหวัดที่ผู้ให้ไม่พอ (ลำพูน) จะเหลือส่วนขาดค้างไว้โดยตั้งใจ
  //   ③ เติมเกินความต้องการอีก 100K/แห่ง → ยอดที่โยกจะไม่เท่าส่วนขาดเดิมเป๊ะ
  //   รายละเอียดกติกาอยู่ใน test_exec_xfer_auto.js (ชุดตรวจเฉพาะของ auto)
  const shortLeft=totShort(A), nShort=A.getShort?A.getShort().length:0;
  chk(shortLeft<short0, `ส่วนขาดลดลงจริง ${fmtM(short0)} → ${fmtM(shortLeft)} (ที่เหลือคือจังหวัดที่ผู้ให้ไม่พอ ${nShort} แห่ง — กติกา ④ ให้หยุด ไม่ข้ามจังหวัด)`);
  chk(moved<=short0+5e6 && moved>short0*0.5,
    `ยอดที่โยกสมเหตุสมผลกับส่วนขาดเดิม (${fmtM(moved)} vs ${fmtM(short0)}) — ต่างได้เพราะเติมเกิน 100K/แห่ง และเว้นจังหวัดที่เงินไม่พอ`);
  chk(totNeed(A)<need0, `เงินสนับสนุนที่ต้องขอนอกเขตลดลง (${fmtM(need0)} → ${fmtM(totNeed(A))})`);
  // ผู้ให้ทุกแห่งต้องไม่เกินระดับ 5
  const givers=[...new Set(L.map(x=>x.f))].map(hc=>j.hosp.find(h=>h.hcode===hc));
  const over=givers.filter(h=>{const s=A.exSimPath(h,0).sepRisk; return s!=null&&s>A.HARD;});
  chk(over.length===0, `ผู้ให้ทั้ง ${givers.length} แห่งระดับ ≤${A.HARD} (เกิน ${over.length})`);
  // ผู้รับต้องไม่ได้เกินที่ขาด (ไม่ Over)
  const overFill=j.hosp.filter(h=>A.exXferIn(h)>0 && left(A,h)>1e6);
  chk(overFill.length===0, `ไม่มีผู้รับที่ได้เงินเกินส่วนที่ขาด (เกิน ${overFill.length} แห่ง)`);
  // ในจังหวัดก่อน แล้วค่อยข้ามจังหวัด
  const cross=L.filter(x=>{const f=j.hosp.find(h=>h.hcode===x.f),t=j.hosp.find(h=>h.hcode===x.t);return f.prov!==t.prov;});
  chk(cross.length<L.length/2, `ส่วนใหญ่โยกในจังหวัดเดียวกัน (ข้ามจังหวัดแค่ ${cross.length}/${L.length})`);
}
console.log();

console.log('━━ 6) ⚡ จัดสรรอัตโนมัติ (13 เดือน — กำลังในเขตไม่พอ ต้องบอกตรง ๆ) ━━');
{
  const A=boot(13);
  const short0=totShort(A);
  A.exXferAuto();
  const moved=A.exXferList().reduce((s,x)=>s+x.a,0), rest=totShort(A);
  chk(rest>0, `ยังเหลือส่วนขาดที่หาต้นทางไม่ได้ ${fmtM(rest)} (โยกได้แค่ ${fmtM(moved)} จาก ${fmtM(short0)})`);
  chk(moved<short0, 'ระบบไม่แกล้งเติมให้ครบทั้งที่เงินไม่มี — นี่คือประเด็นที่เจ้าของงานต้องการ');
  A.exRender();
  const html=els.exResBox.innerHTML;
  chk(/ขาดต้นทาง/.test(html), 'หน้าจอบอกชัดว่า "ขาดต้นทาง" เท่าไหร่ (ต้องเป็นเงินจากนอกเขต)');
  const over=[...new Set(A.exXferList().map(x=>x.f))].filter(hc=>{const s=A.exSimPath(j.hosp.find(h=>h.hcode===hc),0).sepRisk; return s!=null&&s>A.HARD;});
  chk(over.length===0, `แม้เงินไม่พอ ก็ไม่ดันผู้ให้เกินระดับ ${A.HARD} (เกิน ${over.length})`);
}
console.log();

console.log('━━ 7) บันทึกถาวร (เจ้าของงานเลือก "เซฟไว้") ━━');
{
  const A=boot();
  const g=j.hosp.find(h=>left(A,h)>20e6), r=j.hosp.find(h=>left(A,h)<0);
  A.exXferAdd(g.hcode, r.hcode, 3e6);
  const saved=Object.values(STORE).map(v=>{try{return JSON.parse(v)}catch(e){return null}}).filter(Boolean);
  const withX=saved.find(o=>Array.isArray(o.xfer)&&o.xfer.length>0);
  chk(!!withX, 'แผนโยกถูกเขียนลง localStorage แล้ว (รีเฟรชยังอยู่)');
  chk(withX&&withX.xfer[0].f===g.hcode&&withX.xfer[0].t===r.hcode&&withX.xfer[0].a===3e6,
    `ข้อมูลที่เซฟถูกต้อง {f,t,a} = ${withX?JSON.stringify(withX.xfer[0]):'—'}`);
}
console.log();

console.log('━━ 8) หน้าจอ — ปุ่ม/ป้ายต้นทาง/แผงโยก/บรรทัดสรุป ━━');
{
  const A=boot();
  A.exRender();
  let html=els.exResBox.innerHTML;
  chk(/🔄 โยกช่วย/.test(html), 'มีปุ่ม "🔄 โยกช่วย" ในคอลัมน์เงินสดคงเหลือหลังภาระ MOE');
  chk(/⚡ จัดสรรอัตโนมัติ/.test(html), 'มีปุ่ม "⚡ จัดสรรอัตโนมัติ" ที่บรรทัดสรุป');
  chk(/แผนโยกเงินช่วยกัน/.test(html), 'มีบรรทัดสรุปแผนโยกเงิน');
  // แผงโยกเป็น "ป็อปอัป" แล้ว (เจ้าของงานสั่ง 6 ส.ค. 69 — แบบกางในแถวใหญ่เกินจนหน้าต่างเพี้ยน)
  const g=j.hosp.find(h=>A.exXferCap(h)>1e6);
  A.exXfToggle(g.hcode);
  const ov=els.exXfOverlay, mo=(ov&&ov.innerHTML)||'';
  chk(/nip-overlay|nip-modal/.test((ov&&ov.className||'')+mo), 'เปิดเป็นป็อปอัป (ใช้ pattern .nip-overlay/.nip-modal เดิมของหน้า)');
  chk(ov&&ov.style&&ov.style.display==='flex', 'ป็อปอัปถูกสั่งแสดง (display:flex)');
  chk(!/xfT_/.test(els.exResBox.innerHTML), 'ไม่กางแถวย่อยในตารางอีกแล้ว (ตารางไม่เพี้ยน)');
  chk(new RegExp('xfT_'+g.hcode).test(mo), 'ป็อปอัปมี dropdown เลือก รพ. ปลายทาง');
  chk(new RegExp('xfA_'+g.hcode).test(mo), 'ป็อปอัปมีช่องกรอกวงเงิน');
  chk(/exXfSubmit/.test(mo)&&/เติมเต็มส่วนขาด/.test(mo), 'มีปุ่มโอนเงิน + ปุ่มเติมเต็มส่วนขาด');
  chk(/ให้ได้อีก/.test(mo), 'ป็อปอัปบอกว่าให้ได้อีกเท่าไหร่');
  chk(/ข้ามจังหวัด/.test(mo), 'ปลายทางข้ามจังหวัดมีป้ายกำกับ (เจ้าของงานอนุญาตแต่ต้องเห็น)');
  chk(/exXfClose/.test(mo), 'มีปุ่มปิดป็อปอัป');
  A.exXfClose();
  chk(ov.style.display==='none', 'ปิดป็อปอัปแล้วซ่อนจริง');
  html=els.exResBox.innerHTML;
  // ป้ายต้นทางฝั่งผู้รับ
  A.setEXXF({}); const r=j.hosp.find(h=>left(A,h)<0);
  A.exXferAdd(g.hcode, r.hcode, 2e6); html=els.exResBox.innerHTML;
  chk(new RegExp('\\+'+g.name).test(html), `ผู้รับมีป้ายบอกต้นทาง "+${g.name}" ตามที่เจ้าของงานขอ`);
  chk(/class="xfin"/.test(html)&&/exXferDel/.test(html), 'ป้ายต้นทางมีปุ่ม ✕ ยกเลิกได้');
  chk(/ล้างแผนโยกทั้งหมด/.test(html), 'มีปุ่มล้างแผนทั้งหมดเมื่อมีรายการแล้ว');
}
console.log();

console.log('━━ 9) ข้อความในเซลล์สั้นลงตามที่ขอ (แต่ยังแยก 2 สมมติฐานได้) ━━');
{
  const A=boot();
  A.exRender();
  const rows=[...els.exResBox.innerHTML.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[0]).filter(r=>r.includes('class="ovtgl"'));
  const tds=[...rows[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
  // ⚠️ หาคอลัมน์จากหัวตารางจริง ห้ามผูกเลขดัชนี (แก้ 11 ส.ค. 69 — เรียงคอลัมน์ใหม่แล้วเลขเลื่อน)
  const iLeft=[...els.exResBox.innerHTML.match(/<tr>[\s\S]*?<\/tr>/)[0].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)]
    .map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,''))
    .findIndex(t=>t.includes('คงเหลือหลังภาระMOE'));
  const cell=tds[iLeft][1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  chk(!/กรณีรายรับไม่เป็นไปตามแผน ·/.test(cell), 'เลิกใช้ข้อความยาว "กรณีรายรับไม่เป็นไปตามแผน ·" ในเซลล์แล้ว');
  chk(/สมมติไม่มีรายรับ/.test(cell), 'ใช้ป้ายสั้น "สมมติไม่มีรายรับ" แทน');
  chk(/ปกติ: เงินสด(ไม่)?ติดลบ/.test(cell), 'บรรทัดล่างใช้ป้ายสั้น "ปกติ:" แต่ยังบอกผลชัด');
  chk(cell.length<160, `ความยาวข้อความในเซลล์ ${cell.length} ตัวอักษร (สั้นลงจริง)`);
  console.log(`     ตัวอย่าง: ${cell.slice(0,150)}`);
}
console.log();

console.log('━━ 10) ลูกหนี้ปรับลดได้ (เจ้าหนี้เคลียร์ 0 ได้ แต่ลูกหนี้อาจเก็บไม่ได้) ━━');
{
  const A=boot();
  const totAr=()=>j.hosp.reduce((s,h)=>s+A.exArIn(h),0);
  const totShort=()=>j.hosp.reduce((s,h)=>s+A.exTopUp({h,r0:A.exSimPath(h,0)}),0);
  const ar0=totAr(), sh0=totShort();
  // ⚠️ ผูกกับงวดข้อมูล — งวด 256909 เดิม 499.33M · งวด 256910 (11 ส.ค. 69) = 489.54M
  chk(Math.abs(ar0-489.54e6)<1e6, `ค่าเริ่มต้น 100% = ลูกหนี้เต็มจำนวน ${fmtM(ar0)} (ยันไว้กับงวด 256910)`);
  A.exSetArPct(60);
  chk(Math.abs(totAr()-ar0*0.6)<1e3, `ปรับ % รวมทั้งเขตเป็น 60% → ลูกหนี้ ${fmtM(totAr())}`);
  chk(totShort()>sh0, `เก็บได้น้อยลง → ส่วนขาดสภาพคล่องเพิ่มตามจริง (${fmtM(sh0)} → ${fmtM(totShort())})`);
  A.exSetArPct(100);
  chk(Math.abs(totAr()-ar0)<1e3, 'ปรับกลับ 100% แล้วได้ค่าเดิม');
  // กำหนดเองรายแห่ง ชนะ % รวม
  const big=j.hosp.filter(h=>A.exArRaw(h)>5e6)[0];
  A.exSetArOvr(big.hcode, 0);
  chk(A.exArIn(big)===0 && Math.abs(A.exArCut(big)-A.exArRaw(big))<1,
    `กำหนดเอง ${big.name}=0 (เต็ม ${fmtM(A.exArRaw(big))}) → เก็บได้ 0 · ตัดออก ${fmtM(A.exArCut(big))}`);
  A.exSetArPct(50);
  chk(A.exArIn(big)===0, 'ค่ากำหนดเองชนะ % รวม (ปรับ % แล้วแห่งที่กำหนดเองไม่ขยับ)');
  A.exSetArPct(100);
  A.exSetArOvr(big.hcode, 999999);                     // กรอกเกินยอดจริง
  chk(Math.abs(A.exArIn(big)-A.exArRaw(big))<1, `กรอกเกินยอดในบัญชี ถูกจำกัดที่ ${fmtM(A.exArIn(big))} (เก็บได้เกินที่มีจริงไม่ได้)`);
  A.exSetArOvr(big.hcode, '');                          // ล้างค่ากำหนดเอง
  chk(!(EXSTof(A).arOvr||{})[big.hcode], 'ล้างค่ากำหนดเองรายแห่งได้ (คืนค่าเต็ม)');
  A.exSetArOvr(big.hcode, 1); A.exArClear();
  chk(Math.abs(totAr()-ar0)<1e3 && Object.keys(EXSTof(A).arOvr||{}).length===0, 'ปุ่มคืนค่าเต็มทั้งหมดล้างทั้ง % และรายแห่ง');
  // เซฟถาวร
  A.exSetArOvr(big.hcode, 1);
  const saved=Object.values(STORE).map(v=>{try{return JSON.parse(v)}catch(e){return null}}).filter(Boolean);
  chk(saved.some(o=>o.arOvr&&Object.keys(o.arOvr).length>0), 'ค่าที่กำหนดเองถูกเซฟถาวร (รีเฟรชยังอยู่)');
  // UI
  A.exRender();
  const html=els.exResBox.innerHTML;
  chk(/📥 ลูกหนี้ที่เก็บได้:/.test(html), 'มีช่องปรับ % ลูกหนี้รวมทั้งเขตเหนือตาราง');
  chk(/exArEdit/.test(html), 'คอลัมน์ลูกหนี้มีปุ่ม ✎ แก้รายแห่ง');
  chk(/ตัดออก/.test(html), 'เซลล์ที่ถูกปรับลดแสดงยอดที่ตัดออก');
}
console.log();

console.log('━━ 11) ส่วนขาดสภาพคล่องไม่หายไปเมื่อได้รับโยก (แสดงยอดตั้งต้น + รับแล้ว) ━━');
{
  const A=boot();
  const r=j.hosp.find(h=>A.exTopUp({h,r0:A.exSimPath(h,0)})>3e6);
  const g0=A.exTopUpGross({h:r,r0:A.exSimPath(r,0)});
  const gv=j.hosp.find(h=>left(A,h)>50e6);
  A.exXferAdd(gv.hcode, r.hcode, g0);
  chk(Math.abs(A.exTopUpGross({h:r,r0:A.exSimPath(r,0)})-g0)<1,
    `${r.name}: ยอดตั้งต้น ${fmtM(g0)} คงเดิมหลังรับโยกเต็มจำนวน (ไม่หายไป)`);
  chk(A.exTopUp({h:r,r0:A.exSimPath(r,0)})<1, 'ส่วนที่ "ยังขาด" เหลือ 0 จริง (แยกกันคนละตัว)');
  chk(Math.abs(A.exXferIn(r)-g0)<1, `รับแล้วรวม ${fmtM(A.exXferIn(r))}`);
  A.exRender();
  const html=els.exResBox.innerHTML;
  chk(/รับแล้ว/.test(html), 'เซลล์บอก "รับแล้ว X จาก N แห่ง"');
  chk(/✅ ครบแล้ว/.test(html), 'เซลล์บอก "ครบแล้ว" เมื่อเติมเต็ม');
  // ชิปสรุปต้องยังนับยอดตั้งต้น ไม่หายไปเมื่อจัดสรรกันเองแล้ว
  // ⚠️ ชิป = "ยอดที่จัดสรรด้วยการโยกเงินจริงแล้ว" เท่านั้น (เจ้าของงานสั่ง 6 ส.ค. 69)
  const chip=html.match(/รวมเงินเติมตามสภาพคล่อง ถึง [^:]+: <span[^>]*>([^<]+)<\/span> <span[^>]*>\((\d+) แห่ง([^)]*)\)/);
  const wantMoved=j.hosp.reduce((s,h)=>s+A.exXferIn(h),0);
  const wantNGot=j.hosp.filter(h=>A.exXferIn(h)>0).length;
  const wantGross=j.hosp.reduce((s,h)=>s+A.exTopUpGross({h,r0:A.exSimPath(h,0)}),0);
  chk(!!chip&&chip[1]===fmtM(wantMoved)&&+chip[2]===wantNGot,
    `ชิป = ยอดที่โยกจริง ${chip?chip[1]+' / '+chip[2]+' แห่ง':'ไม่พบ'} (ควร ${fmtM(wantMoved)} / ${wantNGot}) — ทุกบาทมีต้นทาง`);
  chk(!!chip&&chip[3].includes(fmtM(wantGross)), `ชิปยังบอกความต้องการตั้งต้นในวงเล็บ "จากที่ต้องการ ${fmtM(wantGross)}"`);
  // ยังไม่โยกเลย ชิปต้องเป็น 0 (ไม่ใช่ยอดลอย)
  A.exXferClear(); A.exRender();
  const chip0=els.exResBox.innerHTML.match(/รวมเงินเติมตามสภาพคล่อง ถึง [^:]+: <span[^>]*>([^<]+)<\/span> <span[^>]*>\((\d+) แห่ง/);
  chk(!!chip0&&chip0[1]===fmtM(0)&&+chip0[2]===0, `ยังไม่ได้โยกเลย ชิป = ${chip0?chip0[1]:'—'} (ต้องเป็น 0 ไม่ใช่ยอดลอย)`);
  // จัดสรรอัตโนมัติแล้วชิปต้องเท่ายอดที่โยกจริงพอดี
  A.exXferAuto(); A.exRender();
  const moved2=A.exXferList().reduce((s,z)=>s+z.a,0);
  const chip2=els.exResBox.innerHTML.match(/รวมเงินเติมตามสภาพคล่อง ถึง [^:]+: <span[^>]*>([^<]+)<\/span>/);
  chk(!!chip2&&chip2[1]===fmtM(moved2), `จัดสรรอัตโนมัติแล้วชิป ${chip2?chip2[1]:'—'} = ยอดที่โยกจริง ${fmtM(moved2)} พอดี`);
}
console.log();

console.log('━━ 12) โหมดกว้าง + ป้ายผู้สนับสนุนเรียงลงล่าง ━━');
{
  const A=boot();
  A.exRender();
  const n0=((els.exResBox.innerHTML.match(/<tr>[\s\S]*?<\/tr>/)||[''])[0].match(/<th\b/g)||[]).length;
  chk(/ย่อคอลัมน์ชื่อในตาราง/.test(els.exResBox.innerHTML), 'มีปุ่มย่อคอลัมน์ซ้ายของตาราง เด่นชัดติดกับตาราง');
  chk(/ปุ่ม ◀ ที่ขอบจอด้านซ้าย/.test(els.exResBox.innerHTML), 'บอกชัดว่าคนละปุ่มกับ ◀ ที่ขอบจอ (ยุบแถบรายชื่อทั้งแผง) — กันสับสน');
  const st=A.getEXST(); st.wide=true; A.setEXST(st); A.exRender();
  chk(/ขยายคอลัมน์ชื่อกลับ/.test(els.exResBox.innerHTML), 'ย่อแล้วปุ่มเปลี่ยนเป็น "▶ ขยายคอลัมน์ชื่อกลับ"');
  // ── แถบรายชื่อ รพ. ทั้งแผงด้านซ้ายของจอ (คนละอันกับคอลัมน์ในตาราง) ──
  const src2=fs.readFileSync(SRC,'utf8'), css2=(src2.match(/<style>([\s\S]*?)<\/style>/)||[])[1]||'';
  chk(/\.main\.lcol \.left\{width:0/.test(css2), 'ยุบแถบรายชื่อ รพ. ทั้งแผงแล้วกว้าง 0 (คืนพื้นที่ 340px ให้ตาราง)');
  chk(/\.lcolbtn\{position:absolute/.test(css2), 'ปุ่มยุบลอยติดขอบซ้าย เห็นตลอด');
  chk(/transition:width/.test(css2), 'ยุบแบบสไลด์ (ตามที่เจ้าของงานเสนอ)');
  chk(/@media\(max-width:900px\)\{\.lcolbtn\{display:none\}/.test(css2), 'มือถือซ่อนปุ่มนี้ ใช้ drawer เดิม ไม่ชนกัน');
  chk(/id="lcolBtn"/.test(src2)&&/function toggleLeftCol/.test(src2), 'มีปุ่ม + ฟังก์ชัน toggle ในหน้า');
  chk(/localStorage.setItem\(LCOL_KEY/.test(src2), 'จำสถานะยุบไว้ (รีเฟรชยังยุบอยู่)');
  chk(/classList.toggle\('open'/.test(src2), 'drawer มือถือเดิมยังอยู่ครบ ไม่ถูกทับ');
  const html=els.exResBox.innerHTML;
  const n1=((html.match(/<tr>[\s\S]*?<\/tr>/)||[''])[0].match(/<th\b/g)||[]).length;
  chk(n1===n0-1, `โหมดกว้างซ่อนคอลัมน์จังหวัด (${n0} → ${n1} ช่อง)`);
  chk(/ex-sticky ex-wide/.test(html), 'ตารางได้คลาส ex-wide');
  chk(/class="wide-name"/.test(html), 'คอลัมน์ชื่อ รพ. ใช้คลาสแคบ (wide-name)');
  chk(/min-width:860px/.test(html), 'min-width ตารางลดลงในโหมดกว้าง');
  const src=fs.readFileSync(SRC,'utf8');
  const css=(src.match(/<style>([\s\S]*?)<\/style>/)||[])[1]||'';
  chk(/\.ex-wide td:nth-child\(1\)\{position:sticky;left:0/.test(css), 'โหมดกว้างย้าย sticky มาคอลัมน์ที่ 1 (ชื่อ รพ.) ไม่ตรึงผิดคอลัมน์');
  chk(/\.ex-wide td:nth-child\(2\)\{position:static/.test(css), 'คอลัมน์ที่ 2 คลาย sticky ในโหมดกว้าง');
  chk(/\.xfin\{display:flex/.test(css), 'ป้ายผู้สนับสนุนเป็น block เรียงลงล่าง ไม่ต่อไปทางขวา');
  chk(/\.xfin\{[^}]*max-width:190px/.test(css), 'ป้ายมีความกว้างจำกัด (ไม่ยืดตารางออกด้านขวา)');
}
console.log();

console.log('\n'+(fail.length?`❌ ไม่ผ่าน ${fail.length} ข้อ:\n  `+fail.join('\n  '):'✅ ผ่านทุกข้อ'));
process.exit(fail.length?1:0);
